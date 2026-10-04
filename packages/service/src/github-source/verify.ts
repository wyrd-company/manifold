// ---
// relationships:
//   implements: github-events
// ---
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { githubEventsSchema } from "@wyrd-company/manifold-shared";
import { GitHubDeliveryError, GitHubSourceError } from "./types.ts";
import type { GitHubConfiguration, WebhookDelivery } from "./types.ts";

const ajv = new Ajv2020();
ajv.addSchema(githubEventsSchema);
const handled = [
  "issues",
  "issue_dependencies",
  "sub_issues",
  "projects_v2_item",
  "projects_v2",
  "push",
];
const validators = new Map(
  handled.map((event) => [
    event,
    ajv.compile({
      $ref: `${githubEventsSchema.$id}#/$defs/delivery-${event.replaceAll("_", "-")}`,
    }),
  ]),
);
export const validEvent = ajv.compile({ $ref: `${githubEventsSchema.$id}#/$defs/event` });
export interface VerifiedDelivery {
  readonly id: string;
  readonly hookId: number;
  readonly event: string;
  readonly payload: Record<string, unknown>;
}
export function verify(
  delivery: WebhookDelivery,
  configuration: GitHubConfiguration,
): VerifiedDelivery | GitHubDeliveryError {
  const headers = new Map(
    Object.entries(delivery.headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const header = (name: string) => {
    const value = headers.get(name);
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };
  const id = header("x-github-delivery");
  const event = header("x-github-event");
  const hook = header("x-github-hook-id");
  const signature = header("x-hub-signature-256");
  if (
    !id ||
    !event ||
    !hook ||
    !signature ||
    !/^\d+$/.test(hook) ||
    !Number.isSafeInteger(Number(hook))
  )
    return new GitHubDeliveryError("malformed", id);
  const configured = Object.values(configuration.owners)
    .flatMap((owner) => owner.hooks)
    .find((entry) => entry.id === Number(hook));
  if (!configured) return new GitHubDeliveryError("unknown-hook", id);
  let secret: Buffer;
  try {
    secret = readFileSync(configured.secretFile);
  } catch (error) {
    throw new GitHubSourceError("secret-file", "Cannot read GitHub hook secret", undefined, error);
  }
  const expected = createHmac("sha256", secret).update(delivery.body).digest();
  if (
    !/^sha256=[0-9a-f]{64}$/.test(signature) ||
    !timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))
  )
    return new GitHubDeliveryError("signature", id);
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(delivery.body).toString("utf8"));
  } catch {
    return new GitHubDeliveryError("malformed", id);
  }
  const validator = validators.get(event);
  if (validator && !validator(payload)) return new GitHubDeliveryError("malformed", id);
  return { id, event, hookId: Number(hook), payload: payload as Record<string, unknown> };
}
export function namedEntities(delivery: VerifiedDelivery) {
  const p = delivery.payload;
  const node = (key: string, field = "node_id") =>
    (p[key] as Record<string, string> | undefined)?.[field];
  switch (delivery.event) {
    case "issues":
      return { issues: [node("issue")!], item: undefined, project: undefined };
    case "issue_dependencies":
      return {
        issues: [node("blocked_issue"), node("blocking_issue")].filter(
          (id): id is string => id !== undefined,
        ),
        item: undefined,
        project: undefined,
      };
    case "sub_issues":
      return {
        issues: [node("parent_issue"), node("sub_issue")].filter(
          (id): id is string => id !== undefined,
        ),
        item: undefined,
        project: undefined,
      };
    case "projects_v2_item":
      return {
        issues: [],
        item: node("projects_v2_item"),
        project: node("projects_v2_item", "project_node_id"),
      };
    case "projects_v2":
      return { issues: [], item: undefined, project: node("projects_v2") };
    default:
      return { issues: [], item: undefined, project: undefined };
  }
}
function normalizedUrl(url: string) {
  return url
    .replace(/\/$/, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
}
export function pushCommit(
  delivery: VerifiedDelivery,
  repository: { readonly url: string; readonly branch: string },
): string | undefined {
  if (delivery.event !== "push") return undefined;
  const p = delivery.payload;
  const repo = p["repository"] as { clone_url: string; html_url: string };
  return p["deleted"] === false &&
    p["ref"] === `refs/heads/${repository.branch}` &&
    [repo.clone_url, repo.html_url].some(
      (url) => normalizedUrl(url) === normalizedUrl(repository.url),
    )
    ? (p["after"] as string)
    : undefined;
}
