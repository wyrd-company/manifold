// ---
// relationships:
//   implements: usage-intake
// ---
import { lintUsageDeclaration } from "@wyrd-company/manifold-shared";
import type { UsageDeclaration } from "@wyrd-company/manifold-shared";
import { canonical } from "./types.ts";
import type { Usage, UsageApplyResult, UsageOptions, UsageRevision } from "./types.ts";
import { moveUsage } from "./moves.ts";
import { unownedUsage } from "./unowned.ts";
import { actorUsage } from "./actor-usage.ts";
import { saveActor } from "./hooks.ts";
import { pushUsage, retryPostings } from "./push.ts";
import { usageListener } from "./listener.ts";
export function openUsage(options: UsageOptions): Usage {
  const now = options.now ?? Date.now;
  const row = options.connection.database
    .prepare("SELECT declaration FROM usage_declarations ORDER BY seq DESC LIMIT 1")
    .get() as { declaration: string } | undefined;
  let declaration: UsageDeclaration = row
    ? (JSON.parse(row.declaration) as UsageDeclaration)
    : { accounts: {}, prices: { unit: "usd", models: {} } };
  let queue: Promise<unknown> = Promise.resolve();
  const push: Usage["push"] = (request) => pushUsage(options, declaration, now, request);
  const retryPending = () => retryPostings(options, declaration, now);
  const applyRevision = async (revision: UsageRevision): Promise<UsageApplyResult> => {
    const [accounts, prices] = await Promise.all([
      revision.read("accounts.yml"),
      revision.read("prices.yml"),
    ]);
    const lint = lintUsageDeclaration({ accounts, prices });
    if (!lint.ok) return { status: "rejected", commit: revision.commit, findings: lint.findings };
    if (canonical(lint.declaration) === canonical(declaration))
      return { status: "unchanged", commit: revision.commit };
    options.connection.transaction(() => {
      options.connection.database
        .prepare(
          "INSERT INTO usage_declarations (commit_id,declaration,accepted_at) VALUES (?,?,?)",
        )
        .run(revision.commit, canonical(lint.declaration), now());
      retryPostings(options, lint.declaration, now);
    });
    declaration = lint.declaration;
    return { status: "applied", commit: revision.commit };
  };
  const move: Usage["move"] = (request) => moveUsage(options, now, request);
  const unowned = () => unownedUsage(options);
  return {
    move,
    unowned,
    actorUsage: (actor) => actorUsage(options, actor),
    accounts: () => structuredClone(declaration.accounts),
    push,
    retryPending,
    listener: usageListener(options.environments, push, options.onError ?? (() => {}), {
      move,
      unowned,
    }),
    saveHook: (save) => saveActor(options, now, save, declaration),
    apply: (revision) => {
      const result = queue.then(() => applyRevision(revision));
      queue = result.catch(() => {});
      return result;
    },
  };
}
