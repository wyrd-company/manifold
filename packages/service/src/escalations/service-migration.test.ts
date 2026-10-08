// ---
// relationships:
//   verifies: escalations-database-schema
// ---
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { openEscalations } from "./index.ts";
import { escalationSteps } from "./migrations.ts";
it("accepts service kinds and preserves questions and notifications when reopened", async () => {
  const dir = mkdtempSync(join(tmpdir(), "question-upgrade-"));
  const store = openStore({ path: join(dir, "store.sqlite") });
  let questions: ReturnType<typeof openEscalations> | undefined;
  const declared = new DatabaseSync(":memory:");
  try {
    store.connection.migrate("escalation", escalationSteps.slice(0, 1));
    const db = store.connection.database;
    db.prepare(
      "INSERT INTO escalation(escalation_id,kind,subject,occurrence,title,question,choices,free_text,destinations,key_digest,status,raised_at) VALUES(?, 'held-actor', ?, 1, 'Parcel', 'Retry?', ?, 0, ?, ?, 'open', 100)",
    ).run(
      "a".repeat(22),
      '{"actorId":"parcel"}',
      '[{"id":"retry","label":"Retry"}]',
      '["default"]',
      Buffer.alloc(32, 1),
    );
    db.prepare(
      "INSERT INTO escalation_notification(escalation_id,destination,purpose,message,status,attempts,next_attempt_at,created_at) VALUES(?, 'default', 'ask', '{}', 'pending', 1, 200, 100)",
    ).run("a".repeat(22));
    const old = db.prepare("SELECT * FROM escalation").all();
    const notices = db.prepare("SELECT * FROM escalation_notification").all();
    questions = openEscalations({
      store,
      configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
      tokenFile: () => "",
      handlers: {
        "held-actor": () => {},
        "stranded-token": () => {},
        "intake-failed": () => {},
        "comparator-failed": () => {},
      },
    });
    expect(db.prepare("SELECT * FROM escalation").all()).toEqual(old);
    expect(db.prepare("SELECT * FROM escalation_notification").all()).toEqual(notices);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const raised = questions.raise({
      kind: "intake-failed",
      title: "Intake failed",
      subject: { issue: "I1" },
      question: "Parcel route missing",
      choices: [
        { id: "retry", label: "Retry" },
        { id: "dismiss", label: "Dismiss" },
      ],
    });
    expect(raised.title).toBe("Intake failed");
    expect(questions.answer(raised.id, { choice: "dismiss" }, "api").status).toBe("answered");
    store.connection.migrate("escalation", escalationSteps);
    expect(questions.get(raised.id)?.status).toBe("answered");
    declared.exec(
      readFileSync("../../docs/specifications/escalations-database-schema.sql", "utf8"),
    );
    const shape = (connection: DatabaseSync) =>
      connection
        .prepare(
          "SELECT type, name, sql FROM sqlite_master WHERE name LIKE 'escalation%' ORDER BY name",
        )
        .all()
        .map((row) => ({
          ...row,
          sql: String(row["sql"])
            .replaceAll('"escalation"', "escalation")
            .replace(/\s+/g, " ")
            .trim(),
        }));
    expect(shape(db)).toEqual(shape(declared));
  } finally {
    await questions?.stop();
    declared.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
