// ---
// relationships:
//   implements: github-source-database-schema
//   references: github-event-source
// ---
import { isDeepStrictEqual } from "node:util";
import { scopeKey } from "@wyrd-company/manifold-shared";
import type { StorageScope } from "@wyrd-company/manifold-shared";
import type { Store } from "../store/index.ts";
import type {
  GitHubProject,
  IssueContent,
  ScopeConfiguration,
  GitHubIssue,
  TrackedIssue,
  TrackedIssueIndex,
  TrackedItem,
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
function append<T>(groups: Map<string, T[]>, key: string, value: T) {
  const group = groups.get(key);
  if (group) group.push(value);
  else groups.set(key, [value]);
}
export function trackedIssueIndex(
  state: MirrorState,
  bound: ReadonlyMap<string, GitHubProject>,
): TrackedIssueIndex {
  const items = new Map<string, TrackedItem[]>();
  const projects = new Map<string, Map<string, GitHubProject>>();
  const fields = new Map<string, [string, ObservedField["value"]][]>();
  const blockedBy = new Map<string, GitHubIssue[]>();
  const blocking = new Map<string, GitHubIssue[]>();
  const subIssues = new Map<string, GitHubIssue[]>();
  const parents = new Map<string, GitHubIssue>();
  for (const row of state.fields.values()) append(fields, row.itemId, [row.field.name, row.value]);
  for (const row of state.items.values()) {
    if (!row.present || !bound.has(row.projectId)) continue;
    const project = bound.get(row.projectId)!;
    let memberships = projects.get(row.item.contentNodeId);
    if (!memberships) {
      memberships = new Map();
      projects.set(row.item.contentNodeId, memberships);
    }
    memberships.set(row.projectId, project);
    if (row.item.contentType === "issue")
      append(items, row.item.contentNodeId, {
        project,
        nodeId: row.item.nodeId,
        archived: row.archived,
        fields: Object.fromEntries(fields.get(row.item.nodeId) ?? []),
      });
  }
  const lookup = (id: string) => state.issues.get(id)!.issue;
  for (const row of state.dependencies.values()) {
    if (!row.present) continue;
    append(blockedBy, row.from, lookup(row.to));
    append(blocking, row.to, lookup(row.from));
  }
  for (const row of state.subIssues.values()) {
    if (!row.present) continue;
    append(subIssues, row.from, lookup(row.to));
    if (!parents.has(row.to)) parents.set(row.to, lookup(row.from));
  }
  const tracked = new Map<string, TrackedIssue>();
  for (const id of [...state.issues.keys()].sort()) {
    const row = state.issues.get(id)!;
    const memberships = items.get(id);
    if (!row.baselined || !row.present || !memberships) continue;
    tracked.set(id, {
      issue: row.issue,
      content: row.content,
      items: memberships,
      blockedBy: blockedBy.get(id) ?? [],
      blocking: blocking.get(id) ?? [],
      subIssues: subIssues.get(id) ?? [],
      parent: parents.get(id),
      projects: [...projects.get(id)!.values()],
    });
  }
  return tracked;
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
    const labels = new Map<string, IssueContent["labels"][number][]>();
    for (const row of db
      .prepare("SELECT * FROM github_issue_label ORDER BY issue_node_id,position")
      .all())
      append(labels, row["issue_node_id"] as string, {
        nodeId: row["label_node_id"] as string,
        name: row["name"] as string,
      });
    const values = new Map<string, IssueContent["issueFields"][number][]>();
    for (const row of db
      .prepare("SELECT * FROM github_issue_field_value ORDER BY issue_node_id,position")
      .all())
      append(values, row["issue_node_id"] as string, {
        fieldNodeId: row["field_node_id"] as string,
        name: row["name"] as string,
        value: JSON.parse(row["value"] as string) as IssueContent["issueFields"][number]["value"],
      });
    return {
      issues: new Map(
        db
          .prepare("SELECT * FROM github_issue")
          .all()
          .map((row) => [
            row["issue_node_id"] as string,
            {
              issue: issue(row),
              content:
                row["body"] === null
                  ? undefined
                  : {
                      body: row["body"] as string,
                      lastEditedAt: row["last_edited_at"] as number | null,
                      labels: labels.get(row["issue_node_id"] as string) ?? [],
                      issueFields: values.get(row["issue_node_id"] as string) ?? [],
                      milestone:
                        row["milestone"] === null
                          ? null
                          : (JSON.parse(row["milestone"] as string) as IssueContent["milestone"]),
                      issueType:
                        row["issue_type"] === null
                          ? null
                          : (JSON.parse(row["issue_type"] as string) as IssueContent["issueType"]),
                    },
              contentRevision: row["content_revision"] as number,
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
    for (const [id, row] of after.issues) {
      if (!isDeepStrictEqual(before.issues.get(id), row))
        db.prepare(
          "INSERT INTO github_issue (issue_node_id,repository,number,state,state_reason,baselined,revision,content_revision,present,title,url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(issue_node_id) DO UPDATE SET repository=excluded.repository, number=excluded.number, state=excluded.state, state_reason=excluded.state_reason, baselined=excluded.baselined, revision=excluded.revision, content_revision=excluded.content_revision, present=excluded.present,title=excluded.title,url=excluded.url",
        ).run(
          id,
          row.issue.repository,
          row.issue.number,
          row.issue.state,
          row.issue.stateReason,
          Number(row.baselined),
          row.revision,
          row.contentRevision ?? 0,
          Number(row.present),
          row.issue.title ?? null,
          row.issue.url ?? null,
        );
      if (!isDeepStrictEqual(before.issues.get(id)?.content, row.content)) {
        db.prepare(
          "UPDATE github_issue SET body=?, last_edited_at=?, milestone=?, issue_type=? WHERE issue_node_id=?",
        ).run(
          row.content?.body ?? null,
          row.content?.lastEditedAt ?? null,
          row.content?.milestone ? JSON.stringify(row.content.milestone) : null,
          row.content?.issueType ? JSON.stringify(row.content.issueType) : null,
          id,
        );
        db.prepare("DELETE FROM github_issue_label WHERE issue_node_id=?").run(id);
        db.prepare("DELETE FROM github_issue_field_value WHERE issue_node_id=?").run(id);
        row.content?.labels.forEach((label, position) =>
          db
            .prepare("INSERT INTO github_issue_label VALUES(?,?,?,?)")
            .run(id, position, label.nodeId, label.name),
        );
        row.content?.issueFields.forEach((field, position) =>
          db
            .prepare("INSERT INTO github_issue_field_value VALUES(?,?,?,?,?)")
            .run(id, position, field.fieldNodeId, field.name, JSON.stringify(field.value)),
        );
      }
    }
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
    scopeConfiguration(scope: StorageScope): ScopeConfiguration | undefined {
      const key = scopeKey(scope);
      const row = db.prepare("SELECT * FROM github_scope WHERE scope_key=?").get(key);
      if (!row) return;
      const status = row["status"] as ScopeConfiguration["status"];
      const readAt = row["read_at"] as number;
      if (status !== "ready") return { scope, status, readAt, message: row["message"] as string };
      const rows = (table: string) =>
        db.prepare(`SELECT * FROM ${table} WHERE scope_key=? ORDER BY position`).all(key);
      return {
        scope,
        status,
        readAt,
        issueFields: rows("github_issue_field").map((row) => ({
          nodeId: row["node_id"] as string,
          name: row["name"] as string,
          type: row["data_type"] as import("./types.ts").IssueFieldConfiguration["type"],
          options: JSON.parse(row["options"] as string) as ProjectFieldOption[],
        })),
        issueTypes: rows("github_issue_type").map((row) => ({
          nodeId: row["node_id"] as string,
          name: row["name"] as string,
          color: row["color"] as import("./types.ts").ProjectFieldOptionColor | null,
          description: row["description"] as string,
          enabled: Boolean(row["enabled"]),
        })),
        labels: rows("github_label").map((row) => ({
          nodeId: row["node_id"] as string,
          name: row["name"] as string,
          color: row["color"] as string,
          description: row["description"] as string,
        })),
        milestones: rows("github_milestone").map((row) => ({
          nodeId: row["node_id"] as string,
          number: row["number"] as number,
          title: row["title"] as string,
          description: row["description"] as string,
          state: row["state"] as "open" | "closed",
        })),
      };
    },
    observeScope(configuration: ScopeConfiguration) {
      const key = scopeKey(configuration.scope);
      db.prepare(
        "INSERT INTO github_scope VALUES(?,?,?,?,?) ON CONFLICT(scope_key) DO UPDATE SET scope=excluded.scope,status=excluded.status,read_at=excluded.read_at,message=excluded.message",
      ).run(
        key,
        JSON.stringify(configuration.scope),
        configuration.status,
        configuration.readAt,
        configuration.status === "ready" ? null : configuration.message,
      );
      if (configuration.status !== "ready") return;
      for (const table of [
        "github_issue_field",
        "github_issue_type",
        "github_label",
        "github_milestone",
      ])
        db.prepare(`DELETE FROM ${table} WHERE scope_key=?`).run(key);
      configuration.issueFields.forEach((entity, index) =>
        db
          .prepare("INSERT INTO github_issue_field VALUES(?,?,?,?,?,?)")
          .run(key, entity.nodeId, index, entity.name, entity.type, JSON.stringify(entity.options)),
      );
      configuration.issueTypes.forEach((entity, index) =>
        db
          .prepare("INSERT INTO github_issue_type VALUES(?,?,?,?,?,?,?)")
          .run(
            key,
            entity.nodeId,
            index,
            entity.name,
            entity.color,
            entity.description,
            Number(entity.enabled),
          ),
      );
      configuration.labels.forEach((entity, index) =>
        db
          .prepare("INSERT INTO github_label VALUES(?,?,?,?,?,?)")
          .run(key, entity.nodeId, index, entity.name, entity.color, entity.description),
      );
      configuration.milestones.forEach((entity, index) =>
        db
          .prepare("INSERT INTO github_milestone VALUES(?,?,?,?,?,?,?)")
          .run(
            key,
            entity.nodeId,
            index,
            entity.number,
            entity.title,
            entity.description,
            entity.state,
          ),
      );
    },
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
    trackedIssueIndex(bound: ReadonlyMap<string, GitHubProject>): TrackedIssueIndex {
      return trackedIssueIndex(read(), bound);
    },
    trackedIssueIds(bound: ReadonlyMap<string, GitHubProject>) {
      return [...trackedIssueIndex(read(), bound).keys()];
    },
    trackedIssue(id: string, bound: ReadonlyMap<string, GitHubProject>): TrackedIssue | undefined {
      return trackedIssueIndex(read(), bound).get(id);
    },
    trackedIssues(bound: ReadonlyMap<string, GitHubProject>): readonly TrackedIssue[] {
      return [...trackedIssueIndex(read(), bound).values()];
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
