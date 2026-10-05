// ---
// relationships:
//   implements: intake
// ---
import type { ServiceEscalationHandler, ServiceEscalationRequest } from "../escalations/index.ts";
import type { GitHubIssue } from "../github-source/index.ts";
import type { Store } from "../store/index.ts";
import type { IntakeRecord } from "./types.ts";
import { records } from "./records.ts";
export function intakeFailureQuestion(
  record: IntakeRecord,
  issue: GitHubIssue | undefined,
): ServiceEscalationRequest {
  const failure = record.failure ?? record.startFailure!;
  const identity = issue
    ? `${issue.repository}#${issue.number} (${record.issueNodeId})`
    : record.issueNodeId;
  const header = `Issue: ${identity}\nProject: ${record.project?.nodeId ?? "unknown"}\nBinding: ${record.binding ?? "unknown"}\nCommit: ${record.commit}\n${record.failure ? "Decision" : "Start"} failure: ${failure.kind}\n${failure.message}\n\n\`\`\`json\n`;
  const detail = JSON.stringify(failure.detail, null, 2);
  const closing = "\n```";
  const cut = "\n```\nDetail was cut.";
  const room = 8000 - header.length - cut.length;
  // Avoid a trailing high surrogate when the boundary splits a code point.
  const prefix = detail.slice(0, room).replace(/[\uD800-\uDBFF]$/, "");
  return {
    kind: "intake-failed",
    title: "Intake failed",
    subject: { issue: record.issueNodeId },
    choices: [
      { id: "retry", label: "Retry" },
      { id: "dismiss", label: "Dismiss" },
    ],
    question:
      header +
      (header.length + detail.length + closing.length <= 8000 ? detail + closing : prefix + cut),
  };
}
export function intakeFailedHandler(
  store: Store,
  requeue: (id: string) => void,
): ServiceEscalationHandler {
  const rows = records(store);
  return (escalation) => {
    if (
      escalation.raiser.type !== "service" ||
      escalation.raiser.kind !== "intake-failed" ||
      !escalation.answer ||
      !("choice" in escalation.answer.value) ||
      escalation.answer.value.choice !== "retry"
    )
      return;
    const id = escalation.raiser.subject["issue"]!;
    const record = rows.get(id);
    if (!record || record.status === "started") return;
    rows.retry(id);
    return () => requeue(id);
  };
}
