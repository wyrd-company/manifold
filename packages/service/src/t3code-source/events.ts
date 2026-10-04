// ---
// relationships:
//   implements: t3code-thread-events
// ---
import type { RoutedEvent, SourceEvent } from "../router/index.ts";
import type { ThreadChangeEvent } from "./types.ts";
const encoded = (id: string) => encodeURIComponent(id).replaceAll(".", "%2E");
export function threadTopic(environment: string, threadId: string) {
  return `t3.environment.${environment}.thread.${encoded(threadId)}`;
}
export function sourceEvent(
  environment: string,
  server: string,
  threadId: string,
  projectId: string,
  change: RoutedEvent,
): SourceEvent {
  let suffix: string[];
  switch (change.type) {
    case "t3.turn.started":
      suffix = ["turn", String(change["turnId"]), "started"];
      break;
    case "t3.turn.settled":
      suffix = ["turn", String(change["turnId"]), "settled"];
      break;
    case "t3.request.opened":
      suffix = ["request", String(change["requestId"]), "opened"];
      break;
    case "t3.request.resolved":
      suffix = ["request", String(change["requestId"]), "resolved"];
      break;
    case "t3.session.failed":
      suffix = ["session-failed", String(change["failedAt"])];
      break;
    case "t3.thread.archived":
      suffix = ["archived", String(change["archivedAt"])];
      break;
    case "t3.thread.deleted":
      suffix = ["deleted"];
      break;
    default:
      throw new Error(`Unknown thread change: ${change.type}`);
  }
  const event: ThreadChangeEvent = { ...change, environment, threadId, projectId };
  return {
    source: "t3",
    eventId: [environment, server, threadId, ...suffix].map(encoded).join("/"),
    topics: [threadTopic(environment, threadId)],
    event,
  };
}
