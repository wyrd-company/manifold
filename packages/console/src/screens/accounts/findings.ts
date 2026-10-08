// ---
// relationships:
//   implements: operator-console
// ---
import type { DeclarationFinding } from "@wyrd-company/manifold-shared/declarations-api";
export function findingField(
  finding: DeclarationFinding,
  name: string,
): "name" | "amount" | "reset" | "window" | `usage:${number}` | undefined {
  const base = `/accounts/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  if (finding.file !== "accounts") return;
  const path = finding.location;
  if (
    path === base ||
    (finding.kind === "schema" && path === "/accounts" && finding.message.includes(name))
  )
    return "name";
  if (path === base + "/capacity/amount") return "amount";
  if (path === base + "/capacity/reset") return "reset";
  if (path.startsWith(base + "/capacity/every")) return "window";
  const index = /^\/usage\/(\d+)(?:\/|$)/.exec(path.slice(base.length));
  if (path.startsWith(base) && index) return `usage:${Number(index[1])}`;
}
