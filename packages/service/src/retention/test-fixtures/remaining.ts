// ---
// relationships:
//   verifies: retention
// ---
import { world, day } from "./world.ts";
import { owners } from "./owners.ts";
import { fixtureThread } from "../../t3code-source/test-fixtures/server.ts";
export async function remaining(path: string) {
  const w = await world(path);
  const o = owners(w.store, w.router, w.escalations);
  try {
    w.save("parcel-1");
    w.save("parcel-2");
    w.save("active", "active");
    const db = w.store.connection.database;
    w.store.writeInbox(
      { eventId: "pending", topic: "weather.station", payload: { type: "scan" } },
      ["active"],
    );
    const visits = w.history.read("parcel-1")!.visits;
    const active = w.history.read("active")!;
    const questions: string[] = [];
    for (const actorId of ["parcel-1", "parcel-2"]) {
      const request = {
        kind: "held-actor" as const,
        subject: { actorId },
        question: "Continue?",
        choices: [{ id: "yes", label: "Yes" }],
      };
      const q = w.escalations.raise(request);
      w.escalations.withdraw(request);
      questions.push(q.id);
      db.prepare(
        "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,sequence,written_at,settled_at,placed_at) VALUES(?,'station','conversation',?,'Answer','sent',1,1,1,1)",
      ).run(
        q.id,
        `00000000-0000-4000-8000-${actorId === "parcel-1" ? "000000000001" : "000000000002"}`,
      );
    }
    const request = {
      kind: "agent-question" as const,
      subject: {
        actorId: "active",
        environment: "station",
        threadId: "conversation",
        turnId: "pending-turn",
      },
      question: "Which shelf?",
      choices: [{ id: "yes", label: "Yes" }],
    };
    const pending = w.escalations.raise(request);
    w.escalations.answer(pending.id, { choice: "yes" }, "api");
    db.prepare("UPDATE escalation SET handled_at=1 WHERE escalation_id=?").run(pending.id);
    db.prepare(
      "INSERT INTO agenttool_question VALUES('station','server-one','conversation','pending-turn',?,'active',1)",
    ).run(pending.id);
    db.prepare(
      "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,written_at) VALUES(?,'station','conversation','00000000-0000-4000-8000-000000000003','Answer','pending',1)",
    ).run(pending.id);
    const open = w.escalations.raise({
      ...request,
      subject: { ...request.subject, turnId: "open-turn" },
    });
    db.prepare(
      "INSERT INTO agenttool_question VALUES('station','server-one','conversation','open-turn',?,'active',1)",
    ).run(open.id);
    for (let n = 1; n <= 3; n++)
      db.prepare(
        "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES(?,'station','conversation','parcel-1','Message',1,1,?,?,?,?)",
      ).run(
        `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        n === 3 ? "active" : "parcel-2",
        n === 3 ? null : 1,
        n === 3 ? null : "past-turn",
        n === 3 ? null : n,
      );
    for (const actorId of ["parcel-1", "parcel-2", "active"])
      db.prepare(
        "INSERT INTO github_card_move VALUES(?,'move','1','item','field','option',?,?)",
      ).run(
        actorId,
        actorId === "active" ? "confirmed" : "doubtful",
        actorId === "parcel-1" ? 1 : actorId === "parcel-2" ? 2 : 3,
      );
    db.exec("INSERT INTO t3_environment VALUES('station','server-one',0,0)");
    for (const projectId of ["removed-1", "removed-2", "project"]) {
      o.t3code.recordCreatedProject({
        environment: "station",
        projectId,
        actorId: "parcel-1",
        item: "alpha",
      });
      db.prepare("UPDATE t3_created_project SET presence='removed' WHERE project_id=?").run(
        projectId,
      );
    }
    db.prepare(
      "INSERT INTO t3_thread(environment,thread_id,status,cursor,thread,project_id) VALUES('station','conversation','followed',0,?,'project')",
    ).run(JSON.stringify(fixtureThread()));
    for (const id of ["expired-1", "expired-2"]) {
      db.prepare("INSERT INTO github_delivery VALUES(?,1,'issues',1)").run(id);
      db.prepare("INSERT INTO github_redelivery VALUES(?,1,1,1)").run(id);
    }
    w.time(Date.now() - 5 * day);
    db.prepare("INSERT INTO github_delivery VALUES('inside',1,'issues',?)").run(w.now());
    db.prepare("INSERT INTO github_redelivery VALUES('inside',1,1,?)").run(w.now());
    const inside = {
      source: "weather",
      eventId: "inside",
      topics: ["weather.station"],
      event: { type: "scan" },
    };
    w.router.publish(inside);
    const evaluation = w.evaluation();
    return { visits, active, questions, pending: pending.id, open: open.id, inside, evaluation };
  } finally {
    await o.close();
    await w.close();
  }
}
