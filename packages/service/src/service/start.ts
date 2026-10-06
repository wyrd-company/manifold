// ---
// relationships:
//   implements: service-assembly
// ---
import { configuration } from "../service-configuration/wiring.ts";
import { httpHost, listen } from "../http-host/wiring.ts";
import { store } from "../store/wiring.ts";
import { bundles } from "../bundle/wiring.ts";
import { githubMirror, githubSource } from "../github-source/wiring.ts";
import { portfolio } from "../portfolio/wiring.ts";
import { usage } from "../usage/wiring.ts";
import { processRepository } from "../process-repository/wiring.ts";
import { agentThreads } from "../agent-threads/wiring.ts";
import { taskMetadata } from "../task-metadata/wiring.ts";
import { agentTools, agentToolsDelivery } from "../agent-tools/wiring.ts";
import { escalations, escalationsDelivery } from "../escalations/wiring.ts";
import { blueprintLoader } from "../blueprint-loader/wiring.ts";
import { gates, gatesPrepare } from "../gates/wiring.ts";
import { revisions, pull } from "./revisions-wiring.ts";
import { actorHost } from "../actor-host/wiring.ts";
import { router } from "../router/wiring.ts";
import { intake } from "../intake/wiring.ts";
import { t3codeSource } from "../t3code-source/wiring.ts";
import { console } from "../console/wiring.ts";
import { blueprintsApi } from "../blueprints-api/wiring.ts";
import { declarationsApiPart } from "../declarations-api/wiring.ts";
import { tasks } from "../tasks/wiring.ts";
import { assembleService } from "./wiring.ts";
import type { Service, StartServiceOptions } from "./types.ts";
export async function startService(options: StartServiceOptions): Promise<Service> {
  const { members, stop } = await assembleService(options)
    .part(configuration)
    .step("configuration-loaded")
    .part(httpHost)
    .part(store)
    .part(bundles)
    .step("store-opened")
    .part(githubMirror)
    .part(portfolio)
    .step("portfolio-opened")
    .part(usage)
    .part(processRepository)
    .part(agentThreads)
    .part(taskMetadata)
    .part(agentTools)
    .part(escalations)
    .step("escalations-opened")
    .part(blueprintLoader)
    .step("process-repository-opened")
    .part(gates)
    .part(revisions)
    .step("revision-followed")
    .part(pull)
    .step("pulled")
    .part(gatesPrepare)
    .part(actorHost)
    .step("actor-host-opened")
    .part(router)
    .step("router-started")
    .part(escalationsDelivery)
    .part(agentToolsDelivery)
    .step("escalations-started")
    .part(githubSource)
    .step("github-started")
    .part(intake)
    .step("intake-started")
    .part(t3codeSource)
    .step("t3code-started")
    .part(console)
    .part(blueprintsApi)
    .part(declarationsApiPart)
    .part(tasks)
    .part(listen)
    .step("listening")
    .start();
  try {
    members.log({
      level: "info",
      event: "started",
      message: "Service started",
      detail: members.http.address(),
    });
    return { ...members, stop };
  } catch (error) {
    await stop().catch(() => {});
    throw error;
  }
}
