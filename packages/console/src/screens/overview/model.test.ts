// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import type {
  PortfolioAccount,
  PortfolioItem,
  PortfolioResponse,
} from "@wyrd-company/manifold-shared/portfolio-api";
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
import type { BoundProject } from "@wyrd-company/manifold-shared/tasks-api";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
import { closestToLimit, itemBudgets } from "./budget.ts";
import { activeActorRows, currentThread, elapsedLabel } from "./active-actors.ts";
import { needsAttention } from "./attention.ts";
const account = (
  name: string,
  used: number,
  capacity = 100,
  declared = true,
): PortfolioAccount => ({
  name,
  declared,
  window: {
    key: "period",
    opensAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2026-02-01T00:00:00.000Z",
    capacity,
    used,
  },
});
const item = (
  id: string,
  parent: string | null,
  actual: number,
  archived = false,
  amount = 100,
): PortfolioItem => ({
  id,
  title: id,
  parent,
  archived,
  other: id === "other",
  activeTasks: 0,
  projects: { github: [], t3code: [] },
  allocations: [
    {
      account: "sample",
      declared: true,
      guarantee: 100,
      amount,
      actual,
      outstanding: 0,
      available: amount - actual,
      reservable: amount - actual,
      lifetime: actual,
    },
  ],
});
const actor = (actorId: string, savedAt = "2026-01-01T00:00:00.000Z"): ActorSummary => ({
  actorId,
  savedAt,
  states: ["waiting"],
  machine: "sample",
});
const tasks: readonly BoundProject[] = [
  {
    binding: "sample",
    owner: "example",
    number: 1,
    item: "sample",
    tasks: ["a", "b", "missing"].map((id, i) => ({
      actorId: `task:${id}`,
      issue: {
        nodeId: id,
        repository: "example/parcels",
        number: i + 1,
        state: "open",
        title: `Parcel ${id}`,
      },
      status: null,
      openEscalations: 0,
      actor: { status: "held", states: ["waiting"] },
    })),
  },
];
const escalation = (
  id: string,
  raisedAt: number,
  raiser: Escalation["raiser"] = {
    type: "blueprint",
    actorId: "task:a",
    invokeId: "ask",
    entryId: "entry",
  },
): Escalation => ({
  id,
  raisedAt,
  raiser,
  title: "Parcel question",
  question: "Where?",
  choices: [],
  freeText: true,
  destinations: [],
  status: "open",
});
const held = escalation("held", 2, {
  type: "service",
  kind: "held-actor",
  subject: { actorId: "task:a" },
  occurrence: 1,
});
test("closest declared account uses greatest share, stable ties, positive windows and counts declarations", () => {
  const a = account("first", 120),
    b = account("second", 120);
  expect(
    closestToLimit([
      account("undeclared", 200, 100, false),
      a,
      b,
      account("zero", 10, 0),
      { name: "empty", declared: true },
    ]),
  ).toEqual({ closest: { account: a, share: 120 }, count: 4 });
  expect(closestToLimit([account("a", 20), account("b", 85)]).closest?.account.name).toBe("b");
  expect(closestToLimit([])).toEqual({ count: 0 });
  expect(closestToLimit([{ name: "empty", declared: true }, account("zero", 1, 0)])).toEqual({
    count: 2,
  });
});
test("budgets retain every depth, exclude archived subtrees and independently warn at 85 percent", () => {
  const read: PortfolioResponse = {
    commit: null,
    at: "2026-01-01T00:00:00.000Z",
    accounts: [account("sample", 85)],
    items: [
      item("alpha", null, 85),
      item("beta", null, 40),
      item("beta-one", "beta", 85),
      item("deep", "beta-one", 8499, false, 10000),
      item("archived", null, 10, true),
      item("hidden", "archived", 85),
      item("other", null, 0, false, 0),
    ],
    unallocated: [],
    warnings: [],
  };
  const rows = itemBudgets(read);
  expect(rows.map((r) => [r.itemId, r.depth, r.usage?.near])).toEqual([
    ["alpha", 0, true],
    ["beta", 0, false],
    ["beta-one", 1, true],
    ["deep", 2, false],
    ["other", 0, undefined],
  ]);
  expect(rows[0]?.usage).toMatchObject({ used: 85, amount: 100, share: 85 });
  expect(
    itemBudgets({
      ...read,
      items: [
        {
          ...item("alpha", null, 20),
          allocations: [
            ...item("alpha", null, 20).allocations,
            { ...item("x", null, 90).allocations[0]!, account: "second" },
          ],
        },
      ],
      accounts: [...read.accounts, account("second", 90)],
    })[0]?.usage?.account.name,
  ).toBe("second");
});
test("active rows keep order, join tasks and derive held status from summaries or escalations", () => {
  const actors = [actor("child"), actor("task:a")];
  expect(
    activeActorRows(actors, tasks, []).map((r) => [r.actor.actorId, r.status, r.task?.reference]),
  ).toEqual([
    ["child", "running", undefined],
    ["task:a", "held", "example/parcels#1"],
  ]);
  expect(activeActorRows(actors, undefined, [held])[1]?.status).toBe("held");
  expect(activeActorRows(actors, undefined, [{ ...held, status: "answered" }])[1]?.status).toBe(
    "running",
  );
});
test("current thread prefers latest unarchived URL then latest archived URL", () => {
  const a = { threadId: "a", url: "https://example.test/a" },
    b = { threadId: "b", url: "https://example.test/b", archived: true };
  expect(currentThread([a, b, { threadId: "c" }])).toBe(a);
  expect(currentThread([{ ...a, archived: true }, b])).toBe(b);
  expect(currentThread([{ threadId: "c" }])).toBeUndefined();
});
test.each([
  [0, "<1m"],
  [59999, "<1m"],
  [60000, "1m"],
  [3599999, "59m"],
  [3600000, "1h"],
  [172799999, "47h"],
  [172800000, "2d"],
])("elapsed %i is %s", (ms, label) => expect(elapsedLabel(ms)).toBe(label));
test("attention groups escalations, unique held actors and pauses; ignores closed and connected", () => {
  const read = {
    tasks: [...tasks, ...tasks],
    actors: [actor("task:b"), actor("task:a")],
    escalations: [
      held,
      escalation("z", 1),
      escalation("a", 1),
      { ...escalation("closed", 0), status: "answered" as const },
    ],
    environments: [
      {
        name: "north",
        host: "https://example.test",
        status: "connected" as const,
        activeThreads: 0,
        scheduledThreads: 0,
      },
      {
        name: "south",
        host: "https://example.test",
        status: "paused" as const,
        activeThreads: null,
        scheduledThreads: 2,
      },
    ],
  };
  expect(
    needsAttention(read).map((i) =>
      i.kind === "escalation"
        ? i.escalation.id
        : i.kind === "held-actor"
          ? i.actorId
          : i.environment.name,
    ),
  ).toEqual(["a", "z", "held", "task:b", "task:missing", "south"]);
  expect(needsAttention({})).toEqual([]);
  expect(
    needsAttention({
      tasks,
      actors: [actor("task:a", "2026-01-02T00:00:00.000Z"), actor("task:b")],
    }).map((i) => (i.kind === "held-actor" ? i.actorId : "")),
  ).toEqual(["task:b", "task:a", "task:missing"]);
});
test("escalation targets follow each raiser and held tasks link to task pages", () => {
  const cases: [Escalation["raiser"], object][] = [
    [
      { type: "blueprint", actorId: "task:a", invokeId: "ask", entryId: "e" },
      { to: "task", actorId: "task:a" },
    ],
    [{ type: "blueprint", actorId: "child", invokeId: "ask", entryId: "e" }, { to: "actors" }],
    ...(["held-actor", "agent-question"] as const).map(
      (kind) =>
        [
          { type: "service" as const, kind, subject: { actorId: "task:a" }, occurrence: 1 },
          { to: "task", actorId: "task:a" },
        ] as [Escalation["raiser"], object],
    ),
    [
      { type: "service", kind: "intake-failed", subject: { issue: "a" }, occurrence: 1 },
      { to: "task", actorId: "task:a" },
    ],
    [
      { type: "service", kind: "intake-failed", subject: { issue: "unknown" }, occurrence: 1 },
      { to: "board" },
    ],
    ...(["comparator-failed", "stranded-token"] as const).map(
      (kind) =>
        [
          {
            type: "service" as const,
            kind,
            subject: { gate: "blueprints/parcels.yml#ready" },
            occurrence: 1,
          },
          { to: "blueprint", path: "blueprints/parcels.yml" },
        ] as [Escalation["raiser"], object],
    ),
  ];
  for (const [raiser, target] of cases)
    expect(
      needsAttention({ tasks, escalations: [escalation("sample", 1, raiser)] })[0]?.target,
    ).toEqual(target);
  expect(needsAttention({ tasks })[0]?.target).toEqual({ to: "task", actorId: "task:a" });
});
test("item budgets include outstanding reservations in the share", () => {
  const allocated = item("alpha", null, 40);
  const read: PortfolioResponse = {
    commit: null,
    at: new Date(0).toISOString(),
    accounts: [account("sample", 85)],
    items: [{ ...allocated, allocations: [{ ...allocated.allocations[0]!, outstanding: 45 }] }],
    unallocated: [],
    warnings: [],
  };
  expect(itemBudgets(read)[0]?.usage).toMatchObject({ used: 85, share: 85, near: true });
});
test("thread selection uses the last URL in each category", () => {
  const first = { threadId: "first", url: "https://example.test/first" },
    last = { threadId: "last", url: "https://example.test/last" };
  expect(currentThread([first, last])).toBe(last);
  expect(
    currentThread([
      { ...first, archived: true },
      { ...last, archived: true },
    ])?.threadId,
  ).toBe("last");
});
