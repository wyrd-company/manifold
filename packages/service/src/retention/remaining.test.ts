// ---
// relationships:
//   verifies: retention
// ---
import { expect, test } from "vite-plus/test";
import { openRetention } from "./index.ts";
import { world, day } from "./test-fixtures/world.ts";
import { owners } from "./test-fixtures/owners.ts";
import { pruneDeliveries, pruneRedeliveries } from "../github-source/index.ts";
import { prunableEscalations, pruneEscalation } from "../escalations/index.ts";
import { pruneAnswer, prunableMessages, pruneMessages } from "../agent-tools/index.ts";
import { retirableCreatedProjects, retireCreatedProject } from "../t3code-source/index.ts";

test("GitHub batches respect their source window and each hook's scan cursor", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    const db = w.store.connection.database;
    db.exec("INSERT INTO github_hook_scan VALUES(1,10),(2,1)");
    for (const table of ["github_delivery", "github_redelivery"])
      for (const [id, hook, at] of [
        ["old", 1, 1],
        ["cursor", 2, 1],
        ["after", 2, 2],
        ["recent", 1, 80 * day],
        ["boundary", 3, 70 * day],
        ["no-cursor", 3, 1],
      ] as const)
        db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?)`).run(
          id,
          hook,
          table === "github_delivery" ? "issues" : 1,
          at,
        );
    expect(pruneDeliveries(w.store.connection, { receivedBefore: 70 * day, limit: 1 })).toBe(1);
    expect(pruneDeliveries(w.store.connection, { receivedBefore: 70 * day, limit: 1000 })).toBe(1);
    expect(pruneRedeliveries(w.store.connection, { requestedBefore: 70 * day, limit: 1000 })).toBe(
      2,
    );
    for (const table of ["github_delivery", "github_redelivery"])
      expect(
        db
          .prepare(`SELECT delivery_id FROM ${table} ORDER BY delivery_id`)
          .all()
          .map((r) => r["delivery_id"]),
      ).toEqual(["after", "boundary", "cursor", "recent"]);
    expect(pruneDeliveries(w.store.connection, { receivedBefore: 70 * day, limit: 1000 })).toBe(0);
  } finally {
    await o.close();
    await w.close();
  }
});

test("escalation owner keeps open, pending notification and unhandled rows, and keeps occurrence identity", async () => {
  const w = await world();
  try {
    const request = {
      kind: "comparator-failed" as const,
      subject: { gate: "sorting" },
      question: "Continue?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const first = w.escalations.raise(request);
    w.escalations.withdraw(request);
    const second = w.escalations.raise(request);
    w.escalations.withdraw(request);
    const latest = w.escalations.raise(request);
    w.escalations.withdraw(request);
    const pending = w.escalations.raise({ ...request, subject: { gate: "pending" } });
    w.escalations.withdraw({ ...request, subject: { gate: "pending" } });
    w.store.connection.database
      .prepare(
        "INSERT INTO escalation_notification(escalation_id,destination,purpose,message,status,attempts,next_attempt_at,created_at) VALUES(?,'notice','close','{}','pending',0,1,1)",
      )
      .run(pending.id);
    const unhandled = w.escalations.raise({ ...request, subject: { gate: "unhandled" } });
    w.escalations.answer(unhandled.id, { choice: "yes" }, "api");
    const open = w.escalations.raise({ ...request, subject: { gate: "open" } });
    const candidates = prunableEscalations(w.store.connection, { closedBefore: 2, limit: 100 });
    expect(candidates).toEqual(
      expect.arrayContaining([
        { escalationId: first.id, latestOccurrence: false },
        { escalationId: second.id, latestOccurrence: false },
        { escalationId: latest.id, latestOccurrence: true },
      ]),
    );
    expect(candidates.map((c) => c.escalationId)).not.toContain(pending.id);
    expect(candidates.map((c) => c.escalationId)).not.toContain(unhandled.id);
    for (const id of [pending.id, unhandled.id, open.id])
      expect(pruneEscalation(w.store.connection, id)).toBe("kept");
    expect(pruneEscalation(w.store.connection, first.id)).toEqual({ notifications: 0 });
    expect(pruneEscalation(w.store.connection, second.id)).toEqual({ notifications: 0 });
    const fresh = w.escalations.raise(request);
    expect(fresh.raiser).toMatchObject({ occurrence: 4 });
    expect(w.escalations.answer(first.id, { choice: "yes" }, "api")).toEqual({
      status: "not-found",
    });
    expect(fresh.status).toBe("open");
  } finally {
    await w.close();
  }
});

test("agent owner retains pending/unplaced answers and unread messages at the deletion boundary", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    const db = w.store.connection.database;
    for (const [n, status, placed] of [
      [1, "pending", null],
      [2, "sent", null],
      [3, "sent", 1],
      [4, "failed", 1],
    ] as const)
      db.prepare(
        "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,sequence,error,written_at,settled_at,placed_at) VALUES(?,'station','thread',?,'Answer',?,?,?,?,?,?)",
      ).run(
        String(n).repeat(22),
        `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        status,
        status === "sent" ? 1 : null,
        status === "failed" ? "refused" : null,
        1,
        status === "pending" ? null : 1,
        placed,
      );
    for (const n of [1, 2])
      expect(pruneAnswer(w.store.connection, String(n).repeat(22))).toBe("kept");
    for (const n of [3, 4])
      expect(pruneAnswer(w.store.connection, String(n).repeat(22))).toEqual({ answers: 1 });
    expect(pruneAnswer(w.store.connection, "3".repeat(22))).toEqual({ answers: 0 });
    for (const [n, read, delivered] of [
      [1, 1, 1],
      [2, null, 1],
      [3, null, null],
    ] as const)
      db.prepare(
        "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES(?,'station','thread','sender','Message',1,?,?,?,?,?)",
      ).run(
        `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        delivered,
        delivered ? "reader" : null,
        read,
        read ? "turn" : null,
        read ? 1 : null,
      );
    expect(prunableMessages(w.store.connection, { readBefore: 2, limit: 1000 })).toEqual([
      { sequence: 1, senderActorId: "sender", readerActorId: "reader" },
    ]);
    expect(pruneMessages(w.store.connection, [1, 2, 3])).toBe(1);
    expect(pruneMessages(w.store.connection, [1, 2, 3])).toBe(0);
  } finally {
    await o.close();
    await w.close();
  }
});

test("project owner repeats configured-environment, presence and thread guards when retiring", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    const db = w.store.connection.database;
    db.exec(
      "INSERT INTO t3_environment VALUES('station','server',0,0),('removed-environment','server',0,0)",
    );
    for (const [project, presence, environment] of [
      ["old", "removed", "station"],
      ["unseen", "unseen", "station"],
      ["listed", "listed", "station"],
      ["unconfigured", "removed", "removed-environment"],
    ] as const) {
      o.t3code.recordCreatedProject({
        environment,
        projectId: project,
        actorId: "sender",
        item: "deliveries",
      });
      db.prepare("UPDATE t3_created_project SET presence=? WHERE project_id=?").run(
        presence,
        project,
      );
    }
    const environments = ["station"];
    expect(retirableCreatedProjects(w.store.connection, { environments, limit: 100 })).toEqual([
      { environment: "station", projectId: "old", actorId: "sender" },
    ]);
    db.exec(
      "INSERT INTO t3_thread(environment,thread_id,status,cursor,thread,project_id) VALUES('station','thread','archived',12,'{}','old')",
    );
    expect(
      retireCreatedProject(
        w.store.connection,
        { environment: "station", projectId: "old" },
        { environments },
      ),
    ).toBe("kept");
    expect(
      retireCreatedProject(
        w.store.connection,
        { environment: "removed-environment", projectId: "unconfigured" },
        { environments },
      ),
    ).toBe("kept");
    for (const projectId of ["unseen", "listed"])
      expect(
        retireCreatedProject(
          w.store.connection,
          { environment: "station", projectId },
          { environments },
        ),
      ).toBe("kept");
    expect(retirableCreatedProjects(w.store.connection, { environments, limit: 100 })).toEqual([]);
    expect(o.t3code.createdProject("station", "old")).toBeDefined();
  } finally {
    await o.close();
    await w.close();
  }
});

test("remaining kinds follow approved windows, actor protections, and converge in one run", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    w.save("sender");
    w.save("reader");
    w.save("running", "active");
    const db = w.store.connection.database;
    for (const actor of ["sender", "running"])
      db.prepare(
        "INSERT INTO github_card_move VALUES(?,'move','1','item','field','option','confirmed',?)",
      ).run(actor, actor === "sender" ? 1 : 2);
    db.exec(
      "INSERT INTO github_delivery VALUES('old',1,'issues',1); INSERT INTO github_redelivery VALUES('old',1,1,1); INSERT INTO t3_environment VALUES('station','server',0,0)",
    );
    for (const [project, actor, presence] of [
      ["removed", "sender", "removed"],
      ["unseen", "sender", "unseen"],
      ["active-creator", "running", "removed"],
      ["with-thread", "sender", "removed"],
    ] as const) {
      o.t3code.recordCreatedProject({
        environment: "station",
        projectId: project,
        actorId: actor,
        item: "deliveries",
      });
      db.prepare("UPDATE t3_created_project SET presence=? WHERE project_id=?").run(
        presence,
        project,
      );
    }
    db.exec(
      "INSERT INTO t3_thread(environment,thread_id,status,cursor,thread,project_id) VALUES('station','thread','archived',12,'{}','with-thread')",
    );
    for (const [n, sender, reader] of [
      [1, "sender", "reader"],
      [2, "sender", "running"],
      [3, "running", "reader"],
    ] as const)
      db.prepare(
        "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES(?,'station','thread',?,'Message',1,1,?,1,'turn',?)",
      ).run(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, sender, reader, n);
    const request = {
      kind: "held-actor" as const,
      subject: { actorId: "sender" },
      question: "Continue?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const closed = w.escalations.raise(request);
    w.escalations.withdraw(request);
    const live = w.escalations.raise({ ...request, subject: { actorId: "running" } });
    w.escalations.withdraw({ ...request, subject: { actorId: "running" } });
    w.time(100 * day);
    const r = openRetention({
      ...w,
      configuration: { historyDays: 90, sourceEventDays: { default: 30 }, gateEvaluationDays: 30 },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    expect(await r.prune()).toMatchObject({
      actors: 2,
      deliveries: 1,
      redeliveries: 1,
      escalations: 1,
      messages: 1,
      cardMoves: 1,
      createdProjects: 1,
    });
    expect(w.escalations.get(closed.id)).toBeUndefined();
    expect(w.escalations.get(live.id)).toBeDefined();
    expect(o.t3code.createdProject("station", "removed")).toBeUndefined();
    for (const project of ["unseen", "active-creator", "with-thread"])
      expect(o.t3code.createdProject("station", project)).toBeDefined();
    expect(db.prepare("SELECT cursor FROM t3_thread").get()?.["cursor"]).toBe(12);
    expect(db.prepare("SELECT actor_id FROM github_card_move").get()?.["actor_id"]).toBe("running");
    expect(
      db.prepare("SELECT delivered_to FROM agenttool_message ORDER BY sequence").all(),
    ).toEqual([{ delivered_to: "running" }, { delivered_to: "reader" }]);
    expect(Object.values(await r.prune()).every((n) => n === 0)).toBe(true);
    await r.stop();
  } finally {
    await o.close();
    await w.close();
  }
});

test("forever preserves populated remaining kinds, including already pruned actors' rows", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    w.save("sender");
    w.store.pruneEnded("sender");
    const db = w.store.connection.database;
    db.exec(
      "INSERT INTO github_delivery VALUES('old',1,'issues',1); INSERT INTO github_redelivery VALUES('old',1,1,1); INSERT INTO github_card_move VALUES('sender','move','1','item','field','option','sent',1); INSERT INTO t3_environment VALUES('station','server',0,0)",
    );
    o.t3code.recordCreatedProject({
      environment: "station",
      projectId: "removed",
      actorId: "sender",
      item: "deliveries",
    });
    db.exec("UPDATE t3_created_project SET presence='removed'");
    db.exec(
      "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES('00000000-0000-4000-8000-000000000001','station','thread','sender','Message',1,1,'sender',1,'turn',1)",
    );
    const request = {
      kind: "held-actor" as const,
      subject: { actorId: "sender" },
      question: "Continue?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const question = w.escalations.raise(request);
    w.escalations.withdraw(request);
    w.time(1000 * day);
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: "forever",
        sourceEventDays: { default: 30, github: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    expect(Object.values(await r.prune()).every((n) => n === 0)).toBe(true);
    for (const table of [
      "github_delivery",
      "github_redelivery",
      "github_card_move",
      "agenttool_message",
      "t3_created_project",
    ])
      expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()?.["n"]).toBe(1);
    expect(w.escalations.get(question.id)).toBeDefined();
    await r.stop();
  } finally {
    await o.close();
    await w.close();
  }
});

test("pending answers and settled notification units remain until placement and handling permit pruning", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    w.save("sender");
    const db = w.store.connection.database;
    const request = {
      kind: "agent-question" as const,
      subject: { actorId: "sender", threadId: "thread", environment: "station", turnId: "turn" },
      question: "Continue?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const q = w.escalations.raise(request);
    w.escalations.answer(q.id, { choice: "yes" }, "api");
    db.prepare(
      "INSERT INTO agenttool_question VALUES('station','server','thread','turn',?,'sender',1)",
    ).run(q.id);
    db.prepare(
      "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,written_at) VALUES(?,'station','thread','00000000-0000-4000-8000-000000000001','Answer','pending',1)",
    ).run(q.id);
    w.time(100 * day);
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    expect((await r.prune()).escalations).toBe(0); // handling has not run
    db.prepare("UPDATE escalation SET handled_at=1 WHERE escalation_id=?").run(q.id);
    expect((await r.prune()).escalations).toBe(0); // answer is pending
    db.prepare(
      "UPDATE agenttool_answer SET status='sent',sequence=1,settled_at=1 WHERE escalation_id=?",
    ).run(q.id);
    expect((await r.prune()).escalations).toBe(0); // sent, not placed
    db.prepare("UPDATE agenttool_answer SET placed_at=1 WHERE escalation_id=?").run(q.id);
    db.prepare(
      "INSERT INTO escalation_notification(escalation_id,destination,purpose,message,status,attempts,next_attempt_at,created_at) VALUES(?,'notice','close','{}','pending',0,1,1)",
    ).run(q.id);
    expect((await r.prune()).escalations).toBe(0); // notification pending
    db.prepare(
      "UPDATE escalation_notification SET status='sent',message=NULL,settled_at=1 WHERE escalation_id=?",
    ).run(q.id);
    expect(await r.prune()).toMatchObject({ escalations: 1, notifications: 1, answers: 1 });
    expect(
      db.prepare("SELECT escalation_id FROM agenttool_question").get()?.["escalation_id"],
    ).toBe(q.id);
    expect(w.escalations.get(q.id)).toBeUndefined();
    expect(Object.values(await r.prune()).every((n) => n === 0)).toBe(true);
    await r.stop();
  } finally {
    await o.close();
    await w.close();
  }
});

test("candidate pagination passes protected rows, uses fixed cutoffs, and refreshes placement between batches", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    w.save("sender");
    w.save("reader");
    w.save("running", "active");
    const db = w.store.connection.database;
    db.exec("INSERT INTO t3_environment VALUES('station','server',0,0)");
    const ids: string[] = [];
    for (let n = 0; n < 101; n++) {
      const request = {
        kind: "held-actor" as const,
        subject: { actorId: "sender", slot: String(n) },
        question: "Continue?",
        choices: [{ id: "yes", label: "Yes" }],
      };
      const q = w.escalations.raise(request);
      w.escalations.withdraw(request);
      ids.push(q.id);
      o.t3code.recordCreatedProject({
        environment: "station",
        projectId: `project-${String(n).padStart(3, "0")}`,
        actorId: n % 2 ? "running" : "sender",
        item: "deliveries",
      });
      db.prepare(
        "INSERT INTO github_card_move VALUES(?,'move','1','item','field','option','sent',?)",
      ).run(`actor-${String(n).padStart(3, "0")}`, n + 1);
      w.save(`actor-${String(n).padStart(3, "0")}`, n % 2 ? "active" : "done");
    }
    db.exec("UPDATE t3_created_project SET presence='removed'");
    for (let n = 0; n < 1001; n++) {
      db.prepare("INSERT INTO github_delivery VALUES(?,1,'issues',1)").run(`delivery-${n}`);
      db.prepare("INSERT INTO github_redelivery VALUES(?,1,1,1)").run(`redelivery-${n}`);
      db.prepare(
        "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES(?,'station','thread','sender','Message',1,1,?,1,'turn',?)",
      ).run(
        `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        n % 2 ? "running" : "reader",
        n + 1,
      );
    }
    // This old candidate is not eligible until the yield after the first escalation batch.
    const last = ids.sort().at(-1)!;
    db.prepare(
      "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,sequence,written_at,settled_at) VALUES(?,'station','thread','10000000-0000-4000-8000-000000000001','Answer','sent',1,1,1)",
    ).run(last);
    w.time(100 * day);
    let placed = false;
    const steps: string[] = [];
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: 30 },
        gateEvaluationDays: "forever",
      },
      probe: (step, id) => {
        steps.push(`${step}:${id}`);
      },
      clock: {
        now: w.now,
        setTimer: () => () => {},
        yield(next) {
          w.time(101 * day);
          if (!placed && steps.some((step) => step.startsWith("escalation-pruned:"))) {
            db.prepare("UPDATE agenttool_answer SET placed_at=1 WHERE escalation_id=?").run(last);
            placed = true;
          }
          setImmediate(next);
        },
      },
      log: () => {},
    });
    expect(await r.prune()).toMatchObject({
      actors: 53,
      deliveries: 1001,
      redeliveries: 1001,
      escalations: 101,
      messages: 501,
      cardMoves: 51,
      createdProjects: 51,
    });
    expect(steps.filter((step) => step === "batch-pruned:deliveries")).toHaveLength(2);
    expect(steps.filter((step) => step === "batch-pruned:messages")).toHaveLength(2);
    expect(Object.values(await r.prune()).every((n) => n === 0)).toBe(true);
    await r.stop();
  } finally {
    await o.close();
    await w.close();
  }
});

