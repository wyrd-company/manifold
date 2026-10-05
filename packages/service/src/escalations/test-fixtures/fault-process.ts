// ---
// relationships:
//   verifies: escalations
// ---
import { createActor, createMachine, assign } from "xstate";
import { openStore } from "../../store/index.ts";
import type { PersistedSnapshot } from "../../store/index.ts";
import { openEscalations } from "../index.ts";
const [path, mode, server] = process.argv.slice(2);
const store = openStore({ path: path! });
const kill = () => process.kill(process.pid, "SIGKILL");
const module = openEscalations({
  store,
  configuration: {
    publicUrl: "http://localhost",
    destinations: server
      ? { default: { server, topic: "opaque-topic", posture: "open", priority: 4 } }
      : {},
    requestTimeoutMs: 1000,
    retryIntervalMs: 1000,
  },
  tokenFile: () => "",
  handlers: {
    "intake-failed": () => {},
    "comparator-failed": () => {},
    "held-actor": () => {
      if (mode === "handler") kill();
    },
    "stranded-token": () => {},
  },
  invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
  ...(mode === "publish"
    ? {
        fetch: async (...args: Parameters<typeof fetch>) => {
          const response = await fetch(...args);
          kill();
          return response;
        },
      }
    : {}),
});
if (mode === "answer" || mode === "exit") {
  const machine = createMachine({
    initial: "asking",
    context: { answers: 0 },
    states: {
      asking: {
        invoke: { src: module.escalate, input: { question: "Send it?", freeText: true } },
        on: {
          "escalation.answered": {
            actions: [assign({ answers: ({ context }) => context.answers + 1 }), () => kill()],
          },
          leave: { target: "later", actions: () => kill() },
        },
      },
      later: {},
    },
  });
  const actor = createActor(machine).start();
  store.saveSnapshot({
    actorId: "parcel",
    machine: "parcel",
    snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
  });
  if (mode === "exit") actor.send({ type: "leave" });
  else module.answer(module.list({})[0]!.id, { text: "Proceed" }, "api");
} else {
  const escalation = module.raise({
    kind: "held-actor",
    subject: { actorId: "parcel" },
    question: "Try the delivery again?",
    choices: [
      { id: "retry", label: "Retry" },
      { id: "dismiss", label: "Dismiss" },
    ],
  });
  if (mode === "handler") module.answer(escalation.id, { choice: "retry" }, "api");
  else module.start();
}
