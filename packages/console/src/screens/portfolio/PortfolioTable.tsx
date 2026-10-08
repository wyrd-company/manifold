// ---
// relationships:
//   implements: operator-console
// ---
import { SharingPreviewCell } from "./SharingPreviewCell.tsx";
import type { DeclarationFindings } from "@wyrd-company/manifold-shared/declarations-api";
import { ProjectNames } from "./ProjectNames.tsx";
import type { PortfolioResponse, PortfolioItem } from "@wyrd-company/manifold-shared/portfolio-api";
import type { DeclarationFinding } from "@wyrd-company/manifold-shared/declarations-api";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { ChevronRight, Pencil } from "lucide-react";
import { Button } from "../../ui/button.tsx";
import { Amount } from "./BudgetSourceCards.tsx";
import { CurrentUsageCell } from "./CurrentUsageCell.tsx";
import { portfolioRows } from "./rows.ts";
import { inputFinding } from "./findings.ts";
export function AllocationInput({
  item,
  account,
  field,
  value,
  findings,
  onChange,
}: {
  item: PortfolioItem;
  account: string;
  field: "guarantee" | "ceiling" | "weight" | "burst";
  value: number | undefined;
  findings: readonly DeclarationFinding[];
  onChange: (value: number | null) => void;
}) {
  const finding = inputFinding(findings, item, account, field);
  return (
    <label className="portfolio-number">
      <span>{field === "guarantee" ? "Allocation" : field[0]!.toUpperCase() + field.slice(1)}</span>
      <input
        type="number"
        aria-label={`${item.title} ${field === "guarantee" ? "allocation" : field}`}
        min={field === "weight" ? 1 : 0}
        max={field === "weight" ? undefined : 100}
        step={field === "weight" ? 1 : 0.01}
        value={value ?? ""}
        aria-invalid={!!finding}
        aria-describedby={finding ? `${item.id}-${field}-error` : undefined}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {finding ? (
        <small id={`${item.id}-${field}-error`} className="error-text">
          {finding.message}
        </small>
      ) : null}
    </label>
  );
}
export function PortfolioTable({
  read,
  account,
  expanded,
  onExpand,
  editing,
  findings,
  onAllocation,
  onEdit,
  lint,
  pending,
}: {
  lint?: DeclarationFindings | undefined;
  pending?: boolean;
  read: PortfolioResponse;
  account: string;
  expanded: readonly string[];
  onExpand: (id: string) => void;
  editing: boolean;
  findings: readonly DeclarationFinding[];
  onAllocation: (item: string, field: "guarantee" | "ceiling", value: number | null) => void;
  onEdit: (item: PortfolioItem) => void;
}) {
  const selected = read.accounts.find((a) => a.name === account),
    unit = selected?.unit;
  return (
    <div className="portfolio-table-wrap">
      <table className="task-table portfolio-table">
        <thead>
          <tr>
            {[
              "Name",
              "Allocation",
              editing ? "Sharing preview" : "Current usage",
              "Lifetime cost",
              "Active tasks",
              "Completed tasks",
              "",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {portfolioRows(read, expanded, editing).map((row) => {
            if (row.kind === "unallocated") {
              const a = row.values.find((a) => a.account === account);
              return (
                <tr className="muted portfolio-unallocated" key={`unallocated-${row.parent}`}>
                  <td style={{ paddingLeft: 16 + row.depth * 24 }}>Unallocated</td>
                  <td>
                    {a ? formatPercent(a.percent) : "—"}
                    {a ? (
                      <small>
                        <Amount value={a.amount} unit={unit} />
                      </small>
                    ) : null}
                  </td>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              );
            }
            const i = row.item,
              a = i.allocations.find((a) => a.account === account);
            return (
              <tr key={i.id} className={row.depth ? "portfolio-child" : ""}>
                <td style={{ paddingLeft: 16 + row.depth * 24 }}>
                  {i.unallocated ? (
                    <button
                      className="portfolio-expand"
                      aria-label={`${expanded.includes(i.id) ? "Collapse" : "Expand"} ${i.title}`}
                      aria-expanded={editing || expanded.includes(i.id)}
                      onClick={() => onExpand(i.id)}
                    >
                      <ChevronRight
                        size={14}
                        style={{
                          transform:
                            editing || expanded.includes(i.id) ? "rotate(90deg)" : undefined,
                        }}
                      />
                    </button>
                  ) : null}
                  <strong>{i.title}</strong>
                  <ProjectNames projects={i.projects} />
                </td>
                <td>
                  {editing ? (
                    <>
                      <AllocationInput
                        item={i}
                        account={account}
                        field="guarantee"
                        value={a?.guarantee}
                        findings={findings}
                        onChange={(v) => onAllocation(i.id, "guarantee", v)}
                      />
                      <AllocationInput
                        item={i}
                        account={account}
                        field="ceiling"
                        value={a?.ceiling}
                        findings={findings}
                        onChange={(v) => onAllocation(i.id, "ceiling", v)}
                      />
                    </>
                  ) : a ? (
                    <>
                      {formatPercent(a.guarantee)}{" "}
                      {a.ceiling !== undefined ? (
                        <span className="muted">up to {formatPercent(a.ceiling)}</span>
                      ) : null}
                      <small className="muted">
                        <Amount value={a.amount} unit={unit} />
                      </small>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {editing ? (
                    <SharingPreviewCell
                      lint={lint}
                      account={account}
                      item={i.id}
                      pending={!!pending}
                    />
                  ) : (
                    <CurrentUsageCell item={i} accounts={read.accounts} selected={account} />
                  )}
                </td>
                <td>
                  {a ? <Amount value={a.lifetime} unit={unit} /> : <span className="muted">—</span>}
                </td>
                <td>{i.activeTasks || <span className="muted">—</span>}</td>
                <td>{i.completedTasks || <span className="muted">—</span>}</td>
                <td>
                  {!editing && !i.other ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${i.title}`}
                      onClick={() => onEdit(i)}
                    >
                      <Pencil size={14} />
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>
              100%
              <small>
                <Amount value={selected?.window?.capacity ?? 0} unit={unit} />
              </small>
            </td>
            <td>
              <Amount value={selected?.window?.used ?? 0} unit={unit} />
            </td>
            <td>
              <Amount
                value={read.items
                  .filter((i) => i.parent === null)
                  .reduce(
                    (sum, i) =>
                      sum + (i.allocations.find((a) => a.account === account)?.lifetime ?? 0),
                    0,
                  )}
                unit={unit}
              />
            </td>
            <td />
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
