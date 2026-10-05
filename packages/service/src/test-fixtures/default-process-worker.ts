// ---
// relationships:
//   verifies: default-process
// ---
// Structural stand-ins for capacity, card move and agent tools. Rebase replaces
// these with the merged owners; thread commands, gates, intake and usage are real.
import { fromPromise } from "xstate";
import { Ajv2020 } from "ajv/dist/2020.js";
import { startService } from "../service/index.ts";
import { createServiceActorHost } from "../actor-host/service.ts";
import { invocationOf } from "../actor-host/index.ts";
import { readRequest } from "../escalations/test-support.ts";
import type { RoutedEvent } from "../router/index.ts";
import type { Store } from "../store/index.ts";
const config = JSON.parse(process.argv[2]!) as { file: string; moveUrl: string };
let store!: Store;
const service = await startService({
  configurationFile: config.file,
  log: (entry) => process.send?.({ type: "log", entry }),
  defaultProcessSeams: {
    actors: {
      "github-card-move": fromPromise(async ({ input, self }) => {
        const invocation = invocationOf({ self });
        const response = await fetch(config.moveUrl, {
          method: "POST",
          body: JSON.stringify({ actorId: invocation.actorId, ...(input as { status: string }) }),
        });
        if (!response.ok) throw new Error("Fixture card move refused");
        return {};
      }),
    },
    actions: {},
    guards: {},
    delays: {},
  },
  async actorHost(parts) {
    store = parts.store;
    const host = await createServiceActorHost(parts);
    return {
      ...host,
      subscription(actor) {
        const subscription = host.subscription(actor);
        const context = actor.snapshot["context"] as
          | { manifold?: { environment?: string; threads?: string[] } }
          | undefined;
        return {
          ...subscription,
          topics: [
            ...subscription.topics,
            ...(context?.manifold?.threads ?? []).map(
              (id) => `agent.environment.${context!.manifold!.environment}.thread.${id}`,
            ),
          ],
        };
      },
    };
  },
});
service.portfolio.ledger.credit({
  key: "fixture-capacity",
  account: "agents",
  window: "fixture-window",
  opensAt: 0,
  closesAt: Number.MAX_SAFE_INTEGER,
  amount: 100_000_000,
});
const blueprint = service.revisions.latest()!.blueprints.get("blueprints/task.yml")!;
if (!blueprint) throw new Error("Default blueprint failed to load");
const validate = new Ajv2020({ strict: false }).compile(
  blueprint.document.schemas.events["agent.handoff"]!,
);
service.http.mount("/api/agent-tools/calls", (request, response) => {
  void readRequest(request)
    .then((body) => {
      const envelope = JSON.parse(body) as { id: string; event: RoutedEvent };
      if (envelope.event.type === "agent.handoff" && !validate(envelope.event)) {
        response.writeHead(400).end();
        return;
      }
      const event = envelope.event;
      const result = service.router.publish({
        source: "agent",
        eventId: envelope.id,
        topics: [`agent.environment.${event["environment"]}.thread.${event["threadId"]}`],
        event,
      });
      response
        .writeHead(result.status === "accepted" ? 200 : 400, { "content-type": "application/json" })
        .end(JSON.stringify(result));
    })
    .catch(() => response.writeHead(500).end());
});
process.send?.({ type: "ready", address: service.http.address() });
process.on("message", (message) => {
  if (message === "stop") void service.stop().then(() => process.exit(0));
  if (message === "usage")
    process.send?.({
      type: "usage",
      usage: service.portfolio.ledger.actorUsage("task:I_A"),
      snapshot: store.loadSnapshot("task:I_A"),
    });
});
