// ---
// relationships:
//   implements: [usage-intake, host-cli-usage]
// ---
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { UsageMapping, UsagePushRequest } from "@wyrd-company/manifold-shared";
import type { Writable } from "node:stream";
import { isUsagePushResult } from "@wyrd-company/manifold-shared";
import { decodeUsageBatches, defaultUsageRoots } from "../usage/index.ts";
import type { UsageRoot, UsageProvider, UsageSourceStamp } from "../usage/types.ts";
import { decoderRevision } from "../usage/revision.generated.ts";
import { readSessionMappings } from "./mappings.ts";
export { readSessionMappings } from "./mappings.ts";
const providers = new Set(["claude", "codex", "cursor", "grok", "opencode"]);
export async function runUsagePush(
  args: readonly string[],
  io: {
    stdout: Writable;
    stderr: Writable;
    env: Readonly<Record<string, string | undefined>>;
    home: string;
    decoderRevision?: string;
  },
): Promise<number> {
  const flags = new Map<string, string>(),
    roots: UsageRoot[] = [];
  const validFlags = new Set(["--service", "--environment", "--t3-home", "--state-dir"]);
  try {
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i],
        value = args[i + 1];
      if (!flag || !value) throw Error();
      if (flag === "--root") {
        const index = value.indexOf("=");
        const provider = value.slice(0, index),
          path = value.slice(index + 1);
        if (index < 1 || !providers.has(provider) || !path) throw Error();
        roots.push({ provider: provider as UsageProvider, path });
      } else {
        if (!validFlags.has(flag) || flags.has(flag)) throw Error();
        flags.set(flag, value);
      }
    }
    const url = new URL(flags.get("--service") ?? "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !flags.get("--environment")?.match(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
    )
      throw Error();
  } catch {
    io.stderr.write("Invalid usage push arguments\n");
    return 2;
  }
  const service = flags.get("--service")!.replace(/\/+$/, "");
  const environment = flags.get("--environment")!;
  const stateDir =
    flags.get("--state-dir") ??
    join(io.env["XDG_STATE_HOME"] ?? join(io.home, ".local", "state"), "manifold-host");
  const databasePath = join(
    flags.get("--t3-home") ?? io.env["T3CODE_HOME"] ?? join(io.home, ".t3"),
    "userdata",
    "state.sqlite",
  );
  const statePath = join(
    stateDir,
    "usage-push",
    createHash("sha256")
      .update(JSON.stringify([service, environment, io.decoderRevision ?? decoderRevision]))
      .digest("hex") + ".json",
  );
  const state: Record<string, UsageSourceStamp> = {};
  const sourceKey = (stamp: UsageSourceStamp) => JSON.stringify([stamp.provider, stamp.path]);
  try {
    const parsed: unknown = JSON.parse(await readFile(statePath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      Object.assign(state, parsed);
  } catch {
    /* Missing or corrupt state only costs a replay. */
  }
  const mappingsPath = statePath.replace(/\.json$/, ".mappings.json");
  const acknowledgements: Record<string, { threadId: string; providerInstance?: string }> = {};
  const mappingKey = (mapping: UsageMapping) =>
    JSON.stringify([mapping.provider, mapping.providerSessionId]);
  const mappingValue = (mapping: UsageMapping) => ({
    threadId: mapping.threadId,
    ...(mapping.providerInstance === undefined
      ? {}
      : { providerInstance: mapping.providerInstance }),
  });
  try {
    const parsed: unknown = JSON.parse(await readFile(mappingsPath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      Object.assign(acknowledgements, parsed);
  } catch {
    /* Missing or corrupt acknowledgements only cost a replay. */
  }
  const checkpoint = async (path: string, value: unknown) => {
    await mkdir(join(stateDir, "usage-push"), { recursive: true });
    const temporary = path + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(value));
    await rename(temporary, path);
  };
  const result = {
    batches: 0,
    requests: 0,
    skippedSources: 0,
    calls: { accepted: 0, pending: 0, replayed: 0 },
    threads: { accepted: 0, replayed: 0, conflicting: 0 },
  };
  const send = async (threads: UsageMapping[], records: UsagePushRequest["records"]) => {
    const response = await fetch(service + "/api/usage/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment, threads, records }),
      redirect: "error",
    });
    if (response.status !== 200) throw Error(`Service answered ${response.status}`);
    const counts: unknown = await response.json();
    if (!isUsagePushResult(counts)) throw new Error("Invalid usage acknowledgement");
    for (const key of ["accepted", "pending", "replayed"] as const)
      result.calls[key] += counts.calls[key];
    for (const key of ["accepted", "replayed", "conflicting"] as const)
      result.threads[key] += counts.threads[key];
    result.requests++;
    if (threads.length) {
      for (const mapping of threads) acknowledgements[mappingKey(mapping)] = mappingValue(mapping);
      await checkpoint(mappingsPath, acknowledgements);
    }
  };
  const transientSources = new Set<string>();
  const outputError = () => {};
  io.stdout.on("error", outputError);
  try {
    const mappings = readSessionMappings(databasePath).filter(
      (mapping) =>
        JSON.stringify(acknowledgements[mappingKey(mapping)]) !==
        JSON.stringify(mappingValue(mapping)),
    );
    for (let start = 0; start < mappings.length; start += 1000)
      await send(mappings.slice(start, start + 1000), []);
    for await (const batch of decodeUsageBatches(
      roots.length ? roots : defaultUsageRoots(io.env, io.home),
      {
        skip: (stamp) => {
          const same = JSON.stringify(state[sourceKey(stamp)]) === JSON.stringify(stamp);
          if (same) result.skippedSources++;
          return same;
        },
      },
    )) {
      for (const record of batch.records)
        if (
          record.type === "source-error" &&
          (record.code === "unreadable" || record.code === "decoder-failed")
        )
          transientSources.add(JSON.stringify([record.provider, record.source]));
      for (let start = 0; start < batch.records.length; start += 1000) {
        const records = batch.records.slice(start, start + 1000);
        const sessions = new Set(
          records
            .filter((r) => r.type === "call")
            .map((r) => JSON.stringify([r.provider, r.providerSessionId])),
        );
        const threads = readSessionMappings(databasePath).filter((mapping) =>
          sessions.has(JSON.stringify([mapping.provider, mapping.providerSessionId])),
        );
        await send(threads, records);
      }
      for (const stamp of batch.sources) {
        if (
          [stamp.path, ...stamp.files.map((file) => file.path)].some((path) =>
            transientSources.has(JSON.stringify([stamp.provider, path])),
          )
        )
          continue;
        state[sourceKey(stamp)] = stamp;
      }
      await checkpoint(statePath, state);
      result.batches++;
    }
    await new Promise<void>((resolve, reject) =>
      io.stdout.write(JSON.stringify(result) + "\n", (error) =>
        error ? reject(error) : resolve(),
      ),
    );
    return 0;
  } catch (error) {
    io.stderr.write(`Usage push stopped: ${error instanceof Error ? error.message : "failed"}\n`);
    return 1;
  } finally {
    io.stdout.off("error", outputError);
  }
}
