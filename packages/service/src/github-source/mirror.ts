// ---
// relationships:
//   implements: github-source-database-schema
//   references: github-event-source
// ---
import type { Store } from "../store/index.ts";
import type {
  GitHubProject,
  GitHubIssue,
  TrackedIssue,
  ObservedField,
  ProjectField,
  ProjectFieldOption,
  ProjectFields,
} from "./types.ts";
import { edgeKey, isTracked } from "./reconcile.ts";
import type { MirrorState } from "./reconcile.ts";
import { fieldChanges, rowsToFields } from "./fields.ts";
import type { ProjectFieldRow } from "./fields.ts";
export interface Pending {
  kind: "issue" | "item" | "project";
  nodeId: string;
  requestedAt: number;
  generation: number;
  projectId: string | undefined;
}
export function createMirror(store: Store, now: () => number) {
  const db = store.connection.database;
  const issue = (row: Record<string, unknown>): GitHubIssue => ({
    nodeId: row["issue_node_id"] as string,
    repository: row["repository"] as string,
    number: row["number"] as number,
    state: row["state"] as GitHubIssue["state"],
    stateReason: row["state_reason"] as GitHubIssue["stateReason"],
    ...(typeof row["title"] === "string" ? { title: row["title"] } : {}),
    ...(typeof row["url"] === "string" ? { url: row["url"] } : {}),
  });
  function read(): MirrorState {
    return {
      issues: new Map(
        db
          .prepare("SELECT * FROM github_issue")
          .all()
          .map((row) => [
            row["issue_node_id"] as string,
            {
              issue: issue(row),
              baselined: Boolean(row["baselined"]),
              present: Boolean(row["present"]),
              revision: row["revision"] as number,
            },
          ]),
      ),
      projects: new Map(
        db
          .prepare("SELECT * FROM github_project")
          .all()
          .map((row) => [
            row["project_node_id"] as string,
            {
              project: {
                nodeId: row["project_node_id"] as string,
                owner: row["owner"] as string,
                number: row["number"] as number,
              },
              closed: Boolean(row["closed"]),
              revision: row["revision"] as number,
            },
          ]),
      ),
      items: new Map(
        db
          .prepare("SELECT * FROM github_item")
          .all()
          .map((row) => [
            row["item_node_id"] as string,
            {
              item: {
                nodeId: row["item_node_id"] as string,
                contentType: row["content_type"] as "issue" | "pull-request" | "draft-issue",
                contentNodeId: row["content_node_id"] as string,
              },
              projectId: row["project_node_id"] as string,
              present: Boolean(row["present"]),
              archived: Boolean(row["archived"]),
              revision: row["revision"] as number,
            },
          ]),
      ),
      fields: new Map(
        db
          .prepare("SELECT * FROM github_field_value")
          .all()
          .map((row) => [
            edgeKey(row["item_node_id"] as string, row["field_node_id"] as string),
            {
              itemId: row["item_node_id"] as string,
              field: { nodeId: row["field_node_id"] as string, name: row["field_name"] as string },
              value:
                row["value"] === null
                  ? null
                  : (JSON.parse(row["value"] as string) as ObservedField["value"]),
              revision: row["revision"] as number,
            },
          ]),
      ),
      dependencies: new Map(
        db
          .prepare("SELECT * FROM github_dependency")
          .all()
          .map((row) => [
            edgeKey(row["blocked_node_id"] as string, row["blocking_node_id"] as string),
            {
              from: row["blocked_node_id"] as string,
              to: row["blocking_node_id"] as string,
              present: Boolean(row["present"]),
              revision: row["revision"] as number,
            },
          ]),
      ),
      subIssues: new Map(
        db
          .prepare("SELECT * FROM github_sub_issue")
          .all()
          .map((row) => [
            edgeKey(row["parent_node_id"] as string, row["sub_issue_node_id"] as string),
            {
              from: row["parent_node_id"] as string,
              to: row["sub_issue_node_id"] as string,
              present: Boolean(row["present"]),
              revision: row["revision"] as number,
            },
          ]),
      ),
    };
  }
  function write(before: MirrorState, after: MirrorState) {
    const count = () => db.prepare("SELECT total_changes() AS count").get()!["count"];
    const previousCount = count();
    for (const [id, row] of after.issues)
      if (JSON.stringify(before.issues.get(id)) !== JSON.stringify(row))
        db.prepare(
          "INSERT INTO github_issue (issue_node_id,repository,number,state,state_reason,baselined,revision,present,title,url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(issue_node_id) DO UPDATE SET repository=excluded.repository, number=excluded.number, state=excluded.state, state_reason=excluded.state_reason, baselined=excluded.baselined, revision=excluded.revision, present=excluded.present,title=excluded.title,url=excluded.url",
        ).run(
          id,
          row.issue.repository,
          row.issue.number,
          row.issue.state,
          row.issue.stateReason,
          Number(row.baselined),
          row.revision,
          Number(row.present),
          row.issue.title ?? null,
          row.issue.url ?? null,
        );
    for (const [id, row] of after.projects)
      if (JSON.stringify(before.projects.get(id)) !== JSON.stringify(row))
        db.prepare(
          "INSERT INTO github_project (project_node_id,owner,number,closed,revision) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_node_id) DO UPDATE SET owner=excluded.owner,number=excluded.number,closed=excluded.closed,revision=excluded.revision",
        ).run(id, row.project.owner, row.project.number, Number(row.closed), row.revision);
    for (const [id, row] of after.items)
      if (JSON.stringify(before.items.get(id)) !== JSON.stringify(row))
        db.prepare(
          "INSERT INTO github_item VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(item_node_id) DO UPDATE SET project_node_id=excluded.project_node_id,content_type=excluded.content_type,content_node_id=excluded.content_node_id,present=excluded.present,archived=excluded.archived,revision=excluded.revision",
        ).run(
          id,
          row.projectId,
          row.item.contentType,
          row.item.contentNodeId,
          Number(row.present),
          Number(row.archived),
          row.revision,
        );
    for (const [id, row] of after.fields)
      if (JSON.stringify(before.fields.get(id)) !== JSON.stringify(row))
        db.prepare(
          "INSERT INTO github_field_value VALUES (?, ?, ?, ?, ?) ON CONFLICT(item_node_id,field_node_id) DO UPDATE SET field_name=excluded.field_name,value=excluded.value,revision=excluded.revision",
        ).run(
          row.itemId,
          row.field.nodeId,
          row.field.name,
          row.value === null ? null : JSON.stringify(row.value),
          row.revision,
        );
    for (const [table, rows, previous, left, right] of [
      [
        "github_dependency",
        after.dependencies,
        before.dependencies,
        "blocked_node_id",
        "blocking_node_id",
      ],
      [
        "github_sub_issue",
        after.subIssues,
        before.subIssues,
        "parent_node_id",
        "sub_issue_node_id",
      ],
    ] as const)
      for (const [id, row] of rows)
        if (JSON.stringify(previous.get(id)) !== JSON.stringify(row))
          db.prepare(
            `INSERT INTO ${table} VALUES (?, ?, ?, ?) ON CONFLICT(${left},${right}) DO UPDATE SET present=excluded.present,revision=excluded.revision`,
          ).run(row.from, row.to, Number(row.present), row.revision);
    return count() !== previousCount;
  }
  const fieldRows = (projectId: string): ProjectFieldRow[] =>
    db
      .prepare("SELECT * FROM github_project_field WHERE project_node_id=? ORDER BY position")
      .all(projectId)
      .map((row) => ({
        projectNodeId: row["project_node_id"] as string,
        fieldNodeId: row["field_node_id"] as string,
        position: row["position"] as number,
        name: row["name"] as string,
        type: row["data_type"] as ProjectField["type"],
        options: JSON.parse(row["options"] as string) as ProjectFieldOption[],
      }));
  return {
    read,
    write,
    projectByNumber(owner: string, number: number): GitHubProject | undefined {
      const row = db
        .prepare("SELECT * FROM github_project WHERE owner=? COLLATE NOCASE AND number=?")
        .get(owner, number);
      if (!row) return undefined;
      return {
        nodeId: row["project_node_id"] as string,
        owner: row["owner"] as string,
        number: row["number"] as number,
      };
    },
    projectFields(projectId: string): ProjectFields | undefined {
      const project = db
        .prepare("SELECT fields_read_at FROM github_project WHERE project_node_id=?")
        .get(projectId);
      const readAt = project?.["fields_read_at"];
      if (readAt === undefined || readAt === null) return undefined;
      return {
        projectNodeId: projectId,
        readAt: readAt as number,
        fields: rowsToFields(fieldRows(projectId)),
      };
    },
    /** Writes a field observation; returns whether any field row changed. */
    observeFields(projectId: string, fields: readonly ProjectField[], readAt: number): boolean {
      const existing = fieldRows(projectId);
      const previous = new Map(existing.map((row) => [row.fieldNodeId, row]));
      const { rows, deletes } = fieldChanges(projectId, fields, existing);
      let changed = false;
      for (const row of rows)
        if (JSON.stringify(previous.get(row.fieldNodeId)) !== JSON.stringify(row)) {
          changed = true;
          db.prepare(
            "INSERT INTO github_project_field VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_node_id,field_node_id) DO UPDATE SET position=excluded.position,name=excluded.name,data_type=excluded.data_type,options=excluded.options",
          ).run(
            projectId,
            row.fieldNodeId,
            row.position,
            row.name,
            row.type,
            JSON.stringify(row.options),
          );
        }
      for (const fieldId of deletes) {
        changed = true;
        db.prepare(
          "DELETE FROM github_project_field WHERE project_node_id=? AND field_node_id=?",
        ).run(projectId, fieldId);
      }
      db.prepare("UPDATE github_project SET fields_read_at=? WHERE project_node_id=?").run(
        readAt,
        projectId,
      );
      return changed;
    },
    /** Writes a single field's row from a write's answer; returns whether a row changed. */
    writeFieldRow(projectId: string, field: ProjectField): boolean {
      const count = () => db.prepare("SELECT total_changes() AS count").get()!["count"];
      const before = count();
      const position =
        (db
          .prepare(
            "SELECT position FROM github_project_field WHERE project_node_id=? AND field_node_id=?",
          )
          .get(projectId, field.nodeId)?.["position"] as number | undefined) ??
        ((db
          .prepare("SELECT max(position) AS max FROM github_project_field WHERE project_node_id=?")
          .get(projectId)?.["max"] as number | null) ?? -1) + 1;
      db.prepare(
        "INSERT INTO github_project_field VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_node_id,field_node_id) DO UPDATE SET position=excluded.position,name=excluded.name,data_type=excluded.data_type,options=excluded.options",
      ).run(
        projectId,
        field.nodeId,
        position,
        field.name,
        field.type,
        JSON.stringify(field.options),
      );
      return count() !== before;
    },
    /** Deletes a single field's row; returns whether a row changed. */
    deleteFieldRow(projectId: string, fieldId: string): boolean {
      return (
        db
          .prepare("DELETE FROM github_project_field WHERE project_node_id=? AND field_node_id=?")
          .run(projectId, fieldId).changes !== 0
      );
    },
    accept(id: string, hookId: number, event: string) {
      return (
        db
          .prepare("INSERT INTO github_delivery VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
          .run(id, hookId, event, now()).changes !== 0
      );
    },
    enqueue(kind: Pending["kind"], nodeId: string, projectId?: string) {
      db.prepare(
        "INSERT INTO github_pending VALUES (?, ?, ?, 1, ?) ON CONFLICT(kind,node_id) DO UPDATE SET generation=github_pending.generation+1,project_node_id=coalesce(excluded.project_node_id,github_pending.project_node_id)",
      ).run(kind, nodeId, now(), projectId ?? null);
    },
    pending(): Pending[] {
      return db
        .prepare("SELECT * FROM github_pending ORDER BY requested_at, kind, node_id")
        .all()
        .map((row) => ({
          kind: row["kind"] as Pending["kind"],
          nodeId: row["node_id"] as string,
          requestedAt: row["requested_at"] as number,
          generation: row["generation"] as number,
          projectId:
            row["project_node_id"] === null ? undefined : (row["project_node_id"] as string),
        }));
    },
    complete(row: Pending) {
      db.prepare("DELETE FROM github_pending WHERE kind=? AND node_id=? AND generation=?").run(
        row.kind,
        row.nodeId,
        row.generation,
      );
    },
    enqueueIssue(id: string, bound: ReadonlyMap<string, GitHubProject>) {
      const state = read();
      if (isTracked(state, bound, id)) {
        this.enqueue("issue", id);
        return;
      }
      const neighbors = [...state.dependencies.values(), ...state.subIssues.values()]
        .filter((row) => row.present && (row.from === id || row.to === id))
        .map((row) => (row.from === id ? row.to : row.from));
      for (const neighbor of new Set(neighbors))
        if (isTracked(state, bound, neighbor)) this.enqueue("issue", neighbor);
    },
    trackedIssueIds(bound: ReadonlyMap<string, GitHubProject>) {
      const state = read();
      return [...state.issues.values()]
        .filter((row) => row.baselined && row.present && isTracked(state, bound, row.issue.nodeId))
        .map((row) => row.issue.nodeId)
        .sort();
    },
    trackedIssue(id: string, bound: ReadonlyMap<string, GitHubProject>): TrackedIssue | undefined {
      const state = read();
      const row = state.issues.get(id);
      if (!row?.baselined || !row.present || !isTracked(state, bound, id)) return undefined;
      const lookup = (node: string) => state.issues.get(node)!.issue;
      return {
        issue: row.issue,
        items: [...state.items.values()]
          .filter(
            (r) =>
              r.present &&
              r.item.contentType === "issue" &&
              r.item.contentNodeId === id &&
              bound.has(r.projectId),
          )
          .map((r) => ({
            project: bound.get(r.projectId)!,
            nodeId: r.item.nodeId,
            archived: r.archived,
            fields: Object.fromEntries(
              [...state.fields.values()]
                .filter((f) => f.itemId === r.item.nodeId)
                .map((f) => [f.field.name, f.value]),
            ),
          })),
        blockedBy: [...state.dependencies.values()]
          .filter((r) => r.present && r.from === id)
          .map((r) => lookup(r.to)),
        blocking: [...state.dependencies.values()]
          .filter((r) => r.present && r.to === id)
          .map((r) => lookup(r.from)),
        subIssues: [...state.subIssues.values()]
          .filter((r) => r.present && r.from === id)
          .map((r) => lookup(r.to)),
        parent: [...state.subIssues.values()]
          .filter((r) => r.present && r.to === id)
          .map((r) => lookup(r.from))[0],
        projects: [
          ...new Set(
            [...state.items.values()]
              .filter((r) => r.present && r.item.contentNodeId === id && bound.has(r.projectId))
              .map((r) => r.projectId),
          ),
        ].map((p) => bound.get(p)!),
      };
    },
    scanCursor(hook: number): number | undefined {
      return db.prepare("SELECT scanned_through FROM github_hook_scan WHERE hook_id=?").get(hook)?.[
        "scanned_through"
      ] as number | undefined;
    },
    saveCursor(hook: number, time: number) {
      db.prepare(
        "INSERT INTO github_hook_scan VALUES (?, ?) ON CONFLICT(hook_id) DO UPDATE SET scanned_through=excluded.scanned_through",
      ).run(hook, time);
    },
    hasDelivery(id: string) {
      return Boolean(db.prepare("SELECT 1 FROM github_delivery WHERE delivery_id=?").get(id));
    },
    hasRedelivery(id: string) {
      return Boolean(db.prepare("SELECT 1 FROM github_redelivery WHERE delivery_id=?").get(id));
    },
    redelivered(id: string, hook: number, attempt: number | bigint) {
      db.prepare("INSERT INTO github_redelivery VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING").run(
        id,
        hook,
        attempt,
        now(),
      );
    },
  };
}
