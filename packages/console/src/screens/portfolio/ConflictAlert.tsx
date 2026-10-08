// ---
// relationships:
//   implements: operator-console
// ---
import type {
  DeclarationPath,
  SaveConflictResponse,
} from "@wyrd-company/manifold-shared/declarations-api";
import { Button } from "../../ui/button.tsx";
export function ConflictAlert({
  path,
  conflict,
  busy,
  onRebase,
  onDiscard,
}: {
  path: DeclarationPath;
  conflict: SaveConflictResponse;
  busy: boolean;
  onRebase: () => void;
  onDiscard: () => void;
}) {
  return (
    <div role="alert" className="error-alert">
      {conflict.reason === "file-changed"
        ? `${path} changed at ${conflict.head.slice(0, 7)}. Your changes are kept.`
        : `The process repository branch moved while saving ${path}, at ${conflict.head.slice(0, 7)}. Your changes are kept.`}
      <Button variant="outline" disabled={busy} onClick={onRebase}>
        Apply my changes to the latest
      </Button>
      <Button variant="outline" disabled={busy} onClick={onDiscard}>
        Discard changes
      </Button>
    </div>
  );
}
