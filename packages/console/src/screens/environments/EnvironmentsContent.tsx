// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchEnvironments } from "../../api/environments.ts";
import { Button } from "../../ui/button.tsx";
import { navigation } from "../../shell/navigation.ts";
import { EmptyState } from "../EmptyContent.tsx";
import { EnvironmentsTable } from "./EnvironmentsTable.tsx";
import { HostInstructions } from "./HostInstructions.tsx";
import { environmentsCaption } from "./rows.ts";
import "./environments.css";
export function EnvironmentsContent() {
  const query = useQuery({
    queryKey: ["environments"],
    queryFn: fetchEnvironments,
    retry: false,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  const [toast, setToast] = useState<string>();
  const result = query.data;
  const entry = navigation.find((e) => e.label === "Environments")!;
  return (
    <div className="environments-screen">
      <div className="environments-heading">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh Environments"
          onClick={() => {
            void query.refetch();
          }}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {!result ? (
        <p role="status">Loading environments…</p>
      ) : result.kind === "failed" ? (
        <div className="error-alert" role="alert">
          {result.message}
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {result.body.environments.length ? (
            <EnvironmentsTable environments={result.body.environments} onError={setToast} />
          ) : (
            <EmptyState
              icon={entry.icon}
              title="No environments"
              description="Add one to the service configuration on the host."
            />
          )}
          <p className="muted environments-caption">
            {environmentsCaption(result.body.environments)}
          </p>
        </>
      )}
      <HostInstructions
        configurationFile={result?.kind === "ok" ? result.body.configurationFile : undefined}
      />
      {toast ? (
        <div className="save-toast" role="status">
          {toast}
          <Button variant="ghost" onClick={() => setToast(undefined)}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}
