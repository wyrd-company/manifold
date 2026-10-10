// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "../../ui/button.tsx";
const example = `credentials:
  site-a-token:
    kind: t3code-token
    tokenFile: site-a.token
environments:
  site-a:
    url: http://127.0.0.1:3773
    credential: site-a-token`;
export function HostInstructions({ configurationFile }: { configurationFile: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <section className="environment-instructions">
      <h2>Add or remove an environment</h2>
      <p>
        Environments are declared in the service configuration on the service host, with the T3 Code
        token each one uses. The console does not change service configuration.
      </p>
      <p>
        To add one: write its token to a file on the service host, readable only by the service,
        then add the environment under <code>environments</code> and its credential under{" "}
        <code>credentials</code> in{" "}
        {configurationFile ? <code>{configurationFile}</code> : "the service configuration file"},
        and restart the service.
      </p>
      <div className="environment-example">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy example"
          onClick={() => {
            void copy();
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
        <pre>{example}</pre>
      </div>
      {error ? <p role="alert">Could not copy the example.</p> : null}
      <p>
        To remove one: delete its entry and restart the service. A task actor on a removed
        environment fails its next thread or turn command.
      </p>
    </section>
  );
}
