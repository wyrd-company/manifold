// ---
// relationships:
//   implements: github-event-source
//   references: github-events
// ---
import type {
  GitHubIssue,
  GitHubProject,
  ObservedIssue,
  ObservedItem,
  ObservedField,
  FieldValue,
  ItemReference,
} from "./types.ts";
import type { SourceEvent, RoutedEvent } from "../router/index.ts";
export interface IssueRow {
  issue: GitHubIssue;
  baselined: boolean;
  present: boolean;
  revision: number;
}
export interface EdgeRow {
  from: string;
  to: string;
  present: boolean;
  revision: number;
}
export interface ProjectRow {
  project: GitHubProject;
  closed: boolean;
  revision: number;
}
export interface ItemRow {
  item: ItemReference;
  projectId: string;
  present: boolean;
  archived: boolean;
  revision: number;
}
export interface FieldRow extends ObservedField {
  itemId: string;
  revision: number;
}
export interface MirrorState {
  issues: Map<string, IssueRow>;
  dependencies: Map<string, EdgeRow>;
  subIssues: Map<string, EdgeRow>;
  projects: Map<string, ProjectRow>;
  items: Map<string, ItemRow>;
  fields: Map<string, FieldRow>;
}
export const edgeKey = (from: string, to: string) => `${from}:${to}`;
export function isTracked(
  state: MirrorState,
  bound: ReadonlyMap<string, GitHubProject>,
  id: string,
) {
  return [...state.items.values()].some(
    (row) =>
      row.present &&
      row.item.contentType === "issue" &&
      row.item.contentNodeId === id &&
      bound.has(row.projectId),
  );
}
function event(
  eventId: string,
  ids: readonly string[],
  payload: RoutedEvent,
  project?: string,
): SourceEvent {
  return {
    source: "github",
    eventId,
    topics: [
      ...new Set([
        ...(project ? [`github.project.${project}`] : []),
        ...ids.map((id) => `github.issue.${id}`),
      ]),
    ],
    event: payload,
  };
}
function issueValue(value: GitHubIssue) {
  return {
    nodeId: value.nodeId,
    repository: value.repository,
    number: value.number,
    state: value.state,
    stateReason: value.stateReason,
  };
}
export function reconcileIssue(
  state: MirrorState,
  bound: ReadonlyMap<string, GitHubProject>,
  observed: ObservedIssue,
): SourceEvent[] {
  const id = observed.issue.nodeId;
  const events: SourceEvent[] = [];
  const changed: GitHubIssue[] = [];
  const previouslyBaselined = new Set(
    [...state.issues.values()]
      .filter((row) => row.baselined && isTracked(state, bound, row.issue.nodeId))
      .map((row) => row.issue.nodeId),
  );
  for (const value of [
    observed.issue,
    ...observed.blockedBy,
    ...observed.blocking,
    ...observed.subIssues,
    ...(observed.parent ? [observed.parent] : []),
  ]) {
    const row = state.issues.get(value.nodeId);
    const change = row && row.issue.state !== value.state;
    state.issues.set(value.nodeId, {
      issue: value,
      baselined: row?.baselined ?? false,
      present: value.nodeId === id ? true : (row?.present ?? true),
      revision: (row?.revision ?? 0) + (change ? 1 : 0),
    });
    if (change) changed.push(value);
  }
  const dependencies = [
    ...observed.blockedBy.map((value) => [id, value.nodeId] as const),
    ...observed.blocking.map((value) => [value.nodeId, id] as const),
  ];
  const subIssues = [
    ...observed.subIssues.map((value) => [id, value.nodeId] as const),
    ...(observed.parent ? [[observed.parent.nodeId, id] as const] : []),
  ];
  for (const [rows, edges, prefix] of [
    [state.dependencies, dependencies, "dependency"],
    [state.subIssues, subIssues, "sub-issue"],
  ] as const) {
    const present = new Set(edges.map(([from, to]) => edgeKey(from, to)));
    const candidates = [
      ...new Map([
        ...edges.map(([from, to]) => [edgeKey(from, to), { from, to }] as const),
        ...[...rows]
          .filter(([, r]) => r.from === id || r.to === id)
          .map(([key, row]) => [key, row] as const),
      ]).entries(),
    ];
    for (const [key, { from, to }] of candidates) {
      const old = rows.get(key);
      const nowPresent = present.has(key);
      if ((old?.present ?? false) === nowPresent && old) continue;
      const publish =
        (old?.present ?? false) !== nowPresent &&
        (previouslyBaselined.has(from) || previouslyBaselined.has(to));
      const revision = (old?.revision ?? 0) + (publish ? 1 : 0);
      rows.set(key, { from, to, present: nowPresent, revision });
      if (publish) {
        const first = issueValue(state.issues.get(from)!.issue);
        const second = issueValue(state.issues.get(to)!.issue);
        events.push(
          event(
            `${prefix}:${key}:${revision}`,
            [from, to],
            prefix === "dependency"
              ? {
                  type: `github.dependency.${nowPresent ? "added" : "removed"}`,
                  blocked: first,
                  blocking: second,
                }
              : {
                  type: `github.sub-issue.${nowPresent ? "added" : "removed"}`,
                  parent: first,
                  subIssue: second,
                },
          ),
        );
      }
    }
  }
  state.issues.set(id, { ...state.issues.get(id)!, baselined: true });
  for (const value of changed) {
    const blocks = [...state.dependencies.values()]
      .filter((row) => row.present && row.to === value.nodeId)
      .map((row) => row.from);
    const parent =
      [...state.subIssues.values()].find((row) => row.present && row.to === value.nodeId)?.from ??
      null;
    events.push(
      event(
        `issue:${value.nodeId}:${state.issues.get(value.nodeId)!.revision}`,
        [value.nodeId, ...blocks, ...(parent ? [parent] : [])],
        {
          type: `github.issue.${value.state === "closed" ? "closed" : "reopened"}`,
          issue: issueValue(value),
          blocks,
          parent,
        },
      ),
    );
  }
  return events;
}
export function reconcileItem(
  state: MirrorState,
  id: string,
  observed: ObservedItem | undefined,
): SourceEvent[] {
  const old = state.items.get(id);
  const events: SourceEvent[] = [];
  if (!observed && !old?.present) return events;
  const reference = observed?.item ?? old!.item;
  const projectId = observed?.projectId ?? old!.projectId;
  const project = { ...state.projects.get(projectId)!.project };
  const item = { ...reference };
  const issueIds = reference.contentType === "issue" ? [reference.contentNodeId] : [];
  const added = Boolean(observed && !old?.present);
  const removed = Boolean(!observed && old?.present);
  const archiveChanged = Boolean(observed && old?.present && observed.archived !== old.archived);
  const changed = added || removed || archiveChanged;
  const revision = (old?.revision ?? 0) + (changed ? 1 : 0);
  state.items.set(id, {
    item: reference,
    projectId,
    present: Boolean(observed),
    archived: observed?.archived ?? old!.archived,
    revision,
  });
  if (changed) {
    const payload: RoutedEvent = added
      ? {
          type: "github.project-item.added",
          project,
          item,
          issue: observed!.issue ? issueValue(observed!.issue) : null,
          archived: observed!.archived,
          fields: observed!.fields.map((f) => ({
            field: { ...f.field },
            value: f.value === null ? null : { ...f.value },
          })),
        }
      : {
          type: `github.project-item.${removed ? "removed" : observed!.archived ? "archived" : "restored"}`,
          project,
          item,
        };
    events.push(event(`item:${id}:${revision}`, issueIds, payload, projectId));
  }
  if (!observed) return events;
  const current = new Map(observed.fields.map((f) => [f.field.nodeId, f]));
  for (const row of state.fields.values())
    if (row.itemId === id && !current.has(row.field.nodeId))
      current.set(row.field.nodeId, { field: row.field, value: null });
  for (const [fieldId, value] of current) {
    const key = edgeKey(id, fieldId);
    const previous = state.fields.get(key);
    const from: FieldValue = previous?.value ?? null;
    const fieldChanged = !added && JSON.stringify(from) !== JSON.stringify(value.value);
    const fieldRevision = (previous?.revision ?? 0) + (fieldChanged ? 1 : 0);
    state.fields.set(key, { ...value, itemId: id, revision: fieldRevision });
    if (fieldChanged)
      events.push(
        event(
          `field:${key}:${fieldRevision}`,
          issueIds,
          {
            type: "github.project-item.field-changed",
            project,
            item,
            field: { ...value.field },
            from: from === null ? null : { ...from },
            to: value.value === null ? null : { ...value.value },
          },
          projectId,
        ),
      );
  }
  return events;
}
export function reconcileProject(state: MirrorState, id: string, closed: boolean): SourceEvent[] {
  const old = state.projects.get(id)!;
  if (old.closed === closed) return [];
  const row = { ...old, closed, revision: old.revision + 1 };
  state.projects.set(id, row);
  return [
    event(
      `project:${id}:${row.revision}`,
      [],
      { type: `github.project.${closed ? "closed" : "reopened"}`, project: { ...row.project } },
      id,
    ),
  ];
}
