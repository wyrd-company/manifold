// ---
// relationships:
//   verifies: live-github-environment
// ---
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import { afterEach, expect, test } from "vite-plus/test";
import {
  acquireControl,
  controlRequest,
  ChildLedger,
  processStartTime,
  recoverChildren,
  stopEnvironment,
} from "./supervisor.ts";
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function directory() {
  const dir = await mkdtemp(join(tmpdir(), "live-supervisor-"));
  directories.push(dir);
  return dir;
}
const status = { instanceId: "example", answers: false };
test("control lease refuses second owner and answers status until shutdown completes", async () => {
  const dir = await directory();
  const control = await acquireControl(
    dir,
    () => status,
    () => {},
  );
  expect(await controlRequest(dir, "status")).toEqual(status);
  await expect(
    acquireControl(
      dir,
      () => status,
      () => {},
    ),
  ).rejects.toThrow("already");
  await expect(recoverChildren(dir)).rejects.toThrow("owner");
  await control.close();
  expect(await controlRequest(dir, "status")).toBeUndefined();
});
test("stop stays pending while the control socket closes before its ownership guard", async () => {
  const dir = await directory();
  const control = await acquireControl(
    dir,
    () => status,
    () => {},
  );
  // An accepted connection holds close open after the server stops listening.
  const connection = createConnection(join(dir, "control.sock"));
  await once(connection, "connect");
  expect(await controlRequest(dir, "status")).toEqual(status);
  const before = "[]\n";
  await writeFile(join(dir, "children.json"), before);
  const closing = control.close();
  try {
    expect(await controlRequest(dir, "status")).toBeUndefined();
    expect(await stopEnvironment(dir)).toBe("pending");
    expect(await readFile(join(dir, "children.json"), "utf8")).toBe(before);
  } finally {
    connection.destroy();
    await closing;
  }
  expect(await stopEnvironment(dir)).toBe("stopped");
});
test("stop propagates acquisition failures other than guard contention", async () => {
  const dir = await directory();
  await expect(stopEnvironment(join(dir, "missing"))).rejects.toThrow();
});
test("child gate durably records identity before running program and recovery ends it", async () => {
  const dir = await directory();
  const control = await acquireControl(
    dir,
    () => status,
    () => {},
  );
  const ledger = new ChildLedger(dir);
  let released = false;
  const child = await ledger.launch(
    "service",
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    {
      beforeGo: async (record) => {
        expect(JSON.parse(await readFile(join(dir, "children.json"), "utf8"))).toEqual([record]);
        expect(await processStartTime(record.pid)).toBe(record.startTime);
        released = true;
      },
    },
  );
  try {
    expect(released).toBe(true);
    expect(await processStartTime(child.record.pid)).toBe(child.record.startTime);
    await recoverChildren(dir, control, { graceMs: 100, pollMs: 5 });
    expect(await processStartTime(child.record.pid)).toBeUndefined();
    expect(JSON.parse(await readFile(join(dir, "children.json"), "utf8"))).toEqual([]);
  } finally {
    // Recovery observes process death; the local ledger still owns its exit write.
    await ledger.stop(child.record, { graceMs: 100, pollMs: 5 });
    await control.close();
  }
});
test("recovery never signals a reused identity, including the start entrypoint", async () => {
  const dir = await directory();
  const child = spawn(process.execPath, [
    "--input-type=module",
    "-e",
    `await import(${JSON.stringify(new URL("./start.ts", import.meta.url).href)});console.log("ready");setInterval(()=>{},1000)`,
  ]);
  await once(child, "spawn");
  const childEnded = once(child, "exit");
  await once(child.stdout!, "data");
  try {
    const control = await acquireControl(
      dir,
      () => status,
      () => {},
    );
    const identity = await processStartTime(child.pid!);
    await writeFile(
      join(dir, "children.json"),
      JSON.stringify([{ role: "service", pid: child.pid!, startTime: `${identity}0` }]),
      { mode: 0o600 },
    );
    await recoverChildren(dir, control, { graceMs: 10, pollMs: 2 });
    expect(await processStartTime(child.pid!)).toBe(identity);
    expect(JSON.parse(await readFile(join(dir, "children.json"), "utf8"))).toEqual([]);
    await control.close();
  } finally {
    child.kill("SIGKILL");
    await childEnded;
  }
});
test("pending stop leaves ledger untouched while sole owner kills SIGTERM-ignoring children", async () => {
  const dir = await directory();
  let stopping = false;
  let shutdown = Promise.resolve();
  const ledger = new ChildLedger(dir);
  const control = await acquireControl(
    dir,
    () => ({ ...status, stopping }),
    () => {
      if (stopping) return;
      stopping = true;
      shutdown = ledger.stopAll({ graceMs: 200, pollMs: 5 }).then(() => control.close());
    },
  );
  const child = await ledger.launch("service", process.execPath, [
    "-e",
    "process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)",
  ]);
  await once(child.process.stdout!, "data");
  const before = await readFile(join(dir, "children.json"), "utf8");
  expect(await stopEnvironment(dir, { waitMs: 30, pollMs: 5, graceMs: 100 })).toBe("pending");
  expect(await readFile(join(dir, "children.json"), "utf8")).toBe(before);
  await once(child.process, "exit");
  await shutdown;
  expect(await stopEnvironment(dir, { waitMs: 100, pollMs: 5, graceMs: 100 })).toBe("stopped");
  expect(await processStartTime(child.record.pid)).toBeUndefined();
});

