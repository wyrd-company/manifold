// ---
// relationships:
//   implements: live-github-environment
// ---
import { spawn, type SpawnOptions } from "node:child_process";
import { once } from "node:events";
import { chmod, lstat, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createHash, randomUUID } from "node:crypto";

export type ChildRecord = { role: "service" | "tunnel"; pid: number; startTime: string };
export type SupervisorStatus = {
  instanceId: string;
  answers: boolean;
  stopping?: boolean;
  tunnelUrl?: string;
  serviceAddress?: string;
  service?: { pid: number; startTime: string };
};
export async function processStartTime(pid: number) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return fields[0] === "Z" ? undefined : fields[19];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
async function socketIdentity(file: string) {
  try {
    return (await lstat(file)).ino;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function controlRequest(
  directory: string,
  request: "status" | "stop",
): Promise<SupervisorStatus | { stopping: true } | undefined> {
  return await new Promise((resolve) => {
    const socket = createConnection(join(directory, "control.sock"));
    let data = "";
    let ended = false;
    const finish = (value: SupervisorStatus | { stopping: true } | undefined) => {
      if (ended) return;
      ended = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(2000, () => finish(undefined));
    socket.on("error", () => finish(undefined));
    socket.on("end", () => finish(undefined));
    socket.on("connect", () => socket.write(`${JSON.stringify({ request })}\n`));
    socket.on("data", (chunk) => {
      data += String(chunk);
      if (data.includes("\n")) {
        try {
          finish(JSON.parse(data.split("\n")[0]!));
        } catch {
          finish(undefined);
        }
      }
    });
  });
}
export type ControlLease = { close: () => Promise<void>; owns: () => boolean };
export async function acquireControl(
  directory: string,
  status: () => SupervisorStatus,
  stop: () => void,
): Promise<ControlLease> {
  // A Linux abstract socket serializes stale-file reclamation. The kernel
  // releases it on death, so reclaiming a stale file cannot race another owner.
  const guard = createServer((socket) => socket.destroy());
  guard.listen(`\0manifold-live:${createHash("sha256").update(directory).digest("hex")}`);
  try {
    await once(guard, "listening");
  } catch {
    throw Error("Environment control socket already held");
  }
  const releaseGuard = () => new Promise<void>((resolve) => guard.close(() => resolve()));
  const file = join(directory, "control.sock");
  const previous = await socketIdentity(file);
  if (await controlRequest(directory, "status")) {
    await releaseGuard();
    throw Error("Environment supervisor already running");
  }
  if (previous !== undefined && (await socketIdentity(file)) === previous)
    await unlink(file).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  const server = createServer((socket) => {
    let data = "";
    socket.setTimeout(2000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      data += String(chunk);
      if (!data.includes("\n")) return;
      try {
        const message = JSON.parse(data.split("\n")[0]!) as { request: unknown };
        if (message.request === "status") socket.end(`${JSON.stringify(status())}\n`);
        else if (message.request === "stop") {
          socket.end('{"stopping":true}\n');
          stop();
        } else socket.end('{"error":"unknown request"}\n');
      } catch {
        socket.end('{"error":"invalid request"}\n');
      }
    });
  });
  server.listen(file);
  try {
    await once(server, "listening");
  } catch {
    await releaseGuard();
    throw Error("Environment control socket already held");
  }
  await chmod(file, 0o600);
  const own = await socketIdentity(file);
  let held = true;
  return {
    owns: () => held,
    close: async () => {
      if (!held) return;
      held = false;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if ((await socketIdentity(file)) === own)
        await unlink(file).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        });
      await releaseGuard();
    },
  };
}
async function readChildren(directory: string): Promise<ChildRecord[]> {
  try {
    const value: unknown = JSON.parse(await readFile(join(directory, "children.json"), "utf8"));
    if (
      !Array.isArray(value) ||
      !value.every(
        (record) =>
          record &&
          (record.role === "service" || record.role === "tunnel") &&
          Number.isSafeInteger(record.pid) &&
          record.pid > 0 &&
          typeof record.startTime === "string" &&
          /^\d+$/.test(record.startTime),
      )
    )
      throw Error("Invalid children ledger");
    return value as ChildRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function writeChildren(directory: string, records: ChildRecord[]) {
  const temporary = join(directory, `children.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(records)}\n`, { mode: 0o600 });
  await rename(temporary, join(directory, "children.json"));
}
export async function stopChild(
  record: ChildRecord,
  options: { graceMs?: number; pollMs?: number } = {},
) {
  if ((await processStartTime(record.pid)) !== record.startTime) return;
  try {
    process.kill(record.pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return;
  }
  const end = Date.now() + (options.graceMs ?? 60000);
  while (Date.now() < end && (await processStartTime(record.pid)) === record.startTime)
    await delay(options.pollMs ?? 100);
  if ((await processStartTime(record.pid)) === record.startTime) {
    try {
      process.kill(record.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    while ((await processStartTime(record.pid)) === record.startTime)
      await delay(options.pollMs ?? 100);
  }
}
export async function recoverChildren(
  directory: string,
  lease?: ControlLease,
  options: { graceMs?: number; pollMs?: number } = {},
) {
  if (!lease?.owns()) throw Error("Child recovery requires control socket owner");
  const records = await readChildren(directory);
  for (const record of records) await stopChild(record, options);
  if (records.length) await writeChildren(directory, []);
}
export async function withRecoveryLease<T>(directory: string, run: () => Promise<T>): Promise<T> {
  const lease = await acquireControl(
    directory,
    () => ({ instanceId: "recovery", answers: false, stopping: true }),
    () => {},
  );
  try {
    await recoverChildren(directory, lease);
    return await run();
  } finally {
    await lease.close();
  }
}
export class ChildLedger {
  private readonly directory: string;
  private change = Promise.resolve();
  private closed = false;
  private children = new Map<number, Promise<void>>();
  constructor(directory: string) {
    this.directory = directory;
  }
  private update(transform: (records: ChildRecord[]) => ChildRecord[]) {
    const result = this.change.then(async () =>
      writeChildren(this.directory, transform(await readChildren(this.directory))),
    );
    this.change = result.catch(() => {});
    return result;
  }
  async launch(
    role: ChildRecord["role"],
    program: string,
    args: string[],
    options: SpawnOptions & { beforeGo?: (record: ChildRecord) => Promise<void> } = {},
  ) {
    if (this.closed) throw Error("Child ledger is shutting down");
    const { beforeGo, ...spawnOptions } = options;
    const child = spawn("sh", ["-c", 'read -r go && exec "$0" "$@"', program, ...args], {
      ...spawnOptions,
      stdio: ["pipe", "pipe", "pipe"],
    });
    await once(child, "spawn");
    const pid = child.pid!;
    const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
    this.children.set(pid, closed);
    const startTime = await processStartTime(pid);
    if (!startTime) {
      child.stdin.end();
      throw Error("Child ended before recording");
    }
    const record = { role, pid, startTime };
    child.on("exit", () => {
      if (this.closed) return;
      void this.update((records) =>
        records.filter((value) => value.pid !== pid || value.startTime !== startTime),
      ).catch(() => {});
    });
    try {
      await this.update((records) => [...records, record]);
      await beforeGo?.(record);
      child.stdin.end("go\n");
    } catch (error) {
      child.stdin.end();
      await once(child, "exit");
      throw error;
    }
    return { process: child, record };
  }
  async stopAll(options: { graceMs?: number; pollMs?: number } = {}) {
    this.closed = true;
    await this.change;
    for (const record of (await readChildren(this.directory)).toReversed()) {
      await stopChild(record, options);
      await this.children.get(record.pid);
      this.children.delete(record.pid);
      await this.update((records) =>
        records.filter((value) => value.pid !== record.pid || value.startTime !== record.startTime),
      );
    }
    await this.change;
  }
  async stop(record: ChildRecord, options: { graceMs?: number; pollMs?: number } = {}) {
    await stopChild(record, options);
    await this.children.get(record.pid);
    this.children.delete(record.pid);
    await this.update((records) =>
      records.filter((value) => value.pid !== record.pid || value.startTime !== record.startTime),
    );
  }
}
export async function stopEnvironment(
  directory: string,
  options: { waitMs?: number; pollMs?: number; graceMs?: number } = {},
) {
  if (await controlRequest(directory, "status")) {
    await controlRequest(directory, "stop");
    const end = Date.now() + (options.waitMs ?? 60000);
    while (Date.now() < end) {
      if (!(await controlRequest(directory, "status"))) break;
      await delay(options.pollMs ?? 100);
    }
    if (await controlRequest(directory, "status")) return "pending" as const;
  }
  const lease = await acquireControl(
    directory,
    () => ({ instanceId: "recovery", answers: false, stopping: true }),
    () => {},
  );
  try {
    await recoverChildren(directory, lease, options);
  } finally {
    await lease.close();
  }
  return "stopped" as const;
}