test("an escalation deletion failure rolls back its answer and notifications as one unit", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    w.save("sender");
    const request = {
      kind: "held-actor" as const,
      subject: { actorId: "sender" },
      question: "Continue?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const q = w.escalations.raise(request);
    w.escalations.withdraw(request);
    const db = w.store.connection.database;
    db.prepare(
      "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,sequence,written_at,settled_at,placed_at) VALUES(?,'station','thread','00000000-0000-4000-8000-000000000001','Answer','sent',1,1,1,1)",
    ).run(q.id);
    db.prepare(
      "INSERT INTO escalation_notification(escalation_id,destination,purpose,status,attempts,next_attempt_at,created_at,settled_at) VALUES(?,'notice','close','sent',1,1,1,1)",
    ).run(q.id);
    db.exec(
      "CREATE TRIGGER fail_prune BEFORE DELETE ON escalation BEGIN SELECT RAISE(ABORT, 'write failed'); END",
    );
    w.time(100 * day);
    const logs: string[] = [];
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: (entry) => {
        logs.push(entry.event);
      },
    });
    await expect(r.prune()).rejects.toThrow("write failed");
    expect(logs).toEqual(["retention-failed"]);
    expect(w.escalations.get(q.id)).toBeDefined();
    expect(db.prepare("SELECT escalation_id FROM agenttool_answer").get()?.["escalation_id"]).toBe(
      q.id,
    );
    expect(
      db.prepare("SELECT escalation_id FROM escalation_notification").get()?.["escalation_id"],
    ).toBe(q.id);
    db.exec("DROP TRIGGER fail_prune");
    expect(await r.prune()).toMatchObject({ escalations: 1, answers: 1, notifications: 1 });
    await r.stop();
  } finally {
    await o.close();
    await w.close();
  }
});

