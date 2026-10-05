// ---
// relationships:
//   verifies: live-github-environment
// ---
import { expect, test } from "vite-plus/test";
import {
  debuggerHttpsUrl,
  serviceEnvironment,
  serviceArguments,
  startedAddress,
  tunnelConfiguration,
} from "./start.ts";
test("service environment excludes unrelated credentials and shell settings", () => {
  expect(
    serviceEnvironment({
      PATH: "/bin",
      HOME: "/home/example",
      NODE_ENV: "test",
      TOKEN: "example-secret",
      PAT_FILE: "/secret",
      NODE_OPTIONS: "--require /secret",
      SSH_AUTH_SOCK: "/secret",
    }),
  ).toEqual({ PATH: "/bin", HOME: "/home/example", NODE_ENV: "test" });
});
test("tunnel token is confined to OpenSSH configuration with loopback forwards", () => {
  const config = tunnelConfiguration(
    "example.invalid",
    "synthetic-token",
    1234,
    4567,
    "/tmp/example",
  );
  expect(config).toContain('User "synthetic-token"');
  expect(config).toContain("RemoteForward 0 127.0.0.1:1234");
  expect(config).toContain("LocalForward 127.0.0.1:4567 localhost:4300");
  expect(() =>
    tunnelConfiguration("example.invalid", "bad\nHost evil", 1, 2, "/tmp/example"),
  ).toThrow("Invalid");
});
test("debugger discovery accepts public HTTPS urls only", () => {
  expect(
    debuggerHttpsUrl({
      urls: { https: "https://example.invalid", http: "http://example.invalid" },
    }),
  ).toBe("https://example.invalid");
  expect(
    debuggerHttpsUrl({ urls: ["http://example.invalid", "https://user:password@example.invalid"] }),
  ).toBeUndefined();
});
test("started log accepts only a bound loopback address", () => {
  expect(
    startedAddress(JSON.stringify({ event: "started", detail: { host: "127.0.0.1", port: 1234 } })),
  ).toBe("http://127.0.0.1:1234");
  expect(
    startedAddress(JSON.stringify({ event: "started", detail: { host: "0.0.0.0", port: 1234 } })),
  ).toBeUndefined();
  expect(startedAddress("{")).toBeUndefined();
});

test("rejecting log writer reports once, requests shutdown, and flushes without rejection", async () => {
  const { createSupervisorLogs } = await import("./start.ts");
  const events: string[] = [];
  const logs = createSupervisorLogs(
    async () => {
      throw Error("synthetic disk failure with unsafe context");
    },
    () => {
      events.push("reported");
      events.push("stop");
    },
  );
  logs.write("/example/service.log", "first");
  logs.write("/example/service.log", "second");
  await expect(logs.flush()).resolves.toBeUndefined();
  expect(events).toEqual(["reported", "stop"]);
});
test("cleanup stops real children and closes its socket even when logging and hook cleanup reject", async () => {
  const { finishCleanup } = await import("./start.ts");
  const { acquireControl, controlRequest, ChildLedger, processStartTime } =
    await import("./supervisor.ts");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const directory = await mkdtemp(join(tmpdir(), "live-cleanup-"));
  const lease = await acquireControl(
    directory,
    () => ({ instanceId: "fixture", answers: false, stopping: true }),
    () => {},
  );
  const ledger = new ChildLedger(directory);
  const child = await ledger.launch("service", process.execPath, [
    "-e",
    "setInterval(()=>{},1000)",
  ]);
  let reports = 0;
  try {
    const failed = await finishCleanup(
      [
        async () => {
          throw Error("synthetic hook failure with unsafe context");
        },
        () => ledger.stopAll({ graceMs: 100, pollMs: 5 }),
        async () => {
          throw Error("synthetic log flush failure with unsafe context");
        },
        () => lease.close(),
      ],
      () => {
        reports++;
      },
    );
    expect(failed).toBe(true);
    expect(reports).toBe(2);
    expect(await processStartTime(child.record.pid)).toBeUndefined();
    expect(await controlRequest(directory, "status")).toBeUndefined();
  } finally {
    await ledger.stopAll({ graceMs: 100, pollMs: 5 });
    await lease.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("archive startup uses the extracted entry and one configuration argument", () => {
  expect(
    serviceArguments("/deployment/service.yml", "/install/manifold-service/dist/main.js"),
  ).toEqual(["/install/manifold-service/dist/main.js", "/deployment/service.yml"]);
  expect(serviceArguments("/deployment/service.yml")[0]).toMatch(
    /packages\/service\/dist\/main.js$/,
  );
});
