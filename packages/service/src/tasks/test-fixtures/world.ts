// ---
// relationships:
//   verifies: [tasks-api, operator-console]
// ---
import { createActor, createMachine } from "xstate";
import { fixture } from "../../escalations/test-support.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../../ledger/index.ts";
import { createMirror } from "../../github-source/mirror.ts";
import { githubSteps } from "../../github-source/migrations.ts";
import { openTasks } from "../index.ts";
import type { TasksBoundProject } from "../index.ts";
export function boardWorld(usd = false, withActor = true) {
  let entry = 0;
  let raisedTime = 100;
  const f = fixture({
    clock: { now: () => raisedTime++ },
    invocationOf: () => ({
      actorId: "task:parcel",
      invokeId: "question",
      entryId: `entry-${entry}`,
    }),
  });
  f.store.connection.migrate("ledger", ledgerMigrationSteps);
  f.store.connection.migrate("github", githubSteps);
  const ledger = createLedger({
    connection: f.store.connection,
    portfolio: parseLedgerPortfolio({
      items: [{ id: "deliveries", parent: null }],
      allocations: [
        { item: "deliveries", account: "sample", guarantee: 100 },
        { item: "deliveries", account: "second", guarantee: 100 },
      ],
    }),
    now: () => 100,
  });
  for (const account of ["sample", "second"]) {
    ledger.credit({
      key: `credit:${account}`,
      account,
      window: "period",
      opensAt: 0,
      closesAt: 1000,
      amount: usd ? 10000000 : 100,
    });
    ledger.reserve({
      key: `reserve:${account}`,
      actor: "task:parcel",
      item: "deliveries",
      account,
      amount: usd ? 1000000 : 10,
    });
    ledger.postActual({
      key: `actual:${account}`,
      actor: "task:parcel",
      item: "deliveries",
      account,
      amount: usd ? 17700 : 12,
      usedAt: 100,
    });
  }
  ledger.settle({ actor: "task:parcel" });
  const projects: TasksBoundProject[] = [
    {
      binding: "delivery",
      owner: "example",
      number: 1,
      item: "deliveries",
      lifecycle: { field: "Stage", options: ["Ready", "Delivered"] },
    },
    { binding: "secondary", owner: "example", number: 2, item: "deliveries" },
  ];
  const references = new Map(
    projects.map((p) => [
      `project-${p.number}`,
      { nodeId: `project-${p.number}`, owner: p.owner, number: p.number },
    ]),
  );
  const mirror = createMirror(f.store, () => 100),
    before = mirror.read(),
    after = mirror.read();
  for (const [nodeId, project] of references)
    after.projects.set(nodeId, { project, closed: false, revision: 0 });
  for (const [id, number, title] of [
    ["parcel", 2, "Deliver parcel"],
    ["waiting", 1, "Collect parcel"],
    ["archived", 3, "Archived parcel"],
  ] as const) {
    after.issues.set(id, {
      issue: {
        nodeId: id,
        repository: "example/delivery",
        number,
        state: "open",
        stateReason: null,
        title,
        url: `https://example.test/issues/${number}`,
      },
      present: true,
      baselined: true,
      revision: 0,
    });
    after.items.set(`item-${id}`, {
      item: { nodeId: `item-${id}`, contentType: "issue", contentNodeId: id },
      projectId: "project-1",
      present: true,
      archived: id === "archived",
      revision: 0,
    });
  }
  after.items.set("item-secondary", {
    item: { nodeId: "item-secondary", contentType: "issue", contentNodeId: "parcel" },
    projectId: "project-2",
    present: true,
    archived: false,
    revision: 0,
  });
  after.fields.set("stage", {
    itemId: "item-parcel",
    field: { nodeId: "field-stage", name: "Stage" },
    value: { kind: "single-select", optionId: "ready", name: "Ready" },
    revision: 0,
  });
  mirror.write(before, after);
  if (withActor)
    f.store.saveSnapshot({
      actorId: "task:parcel",
      machine: `${"b".repeat(40)}:blueprints/delivery.yml`,
      snapshot: {
        status: "done",
        value: "delivered",
        context: {
          manifold: {
            environment: "sample-host",
            portfolioItem: "deliveries",
            threads: ["thread-1", "unfollowed"],
          },
        },
      },
    });
  const questions: ReturnType<typeof createActor>[] = [];
  function ask() {
    entry++;
    const question = createActor(
      createMachine({
        initial: "ask",
        states: {
          ask: {
            invoke: {
              id: "question",
              src: f.module.escalate,
              input: {
                title: "Delivery question",
                question: "Where should the parcel go?",
                choices: [
                  { id: "door", label: "Leave at door" },
                  { id: "desk", label: "Leave at desk" },
                ],
                freeText: true,
                destinations: [],
              },
            },
          },
        },
      }),
    ).start();
    questions.push(question);
    return f.module
      .list({ status: "open" })
      .find((e) => e.raiser.type === "blueprint" && e.raiser.entryId === `entry-${entry}`)!;
  }
  const escalation = ask();
  const tasks = openTasks({
    store: f.store,
    held: () => false,
    boundProjects: () => projects,
    github: {
      trackedIssueIds: () => mirror.trackedIssueIds(references),
      trackedIssue: (id) => mirror.trackedIssue(id, references),
    },
    actorUsage: ledger.actorUsage,
    accountUnit: () => (usd ? "usd" : undefined),
    listEscalations: f.module.list,
    thread: (_environment, id) =>
      id === "thread-1"
        ? {
            title: "Parcel delivery",
            url: "https://example.test/environment/thread-1",
            turn: "completed",
            archived: false,
          }
        : undefined,
    tokenHolder: (id) => (id === "sample-token" ? "task:parcel" : undefined),
  });
  return {
    ...f,
    ask,
    ledger,
    mirror,
    projects,
    tasks,
    escalation,
    async close() {
      for (const question of questions) question.stop();
      await f.close();
    },
  };
}
