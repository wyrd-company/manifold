// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { actorPasses, actorTimeline, actorSequence } from "./actor-model.ts";
import type { ReceivedEvent } from "@wyrd-company/manifold-shared/actors-api";
import { at, sampleInput } from "./test-fixtures.ts";
it("draws a completed process with two confirmed card moves and a handoff", () => {
  const input = sampleInput(),
    timeline = actorTimeline(input),
    sequence = actorSequence(input);
  expect(timeline.rows.map((r) => [r.states[0], r.exit, r.tokens])).toEqual([
    ["waiting", "Status: Packing", 0],
    ["packing", "handoff", 10],
    ["delivered", "", 0],
  ]);
  expect(timeline.rows[1]?.accounts[0]?.unit).toBe("usd");
  expect(timeline.rows.map((row) => row.passes)).toEqual([[], [1], []]);
  expect(timeline.duration).toBe(9000);
  expect(timeline.total.tokens).toBe(10);
  expect(sequence.lifelines.map((l) => l.label)).toEqual([
    "Manifold",
    "T3 Code thread · thread-a",
    "GitHub",
  ]);
  expect(sequence.messages.map((m) => [m.from, m.to, m.label, m.style])).toEqual([
    ["manifold", "github", "Move to Packing · confirmed", "solid"],
    ["manifold", "sample/thread-a", "Start thread", "solid"],
    ["sample/thread-a", "manifold", "handoff", "dashed"],
    ["manifold", "github", "Move to Delivered · confirmed", "solid"],
  ]);
  expect(sequence.messages[2]?.tokens).toBe(10);
});
it("partitions escalation continuation and several passes in one visit without double counting", () => {
  const input = sampleInput(true);
  const event = (
    id: string,
    type: string,
    time: number,
    payload: ReceivedEvent["payload"],
  ): ReceivedEvent => ({
    eventId: id,
    type,
    topic: "agent.sample",
    receivedAt: at(time),
    consumedAt: at(time),
    visit: 2,
    payload,
  });
  input.history = {
    ...input.history,
    events: [
      event("idle", "t3.turn.settled", 4, {
        threadId: "thread-a",
        turnId: "turn-a",
        state: "completed",
      }),
      event("answer", "agent.escalation.answered", 5, {
        environment: "sample",
        threadId: "thread-a",
        turnId: "turn-b",
        answer: { choice: "retry" },
      }),
      event("done", "agent.handoff", 8, { threadId: "thread-a", turnId: "turn-b" }),
    ],
  };
  input.usage = {
    ...input.usage!,
    calls: [
      ...input.usage!.calls,
      {
        usedAt: at(6),
        thread: { environment: "sample", threadId: "thread-a" },
        visit: 2,
        total: 7,
        account: "sample",
        actual: 7,
      },
      {
        usedAt: at(7),
        thread: { environment: "sample", threadId: "thread-a" },
        visit: 2,
        total: null,
        account: null,
        actual: null,
      },
      { usedAt: at(0), thread: null, visit: null, total: 2, account: null, actual: null },
      { usedAt: at(0), thread: null, visit: null, total: null, account: null, actual: null },
      {
        usedAt: at(6),
        thread: { environment: "other", threadId: "thread-a" },
        visit: 2,
        total: 3,
        account: null,
        actual: null,
      },
    ],
    tokens: { ...input.usage!.tokens, total: 22 },
    unmetered: 2,
  };
  const passes = actorPasses(input);
  expect(passes.map((p) => [p.label, p.close, p.tokens, p.unmetered])).toEqual([
    ["Start thread", "idle", 10, 0],
    ["Continue thread", "handoff", 7, 1],
  ]);
  expect(actorSequence(input).unattributed.tokens).toBe(5);
  expect(actorSequence(input).unattributed.unmetered).toBe(1);
  expect(actorSequence(input).messages.map((m) => m.label)).toContain(
    "Continue thread · answer: retry",
  );
  expect(actorTimeline(input).rows[1]?.tone).toBe("warning");
});
it("joins sparse numbered usage runs across a migration with no exit event", () => {
  const input = sampleInput();
  const visits = [1, 2, 3, 4, 5].map((visit) => ({
    visit,
    value: visit === 3 ? "two" : String(visit),
    states: [String(visit)],
    machine: visit < 3 ? "old" : "new",
    enteredAt: at(visit),
    exitedAt: at(visit + 1),
  }));
  visits[1]!.value = "two";
  input.history = {
    ...input.history,
    visits: visits.map((v) => ({
      ...v,
      blueprint: {
        path: "blueprints/sample.yml",
        commit: (v.machine === "old" ? "a" : "b").repeat(40),
      },
    })),
  };
  input.usage = {
    ...input.usage!,
    visits: [
      { ...input.usage!.visits[0]!, visit: 2 },
      {
        ...input.usage!.visits[0]!,
        visit: 3,
        tokens: { ...input.usage!.visits[0]!.tokens, total: 20 },
      },
      { ...input.usage!.visits[0]!, visit: 4 },
    ],
  };
  const rows = actorTimeline(input).rows;
  expect(rows.map((r) => r.tokens)).toEqual([0, 10, 20, 10, 0]);
  expect(rows[2]?.commit).toBe("b".repeat(40));
  input.history = {
    ...input.history,
    visits: input.history.visits.map((v, i) =>
      i === 1 ? { ...v, exitEvent: { type: "sample.changed" } } : v,
    ),
  };
  expect(actorTimeline(input).rows[2]?.commit).toBeUndefined();
});
it("marks held failures, pending events and running passes using the read time", () => {
  const input = sampleInput(true);
  input.history = {
    ...input.history,
    events: [
      ...input.history.events,
      {
        eventId: "pending",
        type: "sample.arrived",
        topic: "sample.one",
        receivedAt: at(9),
        payload: {},
      },
    ],
  };
  expect(actorTimeline(input).rows[1]).toMatchObject({
    exit: "running",
    tone: "waiting",
    end: 10000,
  });
  expect(actorSequence(input).messages.map((m) => m.label)).toEqual([
    "Move to Packing · confirmed",
    "Start thread",
    "running",
    "sample.arrived · pending",
  ]);
  input.held = true;
  expect(actorTimeline(input).rows[1]?.tone).toBe("error");
  input.history = {
    ...input.history,
    actor: { ...input.history.actor, status: "stopped" },
    end: { status: "stopped", endedAt: at(9) },
  };
  expect(actorSequence(input).messages.some((m) => m.label.includes("pending"))).toBe(false);
});
it("dims only the open visit with a running pass and keeps other visits solid", () => {
  const input = sampleInput(true);
  input.history = {
    ...input.history,
    visits: [
      input.history.visits[0]!,
      { ...input.history.visits[1]!, exitedAt: at(4) },
      { visit: 3, value: "checking", states: ["checking"], machine: "sample", enteredAt: at(4) },
    ],
  };
  expect(actorTimeline(input).rows.map((row) => row.tone)).toEqual(["edge", "edge", "waiting"]);
  input.history = { ...input.history, commands: [] };
  expect(actorTimeline(input).rows.map((row) => row.tone)).toEqual(["edge", "edge", "primary"]);
});
it("keeps an open visit running after an answer and labels the answer only after exit", () => {
  const input = sampleInput(true);
  input.escalations = [
    {
      id: "sample-question",
      raiser: { type: "blueprint", actorId: "task:parcel", invokeId: "question", entryId: "one" },
      title: "Delivery choice",
      question: "Continue?",
      choices: [{ id: "continue", label: "Continue" }],
      freeText: true,
      destinations: [],
      status: "answered",
      raisedAt: 3000,
      closedAt: 5000,
      answer: { value: { choice: "continue" }, channel: "api", at: 5000 },
    },
  ];
  expect(actorTimeline(input).rows[1]?.exit).toBe("running");
  input.history = {
    ...input.history,
    visits: input.history.visits.map((visit) =>
      visit.visit === 2 ? { ...visit, exitedAt: at(6) } : visit,
    ),
  };
  expect(actorTimeline(input).rows[1]?.exit).toBe("answered: Continue");
});
it("closes failed turns, labels external changes and XState invokes, and suppresses settles after handoff", () => {
  const input = sampleInput();
  input.history = {
    ...input.history,
    events: [
      ...input.history.events,
      {
        eventId: "late-settle",
        type: "t3.turn.settled",
        topic: "t3.sample",
        receivedAt: at(8),
        consumedAt: at(8),
        visit: 3,
        payload: {
          environment: "sample",
          threadId: "thread-a",
          turnId: "turn-a",
          state: "completed",
        },
      },
      {
        eventId: "person",
        type: "github.project-item.field-changed",
        topic: "github.project.sample",
        receivedAt: at(8),
        consumedAt: at(8),
        visit: 3,
        payload: {
          field: { name: "Status" },
          to: { kind: "single-select", name: "Delivered" },
          movedBy: null,
        },
      },
      {
        eventId: "other",
        type: "github.project-item.field-changed",
        topic: "github.project.sample",
        receivedAt: at(8),
        consumedAt: at(8),
        visit: 3,
        payload: {
          field: { name: "Status" },
          to: { kind: "text", text: "Packed" },
          movedBy: { actorId: "another", confirmed: true },
        },
      },
      {
        eventId: "unconfirmed",
        type: "github.project-item.field-changed",
        topic: "github.project.sample",
        receivedAt: at(8),
        consumedAt: at(8),
        visit: 3,
        payload: {
          field: { name: "Status" },
          to: { kind: "single-select", name: "Delivered" },
          movedBy: { actorId: "task:parcel", confirmed: false },
        },
      },
    ],
  };
  const messages = actorSequence(input).messages;
  expect(messages.some((m) => m.id === "late-settle")).toBe(false);
  expect(messages.find((m) => m.id === "person")).toMatchObject({
    from: "github",
    to: "manifold",
    style: "dashed",
    label: "Status: Delivered · by a person",
  });
  expect(messages.find((m) => m.id === "other")?.label).toBe("Status: Packed · by another");
  expect(messages.find((m) => m.id === "unconfirmed")).toMatchObject({
    tone: "warning",
    label: "Move to Delivered · unconfirmed",
  });
  input.history = {
    ...input.history,
    visits: input.history.visits.map((v, i) =>
      i === 1 ? { ...v, exitEvent: { type: "xstate.error.actor.pack" } } : v,
    ),
  };
  expect(actorTimeline(input).rows[1]?.exit).toBe("pack failed");
  const failed = sampleInput(true);
  failed.held = true;
  failed.history = {
    ...failed.history,
    events: [
      {
        eventId: "error",
        type: "t3.turn.settled",
        topic: "t3.sample",
        receivedAt: at(4),
        consumedAt: at(4),
        visit: 2,
        payload: { threadId: "thread-a", turnId: "turn-a", state: "error" },
      },
    ],
  };
  expect(actorPasses(failed)[0]).toMatchObject({ close: "error", running: false });
  expect(actorTimeline(failed).rows[1]?.tone).toBe("error");
  expect(actorSequence(failed).messages.find((m) => m.id === "error")).toMatchObject({
    tone: "warning",
    tokens: 10,
  });
});
it("keeps turn identities and threads separate and leaves unknown commands open", () => {
  const input = sampleInput(true);
  input.history = {
    ...input.history,
    commands: input.history.commands.map((c) =>
      c.kind === "turn-start" ? (({ turnId: _turnId, ...command }) => command)(c) : c,
    ),
    events: [
      {
        eventId: "unrelated",
        type: "agent.handoff",
        topic: "agent.sample",
        receivedAt: at(4),
        consumedAt: at(4),
        visit: 2,
        payload: { threadId: "other", turnId: "turn-a" },
      },
    ],
  };
  expect(actorPasses(input)[0]).toMatchObject({ running: true });
  expect(actorPasses(input)[0]?.close).toBeUndefined();
});

