// ---
// relationships:
//   implements: github-event-source
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import { setFrontMatter } from "@wyrd-company/manifold-shared";
import { GitHubWriteError } from "./types.ts";
import type { TaskFieldWrite } from "./types.ts";
import type { StoreConnection } from "../store/index.ts";
export interface ContentEdit {
  readonly at: number;
  readonly own: boolean;
  readonly body: string | null;
}
export interface BodyApi {
  read(): Promise<{ body: string; lastEditedAt: number | null; basisEditedAt?: number }>;
  write(body: string): Promise<void>;
  edits(): Promise<readonly ContentEdit[]>;
}
export function taskWriteRecords(connection: StoreConnection) {
  const db = connection.database;
  const key = (write: TaskFieldWrite) => [write.actorId, write.invokeId, write.entryId] as const;
  function row(write: TaskFieldWrite): Record<string, SQLOutputValue> | undefined {
    const found = db
      .prepare(
        "SELECT CAST(actor_id AS BLOB) AS actor_id, CAST(invoke_id AS BLOB) AS invoke_id, CAST(entry_id AS BLOB) AS entry_id, CAST(issue_node_id AS BLOB) AS issue_node_id, CAST(project_node_id AS BLOB) AS project_node_id, CAST(field AS BLOB) AS field, storage, value, status, attributed, attempt, basis_edited_at, CAST(basis_body AS BLOB) AS basis_body, original_edited_at, CAST(repair_body AS BLOB) AS repair_body, check_state, conflict_edited_at, written_at, sequence FROM github_task_field_write WHERE actor_id=? AND invoke_id=? AND entry_id=?",
      )
      .get(...key(write));
    if (!found) return;
    return {
      ...found,
      actor_id: storedText(found["actor_id"]!),
      invoke_id: storedText(found["invoke_id"]!),
      entry_id: storedText(found["entry_id"]!),
      issue_node_id: storedText(found["issue_node_id"]!),
      project_node_id: storedText(found["project_node_id"]!),
      field: storedText(found["field"]!),
      basis_body: found["basis_body"] === null ? null : storedText(found["basis_body"]!),
      repair_body: found["repair_body"] === null ? null : storedText(found["repair_body"]!),
    };
  }
  return {
    row,
    sent(write: TaskFieldWrite, now: number) {
      db.prepare(
        "INSERT INTO github_task_field_write(actor_id,invoke_id,entry_id,issue_node_id,project_node_id,field,storage,value,status,written_at,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT coalesce(max(sequence),0)+1 FROM github_task_field_write)) ON CONFLICT DO NOTHING",
      ).run(
        ...key(write),
        write.issueNodeId,
        write.projectNodeId,
        write.field,
        JSON.stringify(write.storage),
        JSON.stringify(write.value),
        "sent",
        now,
      );
    },
    status(write: TaskFieldWrite, status: "confirmed" | "refused") {
      db.prepare(
        "UPDATE github_task_field_write SET status=? WHERE actor_id=? AND invoke_id=? AND entry_id=?",
      ).run(status, ...key(write));
    },
    attempt(
      write: TaskFieldWrite,
      attempt: number,
      basis: number | null,
      body: string,
      original: number | null,
      basisBody: string | null,
    ) {
      db.prepare(
        "UPDATE github_task_field_write SET attempt=?,basis_edited_at=?,basis_body=?,repair_body=?,original_edited_at=?,check_state='pending',attributed=0 WHERE actor_id=? AND invoke_id=? AND entry_id=?",
      ).run(attempt, basis, basisBody, body, original, ...key(write));
    },
    check(
      write: TaskFieldWrite,
      state: "none" | "pending" | "passed" | "conflict",
      conflict: number | null = null,
    ) {
      db.prepare(
        "UPDATE github_task_field_write SET check_state=?,conflict_edited_at=? WHERE actor_id=? AND invoke_id=? AND entry_id=?",
      ).run(state, conflict, ...key(write));
    },
    attribute(issue: string, project: string, field: string, value: string | number | null) {
      const record = db
        .prepare(
          "SELECT CAST(actor_id AS BLOB) AS actor_id,status,sequence FROM github_task_field_write WHERE issue_node_id=? AND project_node_id=? AND field=? AND value=? AND status!='refused' AND attributed=0 ORDER BY sequence DESC LIMIT 1",
        )
        .get(issue, project, field, JSON.stringify(value));
      if (!record) return null;
      db.prepare(
        "UPDATE github_task_field_write SET attributed=1 WHERE issue_node_id=? AND project_node_id=? AND field=? AND sequence<=?",
      ).run(issue, project, field, record["sequence"] as number);
      return {
        actorId: storedText(record["actor_id"]!),
        confirmed: record["status"] === "confirmed",
      };
    },
  };
}
/** Run pending checks before consulting today's body, including after restart. */
export async function writeBody(
  write: TaskFieldWrite,
  records: ReturnType<typeof taskWriteRecords>,
  api: BodyApi,
) {
  if (write.storage.kind !== "front-matter") throw new TypeError("Expected front matter storage");
  const key = write.storage.key;
  const conflict = (at: number | null) => {
    records.check(write, "conflict", at);
    throw new GitHubWriteError(
      "body-conflict",
      `Body edit conflict${at === null ? "" : ` at ${at}`}`,
    );
  };
  async function check(): Promise<"retry" | "passed"> {
    const record = records.row(write)!;
    const basis = record["basis_edited_at"] as number | null;
    const history = await api.edits();
    // GitHub timestamps have second precision. A distinct body at the basis,
    // or two newer edits with one timestamp, cannot be ordered safely.
    const simultaneous = history.find(
      (edit) =>
        edit.at === basis && record["basis_body"] !== null && edit.body !== record["basis_body"],
    );
    if (simultaneous) return conflict(simultaneous.at);
    const edits = history
      .filter((edit) => basis === null || edit.at > basis)
      .toSorted((a, b) => a.at - b.at);
    const tied = edits.find((edit, index) => index > 0 && edits[index - 1]!.at === edit.at);
    if (tied) return conflict(tied.at);
    const own = edits.find((edit) => edit.own);
    if (!own) {
      records.check(write, "none");
      return "retry";
    }
    const foreign = edits.filter((edit) => !edit.own);
    if (edits.at(-1) !== own) return conflict(foreign.at(-1)?.at ?? edits.at(-1)?.at ?? null);
    if (!foreign.length) {
      records.check(write, "passed");
      return "passed";
    }
    if (record["attempt"] === 2) return conflict(foreign.at(-1)!.at);
    const replaced = foreign.findLast((edit) => edit.at < own.at);
    if (!replaced || replaced.body === null) return conflict(replaced?.at ?? foreign.at(-1)!.at);
    let body: string;
    try {
      body = setFrontMatter(replaced.body, key, write.value);
    } catch {
      return conflict(replaced.at);
    }
    // Persist the repair body and its distinct basis before the request.
    records.attempt(
      write,
      2,
      own.at,
      body,
      record["original_edited_at"] as number | null,
      record["repair_body"] as string,
    );
    await api.write(body);
    return check();
  }
  const saved = records.row(write)!;
  if (saved["check_state"] === "passed") return;
  if (saved["check_state"] === "conflict")
    return conflict(saved["conflict_edited_at"] as number | null);
  if (
    saved["check_state"] === "pending" ||
    (saved["check_state"] === "none" && (saved["attempt"] as number) > 0)
  ) {
    const outcome = await check();
    if (outcome === "passed") return;
  }
  const row = records.row(write)!;
  if (row["attempt"] === 2 && row["check_state"] === "none") {
    if ((await api.read()).body === row["repair_body"]) {
      records.check(write, "pending");
      throw new GitHubWriteError("transport", "Body edit history has not confirmed the repair");
    }
    records.attempt(
      write,
      2,
      row["basis_edited_at"] as number | null,
      row["repair_body"] as string,
      row["original_edited_at"] as number | null,
      row["basis_body"] as string | null,
    );
    await api.write(row["repair_body"] as string);
    if ((await check()) === "retry")
      throw new GitHubWriteError("transport", "Body repair was not found in edit history");
    return;
  }
  const current = await api.read();
  let body: string;
  try {
    body = setFrontMatter(current.body, key, write.value);
  } catch (error) {
    throw new GitHubWriteError(
      "front-matter-invalid",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (body === current.body) {
    if ((row["attempt"] as number) > 0) {
      records.check(write, "pending");
      throw new GitHubWriteError("transport", "Body edit history has not confirmed the write");
    }
    records.check(write, "passed");
    return;
  }
  records.attempt(
    write,
    1,
    current.basisEditedAt ?? current.lastEditedAt,
    body,
    current.lastEditedAt,
    current.body,
  );
  await api.write(body);
  if ((await check()) === "retry")
    throw new GitHubWriteError("transport", "Body write was not found in edit history");
}
