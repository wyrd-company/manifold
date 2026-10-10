// ---
// relationships:
//   implements: [operator-console, usage-api]
// ---
import { Combobox } from "@base-ui/react/combobox";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { UnownedEntry } from "@wyrd-company/manifold-shared/usage-api";
import { fetchTasks } from "../../api/tasks.ts";
import { moveUsage } from "../../api/usage.ts";
import { Button } from "../../ui/button.tsx";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { portfolioRows } from "./rows.ts";
import { Amount } from "./BudgetSourceCards.tsx";
export function MoveUsageDialog({
  entry,
  read,
  onClose,
  onMoved,
}: {
  entry: UnownedEntry;
  read: PortfolioResponse;
  onClose: () => void;
  onMoved: (message: string) => void;
}) {
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks, retry: false });
  const [kind, setKind] = useState<"item" | "actor">("item");
  const [item, setItem] = useState(
    entry.usage.length && entry.usage.every((u) => u.item === entry.usage[0]?.item)
      ? entry.usage[0]!.item
      : "",
  );
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const live = portfolioRows(
    read,
    read.items.map((i) => i.id),
  ).flatMap((row) =>
    row.kind === "item" && !row.item.archived ? [{ ...row.item, depth: row.depth }] : [],
  );
  const groups = tasks.data?.kind === "ok" ? tasks.data.projects : [];
  const selectedItem = live.find((i) => i.id === item);
  const selectedTask = groups.flatMap((p) => p.tasks).find((t) => t.actorId === actor);
  const label =
    kind === "item"
      ? selectedItem?.title
      : selectedTask
        ? `${selectedTask.issue.repository}#${selectedTask.issue.number}`
        : undefined;
  async function move() {
    if (!label || busy) return;
    setBusy(true);
    setError(undefined);
    const result = await moveUsage({
      from: entry.actor,
      to: kind === "item" ? { item } : { actor },
    });
    setBusy(false);
    if (result.kind !== "ok") {
      setError(
        result.kind === "refused" && result.error === "unknown-actor"
          ? "This task has not started, so its usage cannot be counted yet."
          : result.message,
      );
      return;
    }
    onMoved(
      result.body.moved ? `Moved ${result.body.moved} calls to ${label}` : "Nothing left to move.",
    );
    onClose();
    await Promise.all([
      client.invalidateQueries({ queryKey: ["portfolio"] }),
      client.invalidateQueries({ queryKey: ["usage", "unowned"] }),
      client.invalidateQueries({ queryKey: ["tasks"] }),
      client.invalidateQueries({ queryKey: ["task"] }),
    ]);
  }
  const amounts = new Map<string, number>();
  for (const u of entry.usage) amounts.set(u.account, (amounts.get(u.account) ?? 0) + u.amount);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup className="usage-move-dialog" style={{ width: 480 }}>
        <DialogTitle>Move usage</DialogTitle>
        <DialogDescription>
          {entry.kind === "session" ? "Unmapped session" : entry.title || "Untitled thread"}
        </DialogDescription>
        <div className="usage-move-amounts">
          {[...amounts].map(([account, amount]) => (
            <p key={account}>
              {account}:{" "}
              <Amount value={amount} unit={read.accounts.find((a) => a.name === account)?.unit} />
            </p>
          ))}
        </div>
        <fieldset disabled={busy} className="usage-move-target">
          <legend>Move to</legend>
          <label>
            <input
              type="radio"
              name="usage-target"
              checked={kind === "item"}
              onChange={() => setKind("item")}
            />{" "}
            To a portfolio item
          </label>
          {kind === "item" ? (
            <select
              aria-label="Portfolio item"
              value={selectedItem ? item : ""}
              onChange={(e) => setItem(e.target.value)}
            >
              <option value="">Choose an item</option>
              {live.map((i) => (
                <option key={i.id} value={i.id}>
                  {"　".repeat(i.depth)}
                  {i.title}
                </option>
              ))}
            </select>
          ) : null}
          <label>
            <input
              type="radio"
              name="usage-target"
              checked={kind === "actor"}
              onChange={() => setKind("actor")}
            />{" "}
            To a task
          </label>
          {kind === "actor" ? (
            <>
              <Combobox.Root<string>
                items={groups.flatMap((p) => p.tasks.map((t) => t.actorId))}
                value={actor || null}
                onValueChange={(value) => setActor(value ?? "")}
                onInputValueChange={(value, details) => {
                  setSearch(value);
                  if (details.reason === "input-change" || details.reason === "input-clear")
                    setActor("");
                }}
                filter={null}
                itemToStringLabel={(value) => {
                  const task = groups.flatMap((p) => p.tasks).find((t) => t.actorId === value);
                  return task
                    ? `${task.issue.repository}#${task.issue.number} ${task.issue.title ?? ""}`
                    : value;
                }}
                disabled={busy}
              >
                <Combobox.Input
                  aria-label="Search tasks"
                  placeholder="Search tasks"
                  className="usage-task-input"
                />
                <Combobox.Portal>
                  <Combobox.Positioner sideOffset={4} className="usage-task-positioner">
                    <Combobox.Popup className="usage-task-popup">
                      <Combobox.List>
                        {groups.map((p) => {
                          const visible = p.tasks.filter((t) =>
                            `${t.issue.repository}#${t.issue.number} ${t.issue.title ?? ""}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          );
                          return visible.length ? (
                            <Combobox.Group key={p.binding}>
                              <Combobox.GroupLabel className="muted">
                                {p.owner} Project {p.number}
                              </Combobox.GroupLabel>
                              {visible.map((t) => (
                                <Combobox.Item key={t.actorId} value={t.actorId}>
                                  {t.issue.repository}#{t.issue.number} {t.issue.title}
                                </Combobox.Item>
                              ))}
                            </Combobox.Group>
                          ) : null;
                        })}
                      </Combobox.List>
                      <Combobox.Empty className="muted">No tasks match.</Combobox.Empty>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              {tasks.data?.kind === "failed" ? (
                <div role="alert" className="error-alert">
                  {tasks.data.message}
                  <Button onClick={() => void tasks.refetch()}>Try again</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </fieldset>
        {error ? (
          <div role="alert" className="error-alert">
            {error}
          </div>
        ) : null}
        <div className="blueprint-dialog-actions">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!label || busy} onClick={() => void move()}>
            {busy ? "Moving…" : "Move"}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
