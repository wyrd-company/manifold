// ---
// relationships:
//   implements: gate-runtime
// ---
import type { Snapshot } from "xstate";
import type {
  GatesOptions,
  GateSave,
  GateVersion,
  GateStrandedEscalation,
  TokenRow,
} from "./types.ts";
import type { GateTables } from "./tables.ts";
import { statePaths } from "./declaration.ts";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
export function saveHook(
  options: GatesOptions,
  tables: GateTables,
  views: ReadonlyMap<string, GateVersion>,
  dirty: (gate: string) => void,
) {
  const subject = (token: TokenRow) => ({ gate: token.gate, tokenId: token.token_id });
  function returned(token: TokenRow, reason: "ended" | "return-point", state: string) {
    if (!tables.returnToken(token.token_id, reason, state)) return;
    options.escalations.withdraw({ kind: "stranded-token", subject: subject(token) });
    dirty(token.gate);
  }
  return {
    saved(save: GateSave) {
      if (save.snapshot.status === "error") return;
      const paths = statePaths(save.snapshot),
        view = views.get(save.machine),
        ended = save.snapshot.status === "done" || save.snapshot.status === "stopped";
      const tokens = tables.actorTokens(save.actorId);
      if (!view)
        options.onError?.({
          gate: undefined,
          version: save.machine,
          message: "Unknown blueprint version at save",
        });
      for (const token of tokens) {
        if (ended) {
          returned(token, "ended", save.snapshot.status);
          continue;
        }
        const declaration = view?.declarations.find((d) => token.gate.endsWith(`#${d.statePath}`));
        if (!declaration) continue;
        const point = declaration.returnPoint;
        const reached =
          point === "exit"
            ? !paths.includes(declaration.statePath) ||
              (token.state_entry_id !== null
                ? save.entries[declaration.statePath] !== token.state_entry_id
                : save.entered.includes(declaration.statePath))
            : paths.includes(point.state) || save.entered.includes(point.state);
        if (reached) {
          returned(token, "return-point", point === "exit" ? "exit" : point.state);
          continue;
        }
        const lint = view!.lint.gates.find((g) => g.statePath === declaration.statePath);
        const key = view!.lint.configurationKey(save.snapshot as unknown as Snapshot<unknown>),
          trapped = lint?.verdict !== "unknown" && lint?.traps?.has(key) === true;
        if (trapped && !token.trapped)
          options.escalations.raise({
            kind: "stranded-token",
            subject: subject(token),
            question: `Actor ${save.actorId} holds ${token.token_id} from ${token.gate} in ${key}. Return the token?`,
            choices: [
              { id: "return", label: "Return" },
              { id: "dismiss", label: "Dismiss" },
            ],
          });
        if (trapped !== Boolean(token.trapped)) tables.trap(token.token_id, trapped);
      }
      // Existing entries can belong to gates removed from a later version.
      const blueprintPath = parseBlueprintVersionKey(save.machine)?.path;
      const keys = new Set([
        ...tables
          .declarations()
          .filter((d) => d.gate.startsWith(`${blueprintPath}#`))
          .map((d) => d.gate),
        ...(view?.declarations.map((d) => `${blueprintPath}#${d.statePath}`) ?? []),
      ]);
      for (const gate of keys) {
        const path = gate.slice(gate.lastIndexOf("#") + 1),
          entry = tables.entry(gate, save.actorId),
          active = !ended && paths.includes(path);
        if (entry || active) dirty(gate);
        if (!active) {
          if (entry) tables.exit(gate, save.actorId);
          continue;
        }
        const id = save.entries[path] ?? null;
        if (!entry) tables.enter(gate, save.actorId, id);
        else if (entry.state_entry_id === null && id !== null && !save.entered.includes(path))
          tables.adopt(entry, id);
        else if (entry.state_entry_id !== id) {
          tables.exit(gate, save.actorId);
          tables.enter(gate, save.actorId, id);
        }
      }
    },
    strandedToken(escalation: GateStrandedEscalation) {
      if (
        escalation.raiser.type !== "service" ||
        escalation.raiser.kind !== "stranded-token" ||
        !escalation.answer ||
        !("choice" in escalation.answer.value) ||
        escalation.answer.value.choice !== "return"
      )
        return undefined;
      const token = tables.token(escalation.raiser.subject["tokenId"] ?? "");
      if (!token || token.gate !== escalation.raiser.subject["gate"] || token.returned_at !== null)
        return undefined;
      const snapshot = options.store.loadSnapshot(token.actor_id)?.snapshot;
      const state = snapshot ? statePaths(snapshot).join(",") : "";
      if (!tables.returnToken(token.token_id, "escalation", state)) return undefined;
      options.escalations.withdraw({ kind: "stranded-token", subject: subject(token) });
      return () => dirty(token.gate);
    },
  };
}
