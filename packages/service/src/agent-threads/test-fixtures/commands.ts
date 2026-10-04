// ---
// relationships:
//   verifies: agent-threads
// ---
import { schemas, turnId } from "@wyrd-company/t3code-client";
import { fakeServer, fixtureThread } from "../../t3code-source/test-fixtures/server.ts";
export async function commandServer() {
  const server = await fakeServer();
  const receipts = new Map<string, { aggregate: string; sequence: number }>();
  const commands: ReturnType<
    typeof schemas.orchestrationCommands.ClientOrchestrationCommand.parse
  >[] = [];
  const hooks: { accepted?: (command: (typeof commands)[number]) => void } = {};
  server.hooks.dispatch = (raw) => {
    const command = schemas.orchestrationCommands.ClientOrchestrationCommand.parse(raw);
    commands.push(command);
    if (command.type !== "thread.create" && command.type !== "thread.turn.start")
      throw new Error("Unsupported fixture command");
    const receipt = receipts.get(command.commandId);
    if (receipt) {
      if (receipt.aggregate !== command.threadId)
        throw new Error("Command belongs to another thread");
      return { sequence: receipt.sequence };
    }
    if (command.type === "thread.create") {
      const thread = fixtureThread(command.threadId);
      thread.title = command.title;
      thread.runtimeMode = command.runtimeMode;
      thread.interactionMode = command.interactionMode;
      server.change(thread);
    } else {
      const thread = server.threads.get(command.threadId)!;
      const message = schemas.orchestrationReadModel.OrchestrationMessage.parse({
        id: command.message.messageId,
        role: "user",
        text: command.message.text,
        attachments: [],
        turnId: null,
        streaming: false,
        createdAt: command.createdAt,
        updatedAt: command.createdAt,
      });
      thread.messages.push(message);
      server.change(thread, "thread.message-sent", {
        threadId: thread.id,
        messageId: message.id,
        role: message.role,
        text: message.text,
        attachments: [],
        streaming: false,
        turnId: null,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      });
      thread.latestTurn = {
        turnId: turnId(`turn-${receipts.size}`),
        state: "running",
        requestedAt: command.createdAt,
        startedAt: command.createdAt,
        completedAt: null,
        assistantMessageId: null,
      };
      thread.session = {
        threadId: thread.id,
        status: "running",
        activeTurnId: thread.latestTurn!.turnId,
        providerName: "codex",
        runtimeMode: thread.runtimeMode,
        updatedAt: command.createdAt,
        lastError: null,
      };
      server.change(thread);
    }
    const result = { aggregate: command.threadId, sequence: server.log.length };
    receipts.set(command.commandId, result);
    hooks.accepted?.(command);
    return { sequence: result.sequence };
  };
  function settle(id: string) {
    const thread = server.threads.get(id)!;
    thread.latestTurn = {
      ...thread.latestTurn!,
      state: "completed",
      completedAt: thread.latestTurn!.requestedAt,
    };
    thread.session = { ...thread.session!, status: "ready", activeTurnId: null };
    server.change(thread);
  }
  return { ...server, receipts, commands, commandHooks: hooks, settle };
}