test("kept thread mappings preserve late call attribution and late session mapping across pruning", async () => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  const { openUsage, usageMigrationSteps } = await import("../usage/index.ts");
  const { readThreadProject } = await import("../t3code-source/index.ts");
  const { lintPortfolioDeclaration } = await import("@wyrd-company/manifold-shared");
  const { projectOwnership } = await import("./test-fixtures/project-ownership.ts");
  try {
    w.save("sender");
    const db = w.store.connection.database;
    db.exec("INSERT INTO t3_environment VALUES('station','server',0,0)");
    o.t3code.recordCreatedProject({
      environment: "station",
      projectId: "project",
      actorId: "sender",
      item: "deliveries",
    });
    db.exec(
      "UPDATE t3_created_project SET presence='removed'; INSERT INTO t3_thread(environment,thread_id,status,cursor,thread,project_id) VALUES('station','thread','archived',12,'{}','project')",
    );
    const lint = lintPortfolioDeclaration({
      portfolio: "items: { deliveries: {} }",
      bindings: undefined,
    });
    if (!lint.ok) throw new Error("Invalid fixture portfolio");
    w.store.connection.migrate("usage", usageMigrationSteps);
    const usage = openUsage({
      connection: w.store.connection,
      visits: w.history,
      ledger: w.ledger,
      portfolio: {
        current: () => ({ commit: "portfolio", declaration: lint.declaration }),
        t3codeProject: ({ environment, id }) => {
          const ownership = projectOwnership(o.t3code, environment, id);
          return ownership
            ? { item: ownership.usageItem, via: "created", actorId: ownership.actorId }
            : { item: "other", via: "unbound" };
        },
      },
      threadProject: (environment, thread) =>
        readThreadProject(w.store.connection, environment, thread),
      environments: new Set(["station"]),
      now: w.now,
    });
    w.ledger.credit({
      key: "credit",
      account: "account",
      window: "window",
      opensAt: 0,
      closesAt: 200 * day,
      amount: 100000000,
    });
    expect(
      (
        await usage.apply({
          commit: "accounts",
          read: async (path) =>
            path === "accounts.yml"
              ? "accounts: { account: { unit: usd, kind: api, capacity: { amount: 100, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }, usage: [{ environment: station, provider: codex }] } }"
              : "unit: usd\nmodels: { model: { standard: { input: 1, output: 1 } } }",
        })
      ).status,
    ).toBe("applied");
    const call = (
      key: string,
      session: string,
    ): import("@wyrd-company/manifold-shared").UsageCall => ({
      type: "call",
      key,
      provider: "codex",
      providerSessionId: session,
      unit: { id: session, kind: "session" },
      timestamp: new Date(1).toISOString(),
      model: "model",
      tokens: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        cacheWriteOneHour: 0,
        reasoning: 0,
        webSearchRequests: 0,
      },
      speed: "standard",
      granularity: "call",
      estimated: false,
    });
    const mapping = (session: string) => ({
      provider: "codex" as const,
      providerSessionId: session,
      threadId: "thread",
    });
    usage.push({
      environment: "station",
      threads: [mapping("known")],
      records: [call("before", "known")],
    });
    usage.push({ environment: "station", threads: [], records: [call("late", "unknown")] });
    w.time(100 * day);
    const r = openRetention({
      ...w,
      configuration: { historyDays: 90, sourceEventDays: { default: 30 }, gateEvaluationDays: 30 },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    expect((await r.prune()).createdProjects).toBe(0);
    usage.push({
      environment: "station",
      threads: [mapping("known"), mapping("unknown")],
      records: [call("after", "known")],
    });
    expect(db.prepare("SELECT call_key,item FROM usage_postings ORDER BY call_key").all()).toEqual([
      { call_key: "after", item: "deliveries" },
      { call_key: "before", item: "deliveries" },
      { call_key: "late", item: "other" },
    ]);
    expect(
      db
        .prepare("SELECT call_key,attributed_item FROM usage_attributed_postings ORDER BY call_key")
        .all(),
    ).toEqual([
      { call_key: "after", attributed_item: "deliveries" },
      { call_key: "before", attributed_item: "deliveries" },
      { call_key: "late", attributed_item: "deliveries" },
    ]);
    expect(db.prepare("SELECT cursor FROM t3_thread").get()?.["cursor"]).toBe(12);
    expect(o.t3code.createdProject("station", "project")?.item).toBe("deliveries");
    await r.stop();
  } finally {
    await o.close();
    await w.close();
  }
});

