// ---
// relationships:
//   implements: service-assembly
// ---
import { openAgentThreads } from "./index.ts";
import { invocationOf } from "../actor-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import { createMirror } from "../github-source/mirror.ts";
import type { Service } from "../service/types.ts";
import type { AgentThreads } from "./index.ts";
import { actorHost as actorHostPart } from "../actor-host/wiring.ts";
import { t3codeSource } from "../t3code-source/wiring.ts";
export const agentThreads = wiringPart({
  name: "agent-threads",
  start: (
    members: Required<
      Pick<Service, "configuration" | "portfolio" | "processRepository" | "log">
    > & { githubMirror: ReturnType<typeof createMirror> },
    context,
  ): { agentThreads: AgentThreads } => {
    const { configuration, portfolio, processRepository, log, githubMirror } = members;
    const actorHost = context.later(actorHostPart);
    const source = context.later(t3codeSource);
    const tokenFile = (name: string) => {
      const credential = configuration.credentials.resolve(name);
      if (credential.kind !== "t3code-token")
        throw new TypeError(`Credential ${name}: requires t3code-token`);
      return credential.tokenFile;
    };
    const commandLog = (level: "info" | "warn" | "error") => (message: string) =>
      log({ level, event: "agent-threads-log", message });
    const agentThreads = openAgentThreads({
      environments: configuration.environments,
      tokenFile,
      actorOf: (id) => actorHost.current()?.actorHost.actorOf(id),
      invocationOf,
      bindingArchived: (projectNodeId) => {
        const project = githubMirror.read().projects.get(projectNodeId)?.project;
        return project ? (portfolio.githubProject(project)?.archived ?? false) : false;
      },
      revisionAt: processRepository.revisionAt,
      sourceReady: async (environment, signal) => {
        const { t3code } = await source.ready(signal);
        await t3code.ready(environment, signal);
      },
      sourceWrite: (environment, thread, signal, send) => {
        signal.throwIfAborted();
        return source.get().t3code.write(environment, thread, signal, send);
      },
      logger: {
        debug: commandLog("info"),
        info: commandLog("info"),
        warn: commandLog("warn"),
        error: commandLog("error"),
      },
    });
    context.onStop("commands", () => agentThreads.stop());
    context.addImplementations(agentThreads.implementations);
    return { agentThreads };
  },
});
