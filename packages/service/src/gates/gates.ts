// ---
// relationships:
//   implements: gate-runtime
// ---
import { randomBytes } from "node:crypto";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import { LedgerError } from "../ledger/index.ts";
import type { LoadedComparator } from "../comparator-sandbox/index.ts";
import type { Router } from "../router/index.ts";
import type {
  Gates,
  GatesOptions,
  GateVersion,
  GateBlueprint,
  GateRevision,
  GateDeclaration,
  GateEvaluationResult,
  GateInput,
} from "./types.ts";
import { gateTables } from "./tables.ts";
import { declarations } from "./declaration.ts";
import { criticalPaths } from "./critical-path.ts";
import { gateInput, population } from "./input.ts";
import { saveHook } from "./save-hook.ts";
export function createGates(options: GatesOptions): Gates {
  const now = options.clock?.now ?? Date.now,
    seed = options.seed ?? (() => randomBytes(4).readUInt32LE());
  const tables = gateTables(options.store, now),
    views = new Map<string, GateVersion>();
  const comparators = new Map<
    string,
    { version: string; declaration: GateDeclaration; comparator: LoadedComparator }
  >();
  const dirtyGates = new Set<string>();
  const spent = new Set<string>();
  let router: Pick<Router, "schedule"> | undefined,
    immediate: ReturnType<typeof setImmediate> | undefined,
    stopped = false;
  function requireRunning() {
    if (stopped) throw new TypeError("Gates are stopped");
  }
  function mark(gate: string) {
    if (stopped) return;
    dirtyGates.add(gate);
    if (router && immediate === undefined) immediate = setImmediate(runDirty);
  }
  function markAll() {
    requireRunning();
    for (const row of tables.declarations()) mark(row.gate);
  }
  function add(blueprint: GateBlueprint) {
    if (!views.has(blueprint.key))
      views.set(blueprint.key, {
        blueprint,
        declarations: declarations(blueprint.document),
        lint: options.lintTokens(blueprint.document),
      });
    return views.get(blueprint.key)!;
  }
  async function view(key: string) {
    if (views.has(key)) return views.get(key);
    const version = parseBlueprintVersionKey(key);
    if (!version) return undefined;
    const loaded = await options.version(version);
    return loaded.status === "loaded" ? add(loaded.blueprint) : undefined;
  }
  function comparatorFailure(
    gate: string,
    version: string,
    comparator: string | undefined,
    kind: string,
    message: string,
  ) {
    options.escalations.raise({
      kind: "comparator-failed",
      subject: { gate },
      title: "Comparator failed",
      question:
        `Gate: ${gate}\nComparator: ${comparator ?? "unknown"}\nVersion: ${version}\nCause: ${kind}\n${message}`.slice(
          0,
          8000,
        ),
      choices: [
        { id: "retry", label: "Retry" },
        { id: "dismiss", label: "Dismiss" },
      ],
    });
  }
  async function loadComparator(
    gate: string,
    key: string,
    commit: string,
    revision: GateRevision | undefined,
    withdraw = false,
  ) {
    function current() {
      const declared = tables.declarations().find((row) => row.gate === gate);
      return !stopped && declared?.version === key && declared.revision_commit === commit;
    }
    function replace() {
      comparators.get(gate)?.comparator.dispose();
      comparators.delete(gate);
    }
    const version = await view(key),
      statePath = gate.slice(gate.lastIndexOf("#") + 1),
      declaration = version?.declarations.find((d) => d.statePath === statePath);
    const source = declaration ? await revision?.read(declaration.comparator) : undefined;
    if (!current()) return;
    if (!declaration || source === undefined) {
      replace();
      comparatorFailure(
        gate,
        key,
        declaration?.comparator,
        "missing",
        "Missing comparator source or declaration",
      );
      options.probe?.("comparator-failed", gate);
      options.onError?.({
        gate,
        version: key,
        message: "Missing comparator source or declaration",
      });
      return;
    }
    const loaded = await options.sandbox.load({ name: declaration.comparator, text: source });
    // A spent-engine reload runs outside the revision queue. Its source may
    // cease to be the durable declaration while the sandbox loads.
    if (!current()) {
      if (loaded.ok) loaded.comparator.dispose();
      return;
    }
    replace();
    if (!loaded.ok) {
      comparatorFailure(
        gate,
        key,
        declaration.comparator,
        loaded.failure.kind,
        loaded.failure.message,
      );
      options.probe?.("comparator-failed", gate);
      options.onError?.({ gate, version: key, message: loaded.failure.message });
      return;
    }
    if (withdraw)
      options.store.connection.transaction(() =>
        options.escalations.withdraw({ kind: "comparator-failed", subject: { gate } }),
      );
    spent.delete(gate);
    comparators.set(gate, { version: key, declaration, comparator: loaded.comparator });
    mark(gate);
  }
  function bootstrap(gate: string) {
    for (const member of population(options.store, gate))
      if (!tables.entry(gate, member.actorId))
        tables.enter(gate, member.actorId, null, member.savedAt);
  }
  function pass(gate: string) {
    const loaded = comparators.get(gate);
    if (!loaded) return;
    options.store.connection.transaction(() => bootstrap(gate));
    const at = now(),
      critical = criticalPaths(options.trackedIssue);
    // A probe or schedule callback can stop the module during a pass.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!stopped) {
      const input = gateInput(options, tables, views, gate, at, critical);
      if (input.population.length === 0) return;
      const draw = seed(),
        result = loaded.comparator.evaluate(input, draw);
      if (!result.ok || result.selection === null) {
        options.store.connection.transaction(() => {
          tables.evaluate(gate, loaded.version, input, draw, result);
          if (!result.ok)
            comparatorFailure(
              gate,
              loaded.version,
              loaded.declaration.comparator,
              result.failure.kind,
              result.failure.message,
            );
        });
        if (!result.ok) options.probe?.("comparator-failed", gate);
        if (!result.ok && result.failure.kind === "engine") {
          loaded.comparator.dispose();
          comparators.delete(gate);
          spent.add(gate);
        }
        return;
      }
      const selection = result.selection,
        member = input.population.find((p) => p.id === selection.task)!;
      const entry = tables.entry(gate, member.id)!;
      const tokenId = `token:${entry.entry_id}`;
      const reservations = new Map<string, number>();
      if (loaded.declaration.reservation)
        for (const r of selection.reservations ?? [])
          reservations.set(r.account, (reservations.get(r.account) ?? 0) + r.amount);
      const written = [...reservations]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([account, amount]) => ({ account, amount }));
      try {
        options.store.connection.transaction(() => {
          const evaluation = tables.evaluate(gate, loaded.version, input, draw, result);
          tables.grant(entry, evaluation);
          for (const r of written)
            options.portfolio.ledger.reserve({
              key: `${tokenId}/${r.account}`,
              actor: member.id,
              item: member.item,
              account: r.account,
              amount: r.amount,
            });
          const stored = options.store.loadSnapshot(member.id)!;
          const declaration = views
            .get(stored.machine)!
            .declarations.find((d) => gate.endsWith(`#${d.statePath}`))!;
          options.store.writeInbox(
            {
              eventId: `gate:${tokenId}`,
              topic: "gate",
              payload: { type: declaration.token, gate, tokenId, reservations: written },
            },
            [member.id],
          );
          options.probe?.("granting", tokenId);
        });
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error;
        options.store.connection.transaction(() =>
          tables.evaluate(gate, loaded.version, input, draw, {
            ok: false,
            failure: { kind: "reservation", message: error.message },
            durationMs: result.durationMs,
          }),
        );
        options.onError?.({ gate, version: loaded.version, message: error.message });
        return;
      }
      options.probe?.("granted", tokenId);
      router!.schedule(member.id);
      if (written.length)
        for (const row of tables.declarations()) if (row.gate !== gate) mark(row.gate);
    }
  }
  function runDirty() {
    immediate = undefined;
    const batch = [...dirtyGates];
    dirtyGates.clear();
    for (const gate of batch) {
      if (stopped) break;
      if (spent.delete(gate)) {
        const declaration = tables.declarations().find((d) => d.gate === gate)!;
        void options
          .revisionAt(declaration.revision_commit)
          .then((r) => loadComparator(gate, declaration.version, declaration.revision_commit, r))
          .catch((error) =>
            options.onError?.({ gate, version: declaration.version, message: String(error) }),
          );
      } else pass(gate);
    }
  }
  const hooks = saveHook(options, tables, views, mark);
  return {
    ...hooks,
    heldTokens: (actorId) =>
      tables.actorTokens(actorId).map((token) => ({ gate: token.gate, tokenId: token.token_id })),
    tokenHolder: (tokenId) => tables.token(tokenId)?.actor_id,
    async revision(load, revision) {
      requireRunning();
      const writes: { gate: string; key: string }[] = [];
      for (const [path, blueprint] of load.blueprints)
        for (const declaration of add(blueprint).declarations)
          writes.push({ gate: `${path}#${declaration.statePath}`, key: blueprint.key });
      options.store.connection.transaction(() => {
        for (const row of writes) tables.declare(row.gate, row.key, revision.commit);
      });
      for (const row of writes)
        await loadComparator(row.gate, row.key, revision.commit, revision, true);
    },
    async prepare() {
      requireRunning();
      for (const snapshot of options.store.activeSnapshots()) await view(snapshot.machine);
      for (const row of tables.declarations())
        await loadComparator(
          row.gate,
          row.version,
          row.revision_commit,
          await options.revisionAt(row.revision_commit),
        );
    },
    afterDrain(next) {
      requireRunning();
      router = next;
      options.store.connection.transaction(() => {
        for (const row of tables.declarations()) bootstrap(row.gate);
      });
      markAll();
      if (immediate !== undefined) clearImmediate(immediate);
      runDirty();
    },
    comparatorFailed(escalation) {
      if (
        escalation.raiser.type !== "service" ||
        escalation.raiser.kind !== "comparator-failed" ||
        !escalation.answer ||
        !("choice" in escalation.answer.value) ||
        escalation.answer.value.choice !== "retry"
      )
        return;
      const gate = escalation.raiser.subject["gate"]!;
      const row = tables.declarations().find((row) => row.gate === gate);
      if (!row) return;
      return () => {
        if (stopped) return;
        if (comparators.has(gate)) mark(gate);
        else
          void options
            .revisionAt(row.revision_commit)
            .then((revision) => loadComparator(gate, row.version, row.revision_commit, revision))
            .catch((error) =>
              options.onError?.({ gate, version: row.version, message: String(error) }),
            );
      };
    },
    inputChanged: markAll,
    async replay(id) {
      requireRunning();
      const row = tables.evaluation(id);
      if (!row) throw new TypeError("Unknown evaluation id");
      const loaded = await view(row.version),
        declaration = loaded?.declarations.find((d) => row.gate.endsWith(`#${d.statePath}`));
      const parsed = parseBlueprintVersionKey(row.version),
        revision = parsed ? await options.revisionAt(parsed.commit) : undefined;
      const source = declaration ? await revision?.read(declaration.comparator) : undefined;
      if (source === undefined || !declaration)
        throw new TypeError("Recorded comparator is unavailable");
      const comparator = await options.sandbox.load({ name: declaration.comparator, text: source });
      const recorded: GateEvaluationResult =
        row.outcome === "failure"
          ? {
              ok: false,
              failure: {
                kind: row.failure_kind as Extract<
                  GateEvaluationResult,
                  { ok: false }
                >["failure"]["kind"],
                message: row.failure_message!,
              },
              durationMs: row.duration_ms,
            }
          : {
              ok: true,
              selection: row.selection === null ? null : JSON.parse(row.selection),
              durationMs: row.duration_ms,
            };
      if (!comparator.ok)
        return { recorded, replayed: { ok: false, failure: comparator.failure, durationMs: 0 } };
      try {
        return {
          recorded,
          replayed: comparator.comparator.evaluate(JSON.parse(row.input) as GateInput, row.seed),
        };
      } finally {
        comparator.comparator.dispose();
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (immediate !== undefined) clearImmediate(immediate);
      immediate = undefined;
      dirtyGates.clear();
      for (const loaded of comparators.values()) loaded.comparator.dispose();
      comparators.clear();
    },
  };
}
