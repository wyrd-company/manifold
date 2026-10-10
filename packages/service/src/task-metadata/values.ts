// ---
// relationships:
//   implements: task-metadata
// ---
import { parseFrontMatter } from "@wyrd-company/manifold-shared";
import type { ProjectMetadata, TaskField, TaskFieldValue } from "@wyrd-company/manifold-shared";
import type { GitHubProject, TrackedIssue, GitHubFieldValue } from "../github-source/index.ts";
export type TaskFieldValues = Readonly<Record<string, TaskFieldValue>>;
export interface ValuesInput {
  readonly metadata: ProjectMetadata;
  readonly project: GitHubProject;
  readonly issue: TrackedIssue;
  readonly inScope: (repository: string) => boolean;
}
export function fieldValue(
  field: TaskField,
  value: unknown,
  caseInsensitive = false,
): TaskFieldValue {
  if (value === null || value === undefined) return { state: "empty" };
  if (field.type === "single-select" && typeof value === "string") {
    const option = field.options.find((option) =>
      caseInsensitive ? option.name.toLowerCase() === value.toLowerCase() : option.name === value,
    );
    return option
      ? { state: "set", value: option.name }
      : { state: "invalid", detail: "Option is not declared" };
  }
  if (field.type === "number" && typeof value === "number" && Number.isFinite(value))
    return { state: "set", value };
  if (field.type === "text" && typeof value === "string") return { state: "set", value };
  if (field.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value)
      return { state: "set", value };
  }
  return { state: "invalid", detail: `Value is not ${field.type}` };
}
function githubValue(field: TaskField, value: GitHubFieldValue | undefined): TaskFieldValue {
  if (value == null) return { state: "empty" };
  if (value.kind !== field.type)
    return { state: "invalid", detail: "Stored value has another type" };
  return fieldValue(
    field,
    value.kind === "text"
      ? value.text
      : value.kind === "number"
        ? value.number
        : value.kind === "date"
          ? value.date
          : value.kind === "single-select"
            ? value.name
            : undefined,
  );
}
export function taskFieldValues({
  metadata,
  project,
  issue,
  inScope,
}: ValuesInput): TaskFieldValues {
  const result: Record<string, TaskFieldValue> = {};
  for (const [name, field] of Object.entries(metadata.fields)) {
    const storage = field.storage;
    const content = issue.content;
    if (storage.kind === "project-field") {
      const item = issue.items.find((item) => item.project.nodeId === project.nodeId);
      result[name] = item
        ? githubValue(field, item.fields[storage.name])
        : { state: "unavailable", detail: "Issue has no item on the Project" };
      continue;
    }
    if (!content) {
      result[name] = { state: "unavailable", detail: "Issue content has not been read" };
      continue;
    }
    if (
      (storage.kind === "label" || storage.kind === "milestone") &&
      !inScope(issue.issue.repository)
    ) {
      result[name] = {
        state: "unavailable",
        detail: `Repository is outside declared scope: ${issue.issue.repository}`,
      };
      continue;
    }
    if (
      (storage.kind === "issue-field" || storage.kind === "issue-type") &&
      issue.issue.repository.split("/")[0]!.toLowerCase() !== storage.organization.toLowerCase()
    ) {
      result[name] = {
        state: "unavailable",
        detail: `Issue is outside organization: ${storage.organization}`,
      };
      continue;
    }
    if (storage.kind === "issue-field")
      result[name] = githubValue(
        field,
        content.issueFields.find((value) => value.name === storage.name)?.value,
      );
    else if (storage.kind === "issue-type")
      result[name] = fieldValue(field, content.issueType?.name, true);
    else if (storage.kind === "milestone")
      result[name] = fieldValue(field, content.milestone?.title);
    else if (storage.kind === "label") {
      const declared =
        field.type === "single-select"
          ? field.options.map((option) => ({
              label: (storage.prefix + option.name).toLowerCase(),
              value: option.name,
            }))
          : [];
      const labels = content.labels.flatMap((label) =>
        declared
          .filter((option) => option.label === label.name.toLowerCase())
          .map((option) => option.value),
      );
      result[name] =
        labels.length > 1
          ? { state: "invalid", detail: "Issue holds several labels for this field" }
          : fieldValue(field, labels[0]);
    } else {
      const parsed = parseFrontMatter(content.body);
      result[name] =
        parsed.state === "invalid"
          ? { state: "invalid", detail: parsed.message }
          : fieldValue(field, parsed.state === "present" ? parsed.values[storage.key] : undefined);
    }
  }
  return result;
}
