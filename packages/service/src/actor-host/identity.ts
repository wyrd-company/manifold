// ---
// relationships:
//   implements: actor-host
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ManifoldIdentity } from "@wyrd-company/manifold-shared";
import { blueprintSchema } from "@wyrd-company/manifold-shared";
import type { LoadedBlueprint } from "../blueprint-loader/index.ts";
import { threadTopic } from "../t3code-source/index.ts";
import { ActorStartError } from "./types.ts";
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const identityValidator = ajv.compile<ManifoldIdentity>({
  $defs: blueprintSchema.$defs,
  $ref: "#/$defs/actor-identity",
});
export function validateInput(
  actorId: string,
  blueprint: LoadedBlueprint,
  input: Record<string, unknown>,
) {
  const { manifold = {}, ...own } = input;
  const issues: { path: string; message: string }[] = [];
  for (const [value, schema, prefix] of [
    [manifold, identityValidator, "/manifold"],
    [own, ajv.compile(blueprint.document.schemas.input ?? true), ""],
  ] as const) {
    if (!schema(value))
      for (const error of schema.errors ?? [])
        issues.push({
          path: `${prefix}${error.instancePath}`,
          message: error.message ?? error.keyword,
        });
  }
  if (issues.length) throw new ActorStartError(actorId, issues);
  return { manifold: manifold as ManifoldIdentity, input: own };
}
export function identityOf(snapshot: { readonly [key: string]: unknown }): ManifoldIdentity {
  const context = snapshot["context"] as Record<string, unknown> | undefined;
  return (context?.["manifold"] ?? {}) as ManifoldIdentity;
}
export function identityTopics(identity: ManifoldIdentity): string[] {
  const topics: string[] = [];
  if (typeof identity.issue === "string") topics.push(`github.issue.${identity.issue}`);
  if (
    typeof identity.environment === "string" &&
    Array.isArray(identity.threads) &&
    identity.threads.every((thread) => typeof thread === "string")
  )
    for (const thread of identity.threads) topics.push(threadTopic(identity.environment, thread));
  return [...new Set(topics)].sort();
}
