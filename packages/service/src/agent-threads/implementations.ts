// ---
// relationships:
//   implements: agent-threads
// ---
import { assign, fromPromise } from "xstate";
import { T3NotFoundError, threadId, messageId } from "@wyrd-company/t3code-client";
import type { ClientOrchestrationCommand } from "@wyrd-company/t3code-client";
import type { AgentThreadsOptions, AgentThreads, Invocation, ManifoldIdentity } from "./types.ts";
import { failure } from "./types.ts";
import { derivedId } from "./ids.ts";
import { createInput, turnInput } from "./inputs.ts";
import { render } from "./templates.ts";
import { createCommand, turnCommand } from "./commands.ts";
import { clients } from "./clients.ts";
import { dispatch } from "./dispatch.ts";
export function openAgentThreads(options: AgentThreadsOptions): AgentThreads {
  const pool = clients(options);
  const lifetime = new AbortController();
  function actor(invocation: Invocation) {
    const actor = options.actorOf(invocation.actorId);
    const environment = actor?.manifold.environment;
    if (!actor || !environment || !Object.hasOwn(options.environments, environment))
      throw failure("environment", "Actor has no configured environment");
    return { ...actor, environment };
  }
  const create = fromPromise(async (args) => {
    const input = createInput(args.input);
    const invocation = options.invocationOf(args);
    const owner = actor(invocation);
    if (owner.manifold.project && options.bindingArchived(owner.manifold.project))
      throw failure("archived", "Actor binding is archived");
    const signal = AbortSignal.any([args.signal, lifetime.signal]);
    signal.throwIfAborted();
    const title = await render(
      options.revisionAt(owner.commit),
      input.title,
      input.values ?? {},
      true,
    );
    const command = createCommand(input, invocation, title, new Date().toISOString());
    const id = command.threadId;
    const result = await dispatch(options, owner.environment, signal, () =>
      options.sourceWrite(owner.environment, id, signal, (writeSignal) =>
        pool.get(owner.environment).threads.dispatcher.dispatch(command, writeSignal),
      ),
    );
    signal.throwIfAborted();
    options.probe?.({
      implementation: "thread-create",
      commandId: command.commandId,
      sequence: result.sequence,
    });
    return { threadId: id };
  });
  const prepare = fromPromise(async (args) => {
    const invocation = options.invocationOf(args);
    return {
      messageId: derivedId(
        "turn-prepare/message",
        invocation.actorId,
        invocation.invokeId,
        invocation.entryId,
      ),
    };
  });
  const turn = fromPromise(async (args) => {
    const input = turnInput(args.input);
    const owner = actor(options.invocationOf(args));
    const id = threadId(input.threadId.trim());
    const requested = messageId(input.messageId.trim());
    if (!owner.manifold.threads?.includes(id))
      throw failure("input", "Actor does not follow the requested thread");
    const signal = AbortSignal.any([args.signal, lifetime.signal]);
    signal.throwIfAborted();
    const text = await render(
      options.revisionAt(owner.commit),
      input.prompt.trim(),
      input.values ?? {},
      false,
    );
    let command: ClientOrchestrationCommand | undefined;
    const result = await dispatch(options, owner.environment, signal, async () => {
      const client = pool.get(owner.environment);
      if (!command) {
        const current =
          input.runtimeMode && input.interactionMode
            ? undefined
            : await client.threads.get(id, signal);
        if (!current && (!input.runtimeMode || !input.interactionMode))
          throw failure("rejected", "Thread is absent from the server shell");
        command = turnCommand(input, text, current, new Date().toISOString());
      }
      return options.sourceWrite(owner.environment, id, signal, (writeSignal) =>
        client.threads.dispatcher.dispatch(command!, writeSignal),
      );
    });
    signal.throwIfAborted();
    options.probe?.({
      implementation: "turn-start",
      commandId: derivedId("turn-start/command", requested),
      sequence: result.sequence,
    });
    return { threadId: id, messageId: requested };
  });
  const follow = assign(
    ({
      context,
      event,
    }: {
      context: { manifold?: ManifoldIdentity };
      event: { type: string; output?: { threadId?: string } };
    }) => {
      const id = event.output?.threadId;
      if (!id) throw failure("input", "follow-thread requires a thread-create output");
      const manifold = context.manifold ?? {};
      const threads = manifold.threads ?? [];
      return {
        manifold: { ...manifold, threads: threads.includes(id) ? threads : [...threads, id] },
      };
    },
  );
  function environment(name: string, signal?: AbortSignal) {
    if (!Object.hasOwn(options.environments, name))
      throw failure("environment", "Environment is not configured");
    return AbortSignal.any([...(signal ? [signal] : []), lifetime.signal]);
  }
  async function readThread(name: string, id: string, signal?: AbortSignal) {
    const currentSignal = environment(name, signal);
    await options.sourceReady(name, currentSignal);
    try {
      return (await pool.get(name).threads.detail(threadId(id), {}, currentSignal)).thread;
    } catch (error) {
      if (error instanceof T3NotFoundError) return null;
      throw error;
    }
  }
  return {
    readThread,
    async runningThreads(name, signal) {
      const currentSignal = environment(name, signal);
      await options.sourceReady(name, currentSignal);
      const shells = await pool.get(name).threads.list({}, currentSignal);
      const running = shells.filter(
        (shell) => shell.session?.status === "running" || shell.session?.status === "starting",
      );
      const threads = await Promise.all(
        running.map((shell) => readThread(name, shell.id, currentSignal)),
      );
      return threads.filter((thread) => thread !== null);
    },
    async startTurn(request) {
      const { environment: name, threadId: id, messageId: requested, text } = request;
      const signal = environment(name, request.signal);
      let command: ClientOrchestrationCommand | undefined;
      const result = await dispatch(options, name, signal, async () => {
        const client = pool.get(name);
        if (!command) {
          const current = await client.threads.get(threadId(id), signal);
          if (!current) throw failure("rejected", "Thread is absent from the server shell");
          command = turnCommand(
            { threadId: id, messageId: requested, prompt: text },
            text,
            current,
            new Date().toISOString(),
          );
        }
        return options.sourceWrite(name, id, signal, (writeSignal) =>
          client.threads.dispatcher.dispatch(command!, writeSignal),
        );
      });
      return { sequence: result.sequence };
    },
    implementations: {
      actors: { "thread-create": create, "turn-prepare": prepare, "turn-start": turn },
      actions: { "follow-thread": follow },
      guards: {},
      delays: {},
    },
    async stop() {
      lifetime.abort();
      await pool.close();
    },
  };
}
