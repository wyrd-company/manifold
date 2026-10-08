// ---
// relationships:
//   implements: operator-console
// ---
import type { DeclarationFindings } from "@wyrd-company/manifold-shared/declarations-api";
export function sharingFor(lint: DeclarationFindings | undefined, account: string, item: string) {
  return lint?.findings.length
    ? undefined
    : lint?.preview?.find((row) => row.account === account)?.items.find((row) => row.item === item);
}