test.each([
  "deliveries",
  "redeliveries",
  "escalations",
  "messages",
  "card-moves",
  "projects",
] as const)("stop at the %s batch boundary retains the next batch", async (kind) => {
  const w = await world();
  const o = owners(w.store, w.router, w.escalations);
  try {
    const db = w.store.connection.database;
    w.save("sender");
    w.store.pruneEnded("sender");
    w.history.prune("sender");
    db.exec("INSERT INTO t3_environment VALUES('station','server',0,0)");
    const size = ["deliveries", "redeliveries", "messages"].includes(kind) ? 1001 : 101;
    for (let n = 0; n < size; n++) {
      if (kind === "deliveries")
        db.prepare("INSERT INTO github_delivery VALUES(?,1,'issues',1)").run(`delivery-${n}`);
      else if (kind === "redeliveries")
        db.prepare("INSERT INTO github_redelivery VALUES(?,1,1,1)").run(`redelivery-${n}`);
      else if (kind === "messages")
        db.prepare(
          "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES(?,'station','thread','sender','Message',1,1,'sender',1,'turn',?)",
        ).run(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, n + 1);
      else if (kind === "card-moves") {
        const actor = `actor-${String(n).padStart(3, "0")}`;
        w.save(actor);
        w.store.pruneEnded(actor);
        db.prepare(
          "INSERT INTO github_card_move VALUES(?,'move','1','item','field','option','sent',?)",
        ).run(actor, n + 1);
      } else if (kind === "projects") {
        o.t3code.recordCreatedProject({
          environment: "station",
          projectId: `project-${n}`,
          actorId: "sender",
          item: "deliveries",
        });
      } else {
        const request = {
          kind: "held-actor" as const,
          subject: { actorId: "sender", slot: String(n) },
          question: "Continue?",
          choices: [{ id: "yes", label: "Yes" }],
        };
        w.escalations.raise(request);
        w.escalations.withdraw(request);
      }
    }
    db.exec("UPDATE t3_created_project SET presence='removed'");
    w.time(100 * day);
    let units = 0,
      stop: Promise<void> | undefined;
    const target =
      kind === "projects"
        ? "project-retired"
        : kind === "escalations"
          ? "escalation-pruned"
          : "batch-pruned";
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: 30 },
        gateEvaluationDays: "forever",
      },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      probe: (step, id) => {
        if (step === target && (target !== "batch-pruned" || id === kind)) {
          units++;
          if (target === "batch-pruned" || units === 100) stop = r.stop();
        }
      },
      log: () => {},
    });
    const result = await r.prune();
    await stop;
    const field =
      kind === "projects" ? "createdProjects" : kind === "card-moves" ? "cardMoves" : kind;
    expect(result[field]).toBe(size - 1);
    const table =
      kind === "projects"
        ? "t3_created_project"
        : kind === "escalations"
          ? "escalation"
          : kind === "messages"
            ? "agenttool_message"
            : kind === "card-moves"
              ? "github_card_move"
              : kind === "deliveries"
                ? "github_delivery"
                : "github_redelivery";
    expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()?.["n"]).toBe(1);
    expect(Object.values(await r.prune()).every((n) => n === 0)).toBe(true);
  } finally {
    await o.close();
    await w.close();
  }
});

test("the runner retains the newest actor-less service occurrence and preserves the next id", async () => {
  const w = await world();
  try {
    const request = {
      kind: "comparator-failed" as const,
      subject: { gate: "sorting" },
      question: "Continue?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const ids: string[] = [];
    for (let n = 0; n < 3; n++) {
      ids.push(w.escalations.raise(request).id);
      w.escalations.withdraw(request);
    }
    w.time(100 * day);
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: { now: w.now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    expect((await r.prune()).escalations).toBe(2);
    expect(w.escalations.list({})).toHaveLength(1);
    expect(w.escalations.get(ids[2]!)?.raiser).toMatchObject({ occurrence: 3 });
    const fresh = w.escalations.raise(request);
    expect(fresh.raiser).toMatchObject({ occurrence: 4 });
    expect(w.escalations.answer(ids[0]!, { choice: "yes" }, "api")).toEqual({
      status: "not-found",
    });
    expect(w.escalations.get(fresh.id)?.status).toBe("open");
    await r.stop();
  } finally {
    await w.close();
  }
});
