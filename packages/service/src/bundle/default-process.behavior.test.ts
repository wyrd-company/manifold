// ---
// relationships:
//   verifies: default-task-blueprint
// ---
import { stringify } from "yaml";
import { readFile } from "node:fs/promises";
import { expect, it } from "vite-plus/test";
import { createActor, createMachine, fromCallback, fromPromise } from "xstate";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { createBlueprintLoader } from "../blueprint-loader/index.ts";
async function fixture(failure?: "opening" | "prompting") {
  const text = await readFile(new URL("../../bundle/blueprints/task.yml", import.meta.url), "utf8");
  const revision = memoryRevision("a".repeat(40), {
    "blueprints/task.yml": text,
    "bindings.yml": stringify({
      githubProjects: {
        board: {
          owner: "example-org",
          number: 1,
          item: "work",
          environment: "station",
          t3codeProjects: ["project"],
        },
      },
    }),
    "task-metadata.yml": stringify({
      projects: {
        board: { lifecycle: { field: "Status", options: ["Todo", "In Progress", "Done"] } },
      },
    }),
  });
  const calls = { opening: 0, prompting: 0, escalation: 0, moves: [] as string[] };
  const loader = createBlueprintLoader({
    revisionAt: async () => revision,
    onExpressionError: (error) => {
      throw error;
    },
    implementations: {
      actors: {
        "github-card-move": fromPromise(async ({ input }) => {
          calls.moves.push((input as { status: string }).status);
          return {};
        }),
        "thread-create": fromPromise(async () => {
          calls.opening++;
          if (failure === "opening") throw { kind: "rejected", message: "Parcel thread refused" };
          return { threadId: `thread-${calls.opening}` };
        }),
        "turn-prepare": fromPromise(async () => ({ messageId: `message-${calls.prompting + 1}` })),
        "turn-start": fromPromise(async () => {
          calls.prompting++;
          if (failure === "prompting") throw { kind: "rejected", message: "Parcel turn refused" };
          return { threadId: `thread-${calls.opening}`, messageId: `message-${calls.prompting}` };
        }),
        escalate: fromCallback(() => {
          calls.escalation++;
        }),
      },
      actions: { "follow-thread": () => {} },
      guards: {},
      delays: {},
    },
  });
  const loaded = await loader.version({ commit: revision.commit, path: "blueprints/task.yml" });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  const machine = createMachine(
    {
      ...loaded.blueprint.machine.config,
      context: {
        ...(loaded.blueprint.machine.config.context as Record<string, unknown>),
        manifold: { issue: "issue-1", project: "project-1" },
      },
    },
    loaded.blueprint.machine.implementations as Parameters<typeof createMachine>[1],
  );
  const actor = createActor(machine, {
    input: {
      task: {
        issue: { nodeId: "issue-1", repository: "example-org/parcels", number: 1 },
        fields: { Estimate: { number: 1 } },
      },
      binding: { name: "board", item: "work", environment: "station", t3codeProjects: ["project"] },
      intake: { model: { instanceId: "codex", model: "example-model" } },
    },
  }).start();
  async function working() {
    actor.send({ type: "token" });
    await expect.poll(() => actor.getSnapshot().value).toEqual({ active: { working: "waiting" } });
  }
  const own = { threadId: "thread-1", environment: "station" };
  const settled = {
    type: "t3.turn.settled",
    ...own,
    messageId: "message-1",
    turnId: "turn-1",
    state: "completed",
  };
  return { actor, calls, working, own, settled };
}
// Loading this blueprint takes 6.82 s under paired default-worker gates.
it("matches Project field changes and issue closure against the actor identity", async () => {
  const f = await fixture();
  try {
    f.actor.send({
      type: "github.project-item.field-changed",
      project: { nodeId: "other" },
      field: { name: "Estimate" },
      to: { number: 2 },
    });
    expect(f.actor.getSnapshot().context["fields"]).toEqual({ Estimate: { number: 1 } });
    f.actor.send({
      type: "github.project-item.field-changed",
      project: { nodeId: "project-1" },
      field: { name: "Estimate" },
      to: { number: 2 },
    });
    expect(f.actor.getSnapshot().context["fields"]).toEqual({ Estimate: { number: 2 } });
    f.actor.send({ type: "github.issue.closed", issue: { nodeId: "other" } });
    expect(f.actor.getSnapshot().value).toBe("todo");
    f.actor.send({ type: "github.issue.closed", issue: { nodeId: "issue-1" } });
    expect(f.actor.getSnapshot().value).toBe("closed");
    expect(f.calls.moves).toEqual([]);
  } finally {
    f.actor.stop();
  }
}, 15_000);
// The agent.handoff case spends 5.21 s loading before it can exercise the event.
it.each([
  "agent.handoff",
  "agent.escalated",
  "t3.turn.settled",
  "t3.session.failed",
  "t3.thread.archived",
  "t3.thread.deleted",
])(
  "matches %s against the followed thread",
  async (type) => {
    const f = await fixture();
    try {
      await f.working();
      const event = {
        ...f.settled,
        type,
        threadId: "other",
        handoff: { summary: "Packed" },
        error: "Fixture failure",
      };
      f.actor.send(event);
      expect(f.actor.getSnapshot().value).toEqual({ active: { working: "waiting" } });
      f.actor.send({ ...event, threadId: f.own.threadId });
      if (type === "agent.handoff")
        await expect.poll(() => f.actor.getSnapshot().value).toBe("done");
      else if (type === "agent.escalated")
        expect(f.actor.getSnapshot().value).toEqual({ active: { working: "escalated" } });
      else expect(f.actor.getSnapshot().value).toEqual({ active: "stalled" });
    } finally {
      f.actor.stop();
    }
  },
  15_000,
);
it.each(["t3.thread.archived", "t3.thread.deleted"])(
  "clears only the followed thread on %s during a stall",
  async (type) => {
    const f = await fixture();
    try {
      await f.working();
      f.actor.send(f.settled);
      f.actor.send({ type, threadId: "other" });
      expect(f.actor.getSnapshot().context["thread"]).toBe("thread-1");
      f.actor.send({ type, ...f.own });
      expect(f.actor.getSnapshot().context["thread"]).toBe("");
      f.actor.send({ type: "escalation.answered", answer: { choice: "retry" } });
      await expect
        .poll(() => f.actor.getSnapshot().value)
        .toEqual({ active: { working: "waiting" } });
      expect(f.calls.opening).toBe(2);
    } finally {
      f.actor.stop();
    }
  },
);
it.each(["retry", "done", "stop"])("takes only the selected %s stall answer", async (choice) => {
  const f = await fixture();
  try {
    await f.working();
    f.actor.send(f.settled);
    f.actor.send({ type: "escalation.answered", answer: { choice: "other" } });
    expect(f.actor.getSnapshot().value).toEqual({ active: "stalled" });
    f.actor.send({ type: "escalation.answered", answer: { choice } });
    if (choice === "retry") {
      await expect
        .poll(() => f.actor.getSnapshot().value)
        .toEqual({ active: { working: "waiting" } });
      expect(f.calls.opening).toBe(1);
      expect(f.calls.prompting).toBe(2);
    } else {
      await expect
        .poll(() => f.actor.getSnapshot().value)
        .toBe(choice === "done" ? "done" : "stopped");
      expect(f.calls.moves).toEqual(choice === "done" ? ["In Progress", "Done"] : ["In Progress"]);
    }
  } finally {
    f.actor.stop();
  }
});
it("matches agent escalation answers and ignores asking-turn settlement while escalated", async () => {
  const f = await fixture();
  try {
    await f.working();
    f.actor.send({ type: "agent.escalated", ...f.own });
    f.actor.send({ ...f.settled, threadId: "other" });
    expect(f.actor.getSnapshot().value).toEqual({ active: { working: "escalated" } });
    f.actor.send(f.settled);
    expect(f.actor.getSnapshot().value).toEqual({ active: { working: "escalated" } });
    expect(f.calls.escalation).toBe(0);
    f.actor.send({ type: "agent.escalation.answered", threadId: "other", turnId: "answer-1" });
    expect(f.actor.getSnapshot().value).toEqual({ active: { working: "escalated" } });
    f.actor.send({ type: "agent.escalation.answered", ...f.own, turnId: "answer-1" });
    expect(f.actor.getSnapshot().context["turn"]).toBe("");
    f.actor.send(f.settled);
    expect(f.actor.getSnapshot().value).toEqual({ active: { working: "waiting" } });
    f.actor.send({ ...f.settled, turnId: "answer-1" });
    expect(f.actor.getSnapshot().value).toEqual({ active: "stalled" });
  } finally {
    f.actor.stop();
  }
});
it.each(["opening", "prompting"] as const)("escalates a rejected %s command", async (failure) => {
  const f = await fixture(failure);
  try {
    f.actor.send({ type: "token" });
    await expect.poll(() => f.actor.getSnapshot().value).toEqual({ active: "stalled" });
    expect(f.calls.escalation).toBe(1);
    expect(f.actor.getSnapshot().context["stall"]).toEqual({
      kind: "rejected",
      message: failure === "opening" ? "Parcel thread refused" : "Parcel turn refused",
    });
  } finally {
    f.actor.stop();
  }
});
