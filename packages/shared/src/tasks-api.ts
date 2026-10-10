// ---
// relationships:
//   implements: tasks-api
// ---
import {
  array,
  boolean,
  dateTime,
  integer,
  natural,
  nonempty,
  oneOf,
  shape,
  string,
  uri,
} from "./api-guards.ts";
import type {
  TaskFieldStorage,
  TaskFieldType,
  TaskFieldValue,
} from "./task-metadata-declaration.ts";
import { isEscalation } from "./escalations-api.ts";
import type { Escalation } from "./escalations-api.ts";
export const tasksApiPath = "/api/tasks";
export interface TaskIssue {
  readonly nodeId: string;
  readonly repository: string;
  readonly number: number;
  readonly state: "open" | "closed";
  readonly title?: string;
  readonly url?: string;
}
export interface TaskActor {
  readonly status: "active" | "done" | "stopped" | "held";
  readonly states: readonly string[];
  readonly machine: string;
  readonly blueprint?: { readonly path: string; readonly commit: string };
  readonly environment?: string;
  readonly savedAt: string;
}
export interface TaskSummary {
  readonly actorId: string;
  readonly issue: TaskIssue;
  readonly status: string | null;
  readonly portfolioItem?: string;
  readonly actor?: Pick<TaskActor, "status" | "states">;
  readonly openEscalations: number;
}
export interface BoundProject {
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly item: string;
  readonly lifecycle?: { readonly field: string; readonly options: readonly string[] };
  readonly tasks: readonly TaskSummary[];
}
export interface TaskProjectField {
  readonly name: string;
  readonly type: TaskFieldType;
  readonly storage: TaskFieldStorage["kind"];
  readonly where?: string;
  readonly value: TaskFieldValue;
}
export interface TaskProject {
  readonly fields?: readonly TaskProjectField[];
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly field?: string;
  readonly status: string | null;
}
export interface TaskThread {
  readonly threadId: string;
  readonly environment?: string;
  readonly title?: string;
  readonly url?: string;
  readonly turn?: "running" | "completed" | "interrupted" | "error";
  readonly archived?: boolean;
}
export interface TaskUsage {
  readonly settled: boolean;
  readonly accounts: readonly {
    readonly account: string;
    readonly unit?: "usd";
    readonly estimate: number;
    readonly actual: number;
    readonly variance: number;
    readonly reserved: number;
  }[];
}
export interface Task {
  readonly actorId: string;
  readonly issue: TaskIssue;
  readonly projects: readonly TaskProject[];
  readonly portfolioItem?: string;
  readonly actor?: TaskActor;
  readonly threads: readonly TaskThread[];
  readonly usage: TaskUsage;
  readonly escalations: {
    readonly open: readonly Escalation[];
    readonly recent: readonly Escalation[];
  };
}
export interface TasksResponse {
  readonly projects: readonly BoundProject[];
}
export interface TaskResponse {
  readonly task: Task;
}
const taskFieldValue = (v: unknown) =>
  shape(v, {
    state: oneOf("set"),
    value: (v) => string(v) || (typeof v === "number" && Number.isFinite(v)),
  }) ||
  shape(v, { state: oneOf("empty") }) ||
  shape(v, { state: oneOf("invalid", "unavailable"), detail: string });
const taskProjectField = (v: unknown) =>
  shape(
    v,
    {
      name: string,
      type: oneOf("text", "number", "date", "single-select"),
      storage: oneOf(
        "project-field",
        "issue-field",
        "issue-type",
        "label",
        "milestone",
        "front-matter",
      ),
      value: taskFieldValue,
    },
    { where: string },
  );
const actorId = (v: unknown) => string(v) && /^task:.+$/.test(v);
const number = (v: unknown) => natural(v) && Number(v) > 0;
const status = (v: unknown) => v === null || string(v);
const issue = (v: unknown) =>
  shape(
    v,
    {
      nodeId: nonempty,
      repository: (v) => string(v) && /^[^/]+\/[^/]+$/.test(v),
      number,
      state: oneOf("open", "closed"),
    },
    { title: string, url: uri },
  );
const actorFields = { status: oneOf("active", "done", "stopped", "held"), states: array(nonempty) };
const blueprint = (v: unknown) =>
  shape(v, {
    path: (v) => string(v) && /^blueprints\/.+\.ya?ml$/.test(v),
    commit: (v) => string(v) && /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(v),
  });
const projectFields = { binding: nonempty, owner: nonempty, number };
const summary = (v: unknown) =>
  shape(
    v,
    { actorId, issue, status, openEscalations: natural },
    { portfolioItem: string, actor: (v) => shape(v, actorFields) },
  );
export function isTasksResponse(v: unknown): v is TasksResponse {
  return shape(v, {
    projects: array((v) =>
      shape(
        v,
        { ...projectFields, item: nonempty, tasks: array(summary) },
        { lifecycle: (v) => shape(v, { field: nonempty, options: array(nonempty) }) },
      ),
    ),
  });
}
export function isTaskResponse(v: unknown): v is TaskResponse {
  return shape(v, {
    task: (v) =>
      shape(
        v,
        {
          actorId,
          issue,
          projects: array((v) =>
            shape(
              v,
              { ...projectFields, status },
              { field: nonempty, fields: array(taskProjectField) },
            ),
          ),
          threads: array((v) =>
            shape(
              v,
              { threadId: nonempty },
              {
                environment: string,
                title: string,
                url: uri,
                turn: oneOf("running", "completed", "interrupted", "error"),
                archived: boolean,
              },
            ),
          ),
          usage: (v) =>
            shape(v, {
              settled: boolean,
              accounts: array((v) =>
                shape(
                  v,
                  {
                    account: nonempty,
                    estimate: natural,
                    actual: natural,
                    variance: integer,
                    reserved: natural,
                  },
                  { unit: oneOf("usd") },
                ),
              ),
            }),
          escalations: (v) =>
            shape(v, {
              open: array(isEscalation),
              recent: (v) => array(isEscalation)(v) && (v as unknown[]).length <= 20,
            }),
        },
        {
          portfolioItem: string,
          actor: (v) =>
            shape(
              v,
              {
                ...actorFields,
                machine: nonempty,
                savedAt: dateTime,
              },
              { blueprint, environment: string },
            ),
        },
      ),
  });
}
