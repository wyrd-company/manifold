// ---
// relationships:
//   implements: router-events
// ---
import type { EventIssue } from "./types.ts";

const sourcePattern = /^[a-z][a-z0-9-]{0,62}$/u;
// oxlint-disable-next-line eslint/no-control-regex -- The source id contract excludes U+0000.
const idPattern = /^[^\u0000\uD800-\uDFFF]+$/u;
// oxlint-disable-next-line eslint/no-control-regex -- Topic segments exclude control characters.
const topicPattern = /^[^.\s\u0000-\u001F\u007F]+(\.[^.\s\u0000-\u001F\u007F]+)*$/u;
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function validateSourceEvent(value: unknown): EventIssue[] {
  const issues: EventIssue[] = [];
  const issue = (path: string, message: string) => {
    issues.push({ path, message });
  };
  if (!object(value)) return [{ path: "", message: "Expected a source event object" }];
  for (const key of Object.keys(value))
    if (!["source", "eventId", "topics", "event"].includes(key))
      issue(`/${pointer(key)}`, "Unknown source event property");
  const { source, eventId, topics, event } = value;
  if (typeof source !== "string" || !sourcePattern.test(source) || source === "deadline")
    issue("/source", "Expected a source name other than deadline");
  if (typeof eventId !== "string" || !idPattern.test(eventId))
    issue("/eventId", "Expected a non-empty well-formed Unicode id without U+0000");
  if (!Array.isArray(topics)) issue("/topics", "Expected a topic array");
  else {
    if (topics.length === 0) issue("/topics", "Expected at least one topic");
    if (new Set(topics).size !== topics.length) issue("/topics", "Topics must be distinct");
    for (let i = 0; i < topics.length; i++) {
      const topic: unknown = topics[i];
      if (typeof topic !== "string" || !topicPattern.test(topic))
        issue(
          `/topics/${i}`,
          "Expected dot-separated non-empty segments without whitespace or control characters",
        );
      else if (topic.split(".")[0] !== source)
        issue(`/topics/${i}`, "Topic must start with the source name");
    }
  }
  if (!object(event)) issue("/event", "Expected an event object");
  else {
    if (
      typeof event["type"] !== "string" ||
      event["type"].length === 0 ||
      event["type"].startsWith("xstate.")
    )
      issue("/event/type", "Expected a non-empty event type outside the xstate. namespace");
    json(event, "/event", new Set());
  }
  return issues;

  function json(item: unknown, path: string, ancestors: Set<object>): void {
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    )
      return;
    if (typeof item !== "object" || item === null) {
      issue(path, "Expected a JSON value");
      return;
    }
    if (ancestors.has(item)) {
      issue(path, "JSON values cannot contain cycles");
      return;
    }
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    ) {
      issue(path, "Expected a JSON object");
      return;
    }
    ancestors.add(item);
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) json(item[i], `${path}/${i}`, ancestors);
    } else {
      for (const key of Object.keys(item))
        json((item as Record<string, unknown>)[key], `${path}/${pointer(key)}`, ancestors);
    }
    ancestors.delete(item);
  }
}