async function killedSupervisor(
  directory: string,
  stage: "before-go" | "after-go" | "two-children",
) {
  const module = new URL("./supervisor.ts", import.meta.url).href;
  const program = `import {acquireControl,ChildLedger} from ${JSON.stringify(module)};
 const dir=${JSON.stringify(directory)};
 const lease=await acquireControl(dir,()=>({instanceId:'fixture',answers:false}),()=>{});
 const ledger=new ChildLedger(dir);const records=[];
 const pause=async record=>{console.log(JSON.stringify([record]));await new Promise(()=>{});};
 const first=await ledger.launch('tunnel',process.execPath,['-e','setInterval(()=>{},1000)'],${stage === "before-go" ? " {beforeGo:pause}" : "{}"});
 records.push(first.record);
 ${stage === "two-children" ? "const second=await ledger.launch('service',process.execPath,['-e','setInterval(()=>{},1000)']);records.push(second.record);" : ""}
 console.log(JSON.stringify(records));await new Promise(()=>{});`;
  const owner = spawn(process.execPath, ["--input-type=module", "-e", program], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let text = "";
  const records = await new Promise<
    { role: "service" | "tunnel"; pid: number; startTime: string }[]
  >((resolve, reject) => {
    owner.stdout.on("data", (chunk) => {
      text += String(chunk);
      if (text.includes("\n")) resolve(JSON.parse(text.split("\n")[0]!));
    });
    owner.on("exit", () => reject(Error("Fixture owner exited before ready")));
    owner.stderr.on("data", (chunk) => reject(Error(String(chunk))));
  });
  owner.kill("SIGKILL");
  await once(owner, "exit");
  return records;
}
for (const stage of ["before-go", "after-go", "two-children"] as const)
  test(`SIGKILL ${stage} leaves gated records recovered by next start and stop`, async () => {
    for (const command of ["start", "stop"]) {
      const dir = await directory();
      const records = await killedSupervisor(dir, stage);
      expect(JSON.parse(await readFile(join(dir, "children.json"), "utf8"))).toEqual(records);
      if (command === "start") {
        const lease = await acquireControl(
          dir,
          () => status,
          () => {},
        );
        await recoverChildren(dir, lease, { graceMs: 100, pollMs: 5 });
        await lease.close();
      } else expect(await stopEnvironment(dir, { graceMs: 100, pollMs: 5 })).toBe("stopped");
      for (const record of records) expect(await processStartTime(record.pid)).toBeUndefined();
      expect(JSON.parse(await readFile(join(dir, "children.json"), "utf8"))).toEqual([]);
    }
  });
test("concurrent stale-socket acquisition has only one cleanup owner", async () => {
  const dir = await directory();
  await killedSupervisor(dir, "before-go");
  const contenders = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      acquireControl(
        dir,
        () => status,
        () => {},
      ),
    ),
  );
  const owners = contenders.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  expect(owners).toHaveLength(1);
  expect(await controlRequest(dir, "status")).toEqual(status);
  await recoverChildren(dir, owners[0]!, { graceMs: 100, pollMs: 5 });
  await owners[0]!.close();
});
