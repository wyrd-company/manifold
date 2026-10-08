// ---
// relationships:
//   implements: operator-console
// ---
import { ArchiveItemDialog } from "./ArchiveItemDialog.tsx";
import type {
  ArchiveItemRequest,
  SaveDeclarationResponse,
} from "@wyrd-company/manifold-shared/declarations-api";
import { useState } from "react";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
import type { PortfolioItem, PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { PortfolioEdit } from "./edits.ts";
import type { LintDeclarationResponse as DeclarationLint } from "@wyrd-company/manifold-shared/declarations-api";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { AllocationInput } from "./PortfolioTable.tsx";
import { Amount } from "./BudgetSourceCards.tsx";
import { itemId } from "./edits.ts";
import { sharingFor } from "./sharing.ts";
import { ProblemsList } from "./ProblemsList.tsx";
export function EditItemDialog({
  item,
  read,
  account,
  lint,
  pending,
  busy,
  dirty,
  onEdit,
  onSave,
  onReplaceNew,
  onRemoveNew,
  onArchive,
  onArchiveSaved,
  onClose,
}: {
  item: PortfolioItem | undefined;
  read: PortfolioResponse;
  account: string;
  lint: DeclarationLint | undefined;
  pending: boolean;
  busy: boolean;
  dirty: boolean;
  onEdit: (edit: PortfolioEdit) => void;
  onSave: (message: string) => void;
  onReplaceNew: (edit: PortfolioEdit) => void;
  onRemoveNew: (id: string) => void;
  onArchive: (id: string) => void;
  onArchiveSaved: (request: ArchiveItemRequest, answer: SaveDeclarationResponse) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.title ?? ""),
    [created, setCreated] = useState<string>(),
    [confirm, setConfirm] = useState<string>(),
    [archive, setArchive] = useState<PortfolioItem>(),
    [newChildren, setNewChildren] = useState<string[]>([]);
  const id =
      item?.id ??
      created ??
      itemId(
        name,
        read.items.map((i) => i.id),
      ),
    current = read.items.find((i) => i.id === id) ?? item;
  const allocation = current?.allocations.find((a) => a.account === account),
    children = read.items.filter((i) => i.parent === id && !i.other && !i.archived),
    unit = read.accounts.find((a) => a.name === account)?.unit;
  const sharing = sharingFor(lint, account, id);
  const descendants = (parent: string): PortfolioItem[] =>
    read.items.flatMap((i) => (i.parent === parent ? [i, ...descendants(i.id)] : []));
  const attached = current
    ? [current, ...descendants(id)].some(
        (i) => i.projects.github.length || i.projects.t3code.length,
      )
    : false;
  const change = (field: "guarantee" | "ceiling" | "weight" | "burst", value: number | null) =>
    onEdit({
      kind: "allocation",
      item: id,
      account,
      ...(field === "guarantee" ? { guarantee: value ?? 0 } : { [field]: value }),
    });
  function changeName(value: string) {
    setName(value);
    if (item) onEdit({ kind: "title", item: id, title: value });
    else if (value.trim()) {
      const next = itemId(
        value,
        read.items.filter((i) => i.id !== created).map((i) => i.id),
      );
      setCreated(next);
      onReplaceNew({ kind: "add", parent: null, id: next, title: value });
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 480 }} showCloseButton={!busy}>
        <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
        <DialogDescription>
          {item ? "Edit this item and its allocations." : "A new item starts at 0%."}
        </DialogDescription>
        <fieldset className="portfolio-item-fields" disabled={busy}>
          <label>
            Name
            <input aria-label="Name" value={name} onChange={(e) => changeName(e.target.value)} />
            <small className="mono muted">{id}</small>
          </label>
          {item && current ? (
            <>
              <AllocationInput
                item={current}
                account={account}
                field="guarantee"
                value={allocation?.guarantee ?? 0}
                findings={lint?.findings ?? []}
                onChange={(v) => change("guarantee", v)}
              />
              <p className="muted portfolio-dialog-sharing">
                {sharing
                  ? `Can reserve, halfway through an idle window: ${formatPercent(sharing.alone)} alone, ${formatPercent(sharing.allWaiting)} with every item waiting.`
                  : "—"}
              </p>
              <AllocationInput
                item={current}
                account={account}
                field="ceiling"
                value={allocation?.ceiling}
                findings={lint?.findings ?? []}
                onChange={(v) => change("ceiling", v)}
              />
              <AllocationInput
                item={current}
                account={account}
                field="weight"
                value={allocation?.weight}
                findings={lint?.findings ?? []}
                onChange={(v) => change("weight", v)}
              />
              <label className="portfolio-pacing">
                Pacing
                <input
                  role="switch"
                  type="checkbox"
                  checked={!!allocation?.pacing}
                  onChange={(e) => change("burst", e.target.checked ? 0 : null)}
                />
              </label>
              {allocation?.pacing ? (
                <AllocationInput
                  item={current}
                  account={account}
                  field="burst"
                  value={allocation.pacing.burst}
                  findings={lint?.findings ?? []}
                  onChange={(v) => change("burst", v)}
                />
              ) : null}
              <h3>
                Sub-items{" "}
                <small className="muted">
                  {formatPercent(
                    100 -
                      read.items
                        .filter((i) => i.parent === id && !i.archived)
                        .reduce(
                          (s, i) =>
                            s + (i.allocations.find((a) => a.account === account)?.guarantee ?? 0),
                          0,
                        ),
                  )}{" "}
                  unallocated
                </small>
              </h3>
              {children.map((child) => {
                const a = child.allocations.find((a) => a.account === account);
                return (
                  <div className="portfolio-sub-item" key={child.id}>
                    <label>
                      Name
                      <input
                        value={child.title}
                        onChange={(e) =>
                          onEdit({ kind: "title", item: child.id, title: e.target.value })
                        }
                      />
                    </label>
                    <Amount value={a?.amount ?? 0} unit={unit} />
                    <AllocationInput
                      item={child}
                      account={account}
                      field="guarantee"
                      value={a?.guarantee ?? 0}
                      findings={lint?.findings ?? []}
                      onChange={(v) =>
                        onEdit({ kind: "allocation", item: child.id, account, guarantee: v ?? 0 })
                      }
                    />
                    <AllocationInput
                      item={child}
                      account={account}
                      field="ceiling"
                      value={a?.ceiling}
                      findings={lint?.findings ?? []}
                      onChange={(v) =>
                        onEdit({ kind: "allocation", item: child.id, account, ceiling: v })
                      }
                    />
                    <Button
                      variant="ghost"
                      disabled={
                        busy ||
                        (dirty &&
                          !newChildren.includes(child.id) &&
                          [child, ...descendants(child.id)].some(
                            (i) => i.projects.github.length + i.projects.t3code.length > 0,
                          ))
                      }
                      onClick={() =>
                        newChildren.includes(child.id)
                          ? onRemoveNew(child.id)
                          : [child, ...descendants(child.id)].some(
                                (i) => i.projects.github.length + i.projects.t3code.length > 0,
                              )
                            ? setArchive(child)
                            : setConfirm(child.id)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="outline"
                onClick={() => {
                  const next = itemId("New item", [...read.items.map((i) => i.id), ...newChildren]);
                  setNewChildren([...newChildren, next]);
                  onEdit({ kind: "add", parent: id, id: next, title: "New item" });
                }}
              >
                Add sub-item
              </Button>
            </>
          ) : null}
        </fieldset>
        <ProblemsList lint={lint} />
        <div className="blueprint-dialog-actions">
          {item ? (
            <Button
              variant="outline"
              className="error-text"
              disabled={busy || dirty}
              onClick={() => (attached && current ? setArchive(current) : setConfirm(id))}
            >
              Archive item
            </Button>
          ) : null}
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !name.trim() || !current || pending || !lint || !!lint.findings.length || busy
            }
            onClick={() => onSave(`${item ? "Update" : "Add"} portfolio item ${id}`)}
          >
            Save
          </Button>
        </div>
        {item ? (
          <p className="muted">
            {dirty
              ? "Save or discard your changes first."
              : `Its allocation returns to ${read.items.find((i) => i.id === item.parent)?.title ?? "the top level"}.`}
          </p>
        ) : null}
        {archive ? (
          <ArchiveItemDialog
            item={archive}
            read={read}
            onClose={() => setArchive(undefined)}
            onSaved={onArchiveSaved}
          />
        ) : null}
        <Dialog
          open={!!confirm}
          onOpenChange={(open) => {
            if (!open) setConfirm(undefined);
          }}
        >
          <DialogPopup style={{ width: 400 }}>
            <DialogTitle>Archive {read.items.find((i) => i.id === confirm)?.title}?</DialogTitle>
            <DialogDescription>
              Its allocation returns to its parent. Its history is kept.
            </DialogDescription>
            <div className="blueprint-dialog-actions">
              <Button variant="outline" onClick={() => setConfirm(undefined)}>
                Cancel
              </Button>
              <Button
                className="portfolio-confirm-archive"
                onClick={() => {
                  if (confirm) onArchive(confirm);
                  setConfirm(undefined);
                }}
              >
                Confirm archive
              </Button>
            </div>
          </DialogPopup>
        </Dialog>
      </DialogPopup>
    </Dialog>
  );
}
