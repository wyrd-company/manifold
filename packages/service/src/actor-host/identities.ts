// ---
// relationships:
//   implements: actor-host
// ---
import type { ManifoldIdentity } from "@wyrd-company/manifold-shared";
import type { ActorRecord } from "../router/index.ts";
import { identityOf } from "./identity.ts";

export function identityIndex() {
  const identities = new Map<string, ManifoldIdentity>();
  const issues = new Map<string, Set<string>>();
  const environments = new Map<string, Map<string, Set<string>>>();
  function remove(actorId: string) {
    const identity = identities.get(actorId);
    if (!identity) return;
    if (identity.issue) {
      const members = issues.get(identity.issue)!;
      members.delete(actorId);
      if (!members.size) issues.delete(identity.issue);
    }
    if (identity.environment) {
      const threads = environments.get(identity.environment);
      for (const thread of identity.threads ?? []) {
        const members = threads?.get(thread);
        members?.delete(actorId);
        if (!members?.size) threads?.delete(thread);
      }
      if (!threads?.size) environments.delete(identity.environment);
    }
    identities.delete(actorId);
  }
  return {
    saved(actor: ActorRecord) {
      if (actor.snapshot.status === "error") return;
      remove(actor.actorId);
      if (actor.snapshot.status !== "active") return;
      const identity = structuredClone(identityOf(actor.snapshot));
      identities.set(actor.actorId, identity);
      if (identity.issue) {
        const members = issues.get(identity.issue) ?? new Set<string>();
        members.add(actor.actorId);
        issues.set(identity.issue, members);
      }
      if (identity.environment) {
        const threads = environments.get(identity.environment) ?? new Map<string, Set<string>>();
        for (const thread of identity.threads ?? []) {
          const members = threads.get(thread) ?? new Set<string>();
          members.add(actor.actorId);
          threads.set(thread, members);
        }
        environments.set(identity.environment, threads);
      }
    },
    followers(environment: string, thread: string) {
      return [...(environments.get(environment)?.get(thread) ?? [])].sort();
    },
    followedThreads(environment: string) {
      return [...(environments.get(environment)?.keys() ?? [])].sort();
    },
    issueThreads(issue: string) {
      return [...(issues.get(issue) ?? [])]
        .flatMap((actorId) => {
          const identity = identities.get(actorId)!;
          return identity.environment
            ? (identity.threads ?? []).map((threadId) => ({
                actorId,
                environment: identity.environment!,
                threadId,
              }))
            : [];
        })
        .sort(
          (a, b) =>
            a.environment.localeCompare(b.environment) ||
            a.threadId.localeCompare(b.threadId) ||
            a.actorId.localeCompare(b.actorId),
        );
    },
  };
}
