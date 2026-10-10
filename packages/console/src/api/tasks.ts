// ---
// relationships:
//   implements: [tasks-api, operator-console, escalation-contract]
// ---
import {
  tasksApiPath,
  isTasksResponse,
  isTaskResponse,
} from "@wyrd-company/manifold-shared/tasks-api";
import type { BoundProject, Task } from "@wyrd-company/manifold-shared/tasks-api";
import {
  escalationsApiPath,
  isEscalationAnswerResponse,
} from "@wyrd-company/manifold-shared/escalations-api";
import type { Escalation, EscalationAnswer } from "@wyrd-company/manifold-shared/escalations-api";
type Failed = { kind: "failed"; message: string };
export type TasksResult = { kind: "ok"; projects: readonly BoundProject[] } | Failed;
export type TaskResult = { kind: "ok"; task: Task } | { kind: "missing" } | Failed;
export type AnswerResult =
  | { kind: "answered" | "closed"; escalation: Escalation }
  | { kind: "invalid"; message: string }
  | { kind: "missing" }
  | Failed;
const failed = (subject: string): Failed => ({
  kind: "failed",
  message: `Cannot ${subject}. Check the connection and try again.`,
});
export function mapTasksResult(status: number, body: unknown): TasksResult {
  return status === 200 && isTasksResponse(body)
    ? { kind: "ok", projects: body.projects }
    : failed("read tasks");
}
export function mapTaskResult(status: number, body: unknown): TaskResult {
  return status === 404
    ? { kind: "missing" }
    : status === 200 && isTaskResponse(body)
      ? { kind: "ok", task: body.task }
      : failed("read task");
}
export function mapAnswerResult(status: number, body: unknown): AnswerResult {
  if (status === 200 && isEscalationAnswerResponse(body))
    return { kind: body.outcome, escalation: body.escalation };
  if (status === 404) return { kind: "missing" };
  if (
    status === 400 &&
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  )
    return { kind: "invalid", message: body.error };
  return failed("answer escalation");
}
export async function fetchTasks(): Promise<TasksResult> {
  try {
    const response = await fetch(tasksApiPath);
    return mapTasksResult(response.status, response.status === 200 ? await response.json() : null);
  } catch {
    return failed("read tasks");
  }
}
export async function fetchTask(actorId: string): Promise<TaskResult> {
  try {
    const response = await fetch(`${tasksApiPath}/${encodeURIComponent(actorId)}`);
    return mapTaskResult(response.status, response.status === 200 ? await response.json() : null);
  } catch {
    return failed("read task");
  }
}
export async function answerEscalation(
  id: string,
  answer: EscalationAnswer,
): Promise<AnswerResult> {
  try {
    const response = await fetch(`${escalationsApiPath}/${encodeURIComponent(id)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answer),
    });
    return mapAnswerResult(
      response.status,
      [200, 400].includes(response.status) ? await response.json() : null,
    );
  } catch {
    return failed("answer escalation");
  }
}
