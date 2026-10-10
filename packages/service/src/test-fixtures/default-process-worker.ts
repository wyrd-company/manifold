// ---
// relationships:
//   verifies: [default-process, intake, gate-runtime, github-event-source]
// ---
import type { Tasks } from "../tasks/types.ts";
import { createMirror } from "../github-source/mirror.ts";
import { records } from "../intake/records.ts";
import { issueDigest } from "../intake/inputs.ts";
import { blueprintVersionKey } from "@wyrd-company/manifold-shared";
import { startService } from "../service/index.ts";
const config = JSON.parse(process.argv[2]!) as { file: string; crash?: "event" | "command" };
const service = await startService({
  configurationFile: config.file,
  probes: {
    delivery: (step, row) => {
      if (
        config.crash === "event" &&
        step === "sent" &&
        (row.payload as { type: string }).type === "github.project-item.field-changed"
      ) {
        process.send?.({ type: "fault", boundary: "event", eventId: row.eventId });
        process.kill(process.pid, "SIGKILL");
      }
    },
    command: (command) => {
      if (config.crash === "command" && command.implementation === "turn-start") {
        process.send?.({ type: "fault", boundary: "command", commandId: command.commandId });
        process.kill(process.pid, "SIGKILL");
      }
    },
  },
  log: (entry) => process.send?.({ type: "log", entry }),
});
process.send?.({ type: "ready", address: service.http.address() });
process.on("message", (message) => {
  if (typeof message === "object" && message !== null && "id" in message) {
    const request = message as { id: string; action: string; arguments: { size?: number } };
    void (async () => {
      if (request.action === "retention-fixture") {
        const db = service.store.connection.database;
        const question = {
          kind: "held-actor" as const,
          subject: { actorId: "task:I_B" },
          question: "Sample closed question",
          choices: [],
          freeText: true,
        };
        const closed = service.escalations.raise(question);
        service.escalations.withdraw(question);
        db.prepare("UPDATE escalation SET raised_at=1, closed_at=1 WHERE escalation_id=?").run(
          closed.id,
        );
        db.prepare(
          "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,sequence,written_at,settled_at,placed_at) VALUES(?,'workstation','sample-thread','00000000-0000-4000-8000-000000000010','Sample answer','sent',1,1,1,1)",
        ).run(closed.id);
        db.prepare(
          "INSERT INTO escalation_notification(escalation_id,destination,purpose,status,attempts,next_attempt_at,created_at,settled_at) VALUES(?,'sample','close','sent',1,1,1,1)",
        ).run(closed.id);
        for (const [id, reader, readAt] of [
          ["00000000-0000-4000-8000-000000000011", "task:I_B", 1],
          ["00000000-0000-4000-8000-000000000012", "task:I_A", null],
        ] as const)
          db.prepare(
            "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES(?,'workstation','sample-thread','task:I_B',?,1,1,?,?,?,?)",
          ).run(id, "First\0last", reader, readAt, readAt ? "sample-turn" : null, readAt);
        for (const actor of ["task:I_A", "task:I_B"])
          db.prepare(
            "INSERT INTO github_card_move VALUES(?,'sample-move','sample-entry','item-one','F_status','O_progress','confirmed',1)",
          ).run(actor);
        return { closed: closed.id };
      }
      if (request.action === "graph") {
        await service.intake.idle();
        const db = service.store.connection.database;
        const mirror = createMirror(service.store, Date.now);
        const before = mirror.read(),
          after = mirror.read();
        const template = after.issues.get("I_A")!;
        const item = [...after.items.values()].find((r) => r.item.contentNodeId === "I_A")!;
        const ids = Array.from({ length: request.arguments.size! }, (_, i) => `graph-${i}`);
        for (const [i, id] of ids.entries()) {
          after.issues.set(id, {
            ...template,
            issue: { ...template.issue, nodeId: id, number: i + 10 },
          });
          after.items.set(id, { ...item, item: { ...item.item, nodeId: id, contentNodeId: id } });
        }
        for (const [from, to] of [
          [ids[1]!, ids[0]!],
          [ids[2]!, ids[1]!],
          [ids[4]!, ids[3]!],
          [ids[3]!, ids[4]!],
        ] as const)
          after.dependencies.set(`${from}:${to}`, { from, to, present: true, revision: 0 });
        after.subIssues.set("graph-family", {
          from: ids[0]!,
          to: ids[2]!,
          present: true,
          revision: 0,
        });
        service.store.connection.transaction(() => mirror.write(before, after));
        const index = service.github.trackedIssueIndex();
        const row = service.intake.record("I_A")!;
        const intakeRows = records(service.store);
        for (const id of ids)
          intakeRows.decide({
            ...row,
            issueNodeId: id,
            actorId: `task:${id}`,
            status: "failed",
            failure: { kind: "output", message: "Sample failure", detail: null },
            issueDigest: issueDigest(index.get(id)!),
          });
        function measure(run: () => void) {
          let reads = 0;
          const prepare = db.prepare;
          db.prepare = function (sql) {
            if (/\bFROM github_issue$/.test(sql)) reads++;
            return prepare.call(this, sql);
          };
          try {
            run();
            return reads;
          } finally {
            db.prepare = prepare;
          }
        }
        const intakeReads = measure(() => service.intake.mirrorChanged());
        await service.intake.idle();
        const machine = blueprintVersionKey({
          commit: service.revisions.current()!.revision.commit,
          path: "blueprints/graph.yml",
        });
        for (const id of ids)
          service.store.saveSnapshot({
            actorId: `member:${id}`,
            machine,
            snapshot: {
              status: "active",
              value: "waiting",
              context: { manifold: { issue: id, portfolioItem: "work" } },
            },
          });
        const scheduled: string[] = [];
        const gateReads = measure(() =>
          service.gates!.afterDrain({
            schedule: (id) => {
              scheduled.push(id);
            },
          }),
        );
        const evaluations = db
          .prepare(
            "SELECT input FROM gates_evaluation WHERE gate='blueprints/graph.yml#waiting' ORDER BY evaluation_id",
          )
          .all()
          .map((r) => JSON.parse(String(r["input"])));
        return {
          intakeReads,
          gateReads,
          records: ids.map((id) => service.intake.record(id)),
          scheduled,
          evaluations,
          family: index.get(ids[0]!)!.subIssues.map((i) => i.nodeId),
        };
      }
      if (request.action === "prune") return service.retention.prune();
      if (request.action !== "board") throw new Error("Unknown test action");
      const database = service.store.connection.database;
      const mirror = createMirror(service.store, Date.now);
      const before = mirror.read();
      const after = mirror.read();
      const issue = after.issues.get("I_A")!;
      const item = [...after.items.values()].find((row) => row.item.contentNodeId === "I_A")!;
      const extra = Array.from(
        { length: request.arguments.size! - 1 },
        (_, i) => `board-sample-${i}`,
      );
      for (const [index, id] of extra.entries()) {
        after.issues.set(id, {
          ...issue,
          issue: { ...issue.issue, nodeId: id, number: index + 2 },
        });
        after.items.set(id, { ...item, item: { ...item.item, nodeId: id, contentNodeId: id } });
      }
      service.store.connection.transaction(() => mirror.write(before, after));
      // The listener calls list synchronously. Count only that request's reads,
      // so source and intake activity cannot enter the measurement.
      const tasks = (service as typeof service & { tasks: Tasks }).tasks;
      const list = tasks.list;
      let measuring = false;
      tasks.list = (...args) => {
        measuring = true;
        try {
          return list(...args);
        } finally {
          measuring = false;
        }
      };
      let mirrorReads = 0;
      const prepare = database.prepare;
      database.prepare = function (sql) {
        if (measuring && /\bFROM github_issue$/.test(sql)) mirrorReads++;
        return prepare.call(this, sql);
      };
      try {
        const { host, port } = service.http.address();
        const response = await fetch(`http://${host}:${port}/api/tasks`);
        const body = (await response.json()) as { projects: { tasks: unknown[] }[] };
        return {
          status: response.status,
          issues: body.projects.flatMap((project) => project.tasks).length,
          mirrorReads,
        };
      } finally {
        database.prepare = prepare;
        tasks.list = list;
        service.store.connection.transaction(() => {
          for (const id of extra) {
            database.prepare("DELETE FROM github_item WHERE item_node_id=?").run(id);
            database.prepare("DELETE FROM github_issue WHERE issue_node_id=?").run(id);
          }
        });
      }
    })()
      .then((answer) => process.send?.({ id: request.id, answer }))
      .catch((error: unknown) =>
        process.send?.({ id: request.id, answer: { error: String(error) } }),
      );
  }
  if (message === "stop") void service.stop().then(() => process.exit(0));
});
