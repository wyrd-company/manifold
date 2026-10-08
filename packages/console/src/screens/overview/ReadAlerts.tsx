// ---
// relationships:
//   implements: operator-console
// ---
import { Button } from "../../ui/button.tsx";
export function ReadAlerts({
  reads,
}: {
  reads: Readonly<
    Record<
      string,
      {
        data: { kind: string; message?: string } | undefined;
        refetch(): Promise<unknown>;
      }
    >
  >;
}) {
  return Object.entries(reads).map(([key, read]) =>
    read.data?.kind === "failed" ? (
      <div role="alert" className="error-alert" key={key}>
        <p>{read.data.message}</p>
        <Button
          variant="outline"
          onClick={() => {
            void read.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    ) : null,
  );
}
