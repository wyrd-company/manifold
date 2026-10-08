// ---
// relationships:
//   implements: operator-console
// ---
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Unplug, PlugZap, LoaderCircle } from "lucide-react";
import type {
  EnvironmentSummary,
  EnvironmentAction,
} from "@wyrd-company/manifold-shared/environments-api";
import { actOnEnvironment } from "../../api/environments.ts";
import type { fetchEnvironments } from "../../api/environments.ts";
import { Button } from "../../ui/button.tsx";
import { EnvironmentStatus } from "./EnvironmentStatus.tsx";
import { environmentRow } from "./rows.ts";
function EnvironmentTableRow({
  environment,
  onError,
}: {
  environment: EnvironmentSummary;
  onError: (message: string) => void;
}) {
  const client = useQueryClient();
  const row = environmentRow(environment);
  const mutation = useMutation({
    mutationFn: (action: EnvironmentAction) => actOnEnvironment(environment.name, action),
    onSuccess: (result, action) => {
      if (result.kind === "ok")
        client.setQueryData<Awaited<ReturnType<typeof fetchEnvironments>>>(
          ["environments"],
          (old) =>
            old?.kind === "ok"
              ? {
                  kind: "ok",
                  body: {
                    ...old.body,
                    environments: old.body.environments.map((e) =>
                      e.name === environment.name ? result.body : e,
                    ),
                  },
                }
              : old,
        );
      else onError(`Could not ${action} ${environment.name}: ${result.message}`);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["environments"] });
    },
  });
  return (
    <tr>
      <td className="mono">
        {environment.name}
        <small className="muted" title={environment.url}>
          {environment.host}
        </small>
      </td>
      <td>
        <EnvironmentStatus status={row.status} />
      </td>
      <td className={`numeric ${environment.activeThreads === null ? "muted" : ""}`}>
        {row.activeThreads}
      </td>
      <td className="numeric">{row.scheduledThreads}</td>
      <td>
        <div className="environment-actions">
          {[row.pause, row.connection].map((button) => {
            const Icon =
              button.action === "pause"
                ? Pause
                : button.action === "resume"
                  ? Play
                  : button.action === "disconnect"
                    ? Unplug
                    : PlugZap;
            return (
              <Button
                key={button.action}
                variant="outline"
                size="sm"
                aria-label={`${button.label} ${environment.name}`}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(button.action)}
              >
                {mutation.isPending && mutation.variables === button.action ? (
                  <LoaderCircle className="environment-spinner" size={14} />
                ) : (
                  <Icon size={14} />
                )}{" "}
                {button.label}
              </Button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}
export function EnvironmentsTable({
  environments,
  onError,
}: {
  environments: readonly EnvironmentSummary[];
  onError: (message: string) => void;
}) {
  return (
    <div className="environments-table-scroll">
      <table className="environments-table">
        <colgroup>
          {[
            ["environment", 30],
            ["status", 24],
            ["active", 12],
            ["scheduled", 12],
            ["actions", 22],
          ].map(([name, width]) => (
            <col key={name} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {["Environment", "Status", "Active threads", "Scheduled threads", "Actions"].map(
              (h) => (
                <th key={h} className={h.includes("threads") ? "numeric" : undefined}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {environments.map((environment) => (
            <EnvironmentTableRow
              key={environment.name}
              environment={environment}
              onError={onError}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
