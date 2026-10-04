// ---
// relationships:
//   implements: usage-decoder
//   references: host-cli-usage
// ---
import { join, resolve } from "node:path";
import { Writable } from "node:stream";
import { decodeCursor } from "./cursor.ts";
import { decodeGrokSource } from "./grok.ts";
import { decodeOpenCode, openCodeFileUnits } from "./opencode.ts";
import { decodeClaude } from "./claude.ts";
import { decodeRollout, orderCodex } from "./codex.ts";
import { compareTotals, normalize } from "./normalize.ts";
import {
  DedupSet,
  discover,
  Problems,
  realpath,
  SourceReadError,
  modificationTime,
} from "./source.ts";
import type { Source, UsageCall, UsageProvider, UsageRecord, UsageRoot } from "./types.ts";
export type { UsageProvider, UsageRoot, UsageRecord } from "./types.ts";

const providers: UsageProvider[] = ["claude", "codex", "cursor", "grok", "opencode"];
export function defaultUsageRoots(
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): UsageRoot[] {
  return [
    { provider: "claude", path: env["CLAUDE_CONFIG_DIR"] || join(home, ".claude") },
    { provider: "codex", path: env["CODEX_HOME"] || join(home, ".codex") },
    { provider: "cursor", path: join(home, ".cursor") },
    { provider: "grok", path: env["GROK_HOME"] || join(home, ".grok") },
    {
      provider: "opencode",
      path:
        env["OPENCODE_DATA_DIR"] ||
        join(env["XDG_DATA_HOME"] || join(home, ".local", "share"), "opencode"),
    },
  ];
}
export async function* decodeUsage(roots: readonly UsageRoot[]): AsyncIterable<UsageRecord> {
  for (const provider of providers) {
    let sources: Source[] = [];
    const paths = new Set<string>();
    for (const root of roots.filter((root) => root.provider === provider)) {
      let found;
      try {
        found = await discover(root);
      } catch {
        yield {
          type: "source-error",
          provider,
          source: resolve(root.path),
          code: "unreadable",
          records: 1,
        };
        continue;
      }
      for (const source of found) {
        try {
          const path = await realpath(source.path);
          if (paths.has(path)) continue;
          paths.add(path);
          sources.push({ ...source, path });
        } catch {
          yield {
            type: "source-error",
            provider,
            source: source.path,
            code: "unreadable",
            records: 1,
          };
        }
      }
    }
    if (provider === "codex") sources = await orderCodex(sources);
    const fileUnits = provider === "opencode" ? await openCodeFileUnits(sources) : [];
    const reportedErrors = new Set<string>();
    const seen = new DedupSet();
    let agentParents = new Map<string, string>();
    const totals = new Map<string, UsageCall>();
    for (const source of sources) {
      const problems = new Problems(source);
      // Commit dedup memory only after the entire source succeeds.
      const nextParents = new Map(agentParents);
      try {
        const mtime = await modificationTime(source.path);
        const groups =
          provider === "claude"
            ? await decodeClaude(source, problems, seen, nextParents)
            : provider === "codex"
              ? await decodeRollout(source, problems, seen)
              : provider === "cursor"
                ? await decodeCursor(source, problems, seen)
                : provider === "grok"
                  ? await decodeGrokSource(source, problems, seen)
                  : await decodeOpenCode(source, problems, seen, fileUnits);
        const calls = groups.flatMap(({ unit, calls }) =>
          calls.map((call) => normalize(provider, unit, call, mtime)),
        );
        seen.commit();
        agentParents = nextParents;
        for (const call of calls) {
          if (call.granularity === "session-total") {
            const previous = totals.get(call.key);
            if (!previous || compareTotals(call, previous) > 0) totals.set(call.key, call);
          } else yield call;
        }
      } catch (error) {
        seen.rollback();
        problems.add(
          error instanceof SourceReadError ? "unreadable" : "decoder-failed",
          undefined,
          error instanceof SourceReadError ? error.database : undefined,
        );
      }
      for (const error of problems.records()) {
        const key = `${error.source}/${error.code}`;
        if (reportedErrors.has(key)) continue;
        reportedErrors.add(key);
        yield error;
      }
    }
    yield* totals.values();
  }
}
export async function runUsageCommand(
  args: readonly string[],
  io: {
    stdout: Writable;
    stderr: Writable;
    env: Readonly<Record<string, string | undefined>>;
    home: string;
  },
): Promise<number> {
  const roots: UsageRoot[] = [];
  if (args[0] !== "decode") {
    io.stderr.write("Expected usage decode\n");
    return 2;
  }
  for (let i = 1; i < args.length; i += 2) {
    const value = args[i + 1];
    const separator = value?.indexOf("=") ?? -1;
    const provider = value?.slice(0, separator);
    const path = value?.slice(separator + 1);
    if (
      args[i] !== "--root" ||
      separator < 1 ||
      !providers.includes(provider as UsageProvider) ||
      !path
    ) {
      io.stderr.write("Invalid usage decode arguments\n");
      return 2;
    }
    roots.push({ provider: provider as UsageProvider, path });
  }
  const outputError = () => {};
  io.stdout.on("error", outputError);
  try {
    for await (const record of decodeUsage(
      roots.length ? roots : defaultUsageRoots(io.env, io.home),
    )) {
      await new Promise<void>((done, reject) => {
        io.stdout.write(`${JSON.stringify(record)}\n`, (error) => (error ? reject(error) : done()));
      });
    }
    return 0;
  } catch {
    io.stderr.write("Usage decode stopped before completion\n");
    return 1;
  } finally {
    io.stdout.off("error", outputError);
  }
}