it("closes only a consumed event from the same thread and turn", () => {
  const input = sampleInput(true);
  input.history = {
    ...input.history,
    events: [
      {
        eventId: "wrong-thread",
        type: "agent.handoff",
        topic: "agent.sample",
        receivedAt: at(4),
        consumedAt: at(4),
        visit: 2,
        payload: { environment: "other", threadId: "thread-a", turnId: "turn-a" },
      },
      {
        eventId: "wrong-turn",
        type: "agent.handoff",
        topic: "agent.sample",
        receivedAt: at(4),
        consumedAt: at(4),
        visit: 2,
        payload: { environment: "sample", threadId: "thread-a", turnId: "turn-other" },
      },
      {
        eventId: "pending-handoff",
        type: "agent.handoff",
        topic: "agent.sample",
        receivedAt: at(4),
        payload: { environment: "sample", threadId: "thread-a", turnId: "turn-a" },
      },
    ],
  };
  expect(actorPasses(input)[0]).toMatchObject({ running: true });
  expect(actorPasses(input)[0]?.close).toBeUndefined();
});

it("shows project creation on its project lifeline without a pass", () => {
  const input = sampleInput();
  input.history = {
    ...input.history,
    commands: [
      {
        commandId: "create-project",
        kind: "project-create",
        projectId: "project-a",
        environment: "sample",
        invokeId: "create",
        entryId: "one",
        sentAt: at(1),
      },
      ...input.history.commands,
    ],
  };
  const sequence = actorSequence(input);
  expect(sequence.messages.find((m) => m.id === "create-project")).toMatchObject({
    from: "manifold",
    to: "project:sample/project-a",
    label: "Create project · not accepted",
    style: "solid",
    tone: "warning",
  });
  expect(sequence.lifelines).toContainEqual({
    id: "project:sample/project-a",
    label: "T3 Code project · project-",
  });
  expect(actorPasses(input)).toHaveLength(1);
  input.history = {
    ...input.history,
    commands: input.history.commands.map((c) =>
      c.kind === "project-create" ? { ...c, acceptedAt: at(2) } : c,
    ),
  };
  expect(actorSequence(input).messages.find((m) => m.id === "create-project")).toMatchObject({
    label: "Create project",
    tone: "edge",
  });
});
