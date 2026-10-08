// ---
// relationships:
//   implements: operator-console
// ---
import type { DeclarationFindings } from "@wyrd-company/manifold-shared/declarations-api";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { sharingFor } from "./sharing.ts";
export function SharingPreviewCell({
  lint,
  account,
  item,
  pending,
}: {
  lint: DeclarationFindings | undefined;
  account: string;
  item: string;
  pending: boolean;
}) {
  const preview = sharingFor(lint, account, item);
  return preview ? (
    <div className={pending ? "muted" : ""}>
      <span>
        Alone <span className="mono">{formatPercent(preview.alone)}</span>
      </span>
      <small>
        All waiting <span className="mono">{formatPercent(preview.allWaiting)}</span>
      </small>
      <small className="muted">of capacity</small>
    </div>
  ) : (
    <span className="muted">—</span>
  );
}
