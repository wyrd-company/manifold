// ---
// relationships:
//   implements: host-cli-hook
// ---
import { parseArgs } from "node:util";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { Worker } from "node:worker_threads";
import { serviceConfigurationSchema } from "@wyrd-company/manifold-shared";
export interface HookConfiguration {
  service: string;
  environment: string;
  provider: string;
  databasePath: string;
  timeoutMs: number;
}
function options(args: string[]): HookConfiguration {
  const parsed = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    tokens: true,
    options: {
      service: { type: "string" },
      environment: { type: "string" },
      provider: { type: "string" },
      "t3-home": { type: "string" },
      "timeout-ms": { type: "string" },
    },
  });
  const seen = new Set<string>();
  for (const token of parsed.tokens)
    if (token.kind === "option") {
      if (seen.has(token.name)) throw Error(`Option --${token.name} cannot be repeated`);
      seen.add(token.name);
    }
  const { service, environment, provider } = parsed.values;
  if (!service || !environment || !provider)
    throw Error("--service, --environment and --provider are required");
  const url = new URL(service);
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("--service must be an http or https URL");
  const declared = serviceConfigurationSchema.$defs["declared-name"];
  if (environment.length > declared.maxLength || !new RegExp(declared.pattern).test(environment))
    throw Error("--environment must be a declared name");
  if (!["claude", "codex", "cursor"].includes(provider))
    throw Error("--provider must be claude, codex or cursor");
  const timeout = parsed.values["timeout-ms"] ?? "2000";
  const timeoutMs = Number(timeout);
  if (
    !/^\d+$/.test(timeout) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 10000
  )
    throw Error("--timeout-ms must be an integer from 100 to 10000");
  return {
    service: url.href.replace(/\/$/, ""),
    environment,
    provider,
    timeoutMs,
    databasePath: join(
      parsed.values["t3-home"] ?? process.env["T3CODE_HOME"] ?? join(homedir(), ".t3"),
      "userdata",
      "state.sqlite",
    ),
  };
}
export async function hookCommand(args: string[]) {
  let config: HookConfiguration;
  try {
    config = options(args);
  } catch (error) {
    process.stderr.write(`${String(error)}\n`);
    return 2;
  }
  const deadline = setTimeout(() => {
    process.stderr.write("Mail notice hook reached its deadline.\n");
    process.exit(0);
  }, config.timeoutMs);
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > 1024 * 1024) throw Error("Hook input exceeds 1 MiB");
      chunks.push(bytes);
    }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof input !== "object" || input === null || Array.isArray(input))
      throw Error("Expected a hook input object");
    const worker = new Worker(join(dirname(process.argv[1]!), "hook", "worker.ts"), {
      workerData: { config, input },
    });
    const answer = await new Promise<{ notice: string | null; error?: string }>(
      (resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
        worker.once("exit", (code) => {
          if (code !== 0) reject(Error(`Hook worker exited ${code}`));
        });
      },
    );
    if (answer.error) throw Error(answer.error);
    if (answer.notice !== null) {
      const output =
        config.provider === "cursor"
          ? { additional_context: answer.notice }
          : {
              hookSpecificOutput: {
                hookEventName: "PostToolUse",
                additionalContext: answer.notice,
              },
            };
      process.stdout.write(JSON.stringify(output) + "\n");
    }
    await worker.terminate();
  } catch (error) {
    process.stderr.write(`Mail notice hook: ${String(error)}\n`);
  }
  clearTimeout(deadline);
  // Ending the process also closes stdin if a provider left it open after a rejected input.
  process.exit(0);
}
