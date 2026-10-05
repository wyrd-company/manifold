// ---
// relationships:
//   implements: live-github-environment
// ---
import { setHookState } from "./hooks.ts";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "yaml";
import {
  ensureState,
  loadSettings,
  readApp,
  readCredential,
  stateDirectory,
  writeIfChanged,
} from "./settings.ts";
import { servicePort, writeConfiguration } from "./configuration.ts";
import { GitHub, installationAccess } from "./github.ts";
import { readResources } from "./provisioning.ts";
import { createForwarder } from "./forwarder.ts";
import { acquireControl, ChildLedger, recoverChildren } from "./supervisor.ts";
import type { ChildRecord, ControlLease, SupervisorStatus } from "./supervisor.ts";

export function serviceArguments(configuration: string, entry = "packages/service/dist/main.js") {
  return [resolve(entry), configuration];
}
export function serviceEnvironment(source: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) =>
      ["PATH", "HOME", "NODE_ENV", "NODE_EXTRA_CA_CERTS", "NODE_USE_SYSTEM_CA"].includes(key),
    ),
  );
}
export function tunnelConfiguration(
  host: string,
  token: string,
  forwarderPort: number,
  debuggerPort: number,
  directory: string,
) {
  if (/[\r\n]/.test(token)) throw Error("Invalid Pinggy token file");
  const quote = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  return `Host live\n HostName ${host}\n Port 443\n User ${quote(token)}\n RemoteForward 0 127.0.0.1:${forwarderPort}\n LocalForward 127.0.0.1:${debuggerPort} localhost:4300\n ServerAliveInterval 30\n ExitOnForwardFailure yes\n StrictHostKeyChecking accept-new\n UserKnownHostsFile ${quote(join(directory, "known_hosts"))}\n`;
}
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing debugger port");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
export function debuggerHttpsUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.origin : undefined;
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = debuggerHttpsUrl(entry);
      if (result) return result;
    }
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const result = debuggerHttpsUrl(entry);
      if (result) return result;
    }
  }
  return undefined;
}
export function startedAddress(line: string) {
  try {
    const value = JSON.parse(line) as { event?: string; detail?: { host?: string; port?: number } };
    if (
      value.event === "started" &&
      value.detail?.host === "127.0.0.1" &&
      Number.isInteger(value.detail.port) &&
      value.detail.port! > 0 &&
      value.detail.port! <= 65535
    )
      return `http://127.0.0.1:${value.detail.port}`;
  } catch {
    /* non-JSON output */
  }
  return undefined;
}
export function createSupervisorLogs(
  writer: (file: string, line: string) => Promise<void>,
  onFailure: () => void,
) {
  let queue = Promise.resolve();
  let failed = false;
  return {
    write(file: string, line: string) {
      queue = queue
        .then(async () => {
          if (failed) return;
          await writer(file, line);
        })
        .catch(() => {
          failed = true;
          // Logging is a synchronous callback boundary; its queue must never
          // reject into an event emitter or stop later cleanup attempts.
          try {
            onFailure();
          } catch {
            /* failure is already recorded */
          }
        });
    },
    flush: () => queue,
  };
}
export async function finishCleanup(steps: (() => Promise<unknown>)[], report: () => void) {
  let failed = false;
  for (const step of steps) {
    try {
      await step();
    } catch {
      failed = true;
      try {
        report();
      } catch {
        /* still release ownership */
      }
    }
  }
  return failed;
}
export async function runStart() {
  process.umask(0o077);
  const settings = await loadSettings();
  const directory = stateDirectory();
  await ensureState(directory);
  const abort = new AbortController();
  const status: SupervisorStatus = {
    instanceId: randomUUID(),
    answers: process.env["ANSWERS"] === "1",
  };
  const ledger = new ChildLedger(directory);
  let lease: ControlLease | undefined;
  let forwarder: Awaited<ReturnType<typeof createForwarder>> | undefined;
  let github: GitHub | undefined;
  let hookId: number | undefined;
  let service: ChildRecord | undefined;
  let operation = Promise.resolve();
  let ending: Promise<void> | undefined;
  let logs: ReturnType<typeof createSupervisorLogs>;
  let finish!: () => void;
  const ended = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const shutdown = () => {
    if (ending) return ending;
    status.stopping = true;
    abort.abort();
    ending = (async () => {
      await operation.catch(() => {});
      const failure = await finishCleanup(
        [
          async () => {
            if (github && hookId) {
              await setHookState(github, directory, hookId, false);
            }
          },
          () => ledger.stopAll(),
          () => rm(join(directory, "tunnel/config"), { force: true }),
          async () => {
            await forwarder?.close();
          },
          () => logs.flush(),
          async () => {
            await lease?.close();
          },
        ],
        () => {
          process.stderr.write("Live environment cleanup step failed\n");
        },
      );
      if (failure) process.exitCode = 1;
    })().finally(finish);
    return ending;
  };
  logs = createSupervisorLogs(
    (file, line) => appendFile(file, `${line}\n`, { mode: 0o600 }),
    () => {
      process.exitCode = 1;
      void shutdown();
      process.stderr.write("Live environment log write failed\n");
    },
  );
  lease = await acquireControl(
    directory,
    () => status,
    () => {
      void shutdown();
    },
  );
  const signal = () => {
    void shutdown();
  };
  process.on("SIGINT", signal);
  process.on("SIGTERM", signal);
  async function wait<T>(
    name: string,
    limit: number,
    read: () => Promise<T | undefined>,
  ): Promise<T> {
    const end = Date.now() + limit;
    while (Date.now() < end) {
      abort.signal.throwIfAborted();
      const result = await read();
      if (result !== undefined) return result;
      await delay(2000, undefined, { signal: abort.signal });
    }
    throw Error(`${name} not ready within ${limit / 1000} seconds`);
  }
  const initialize = async () => {
    await recoverChildren(directory, lease);
    abort.signal.throwIfAborted();
    github = new GitHub(settings.organization, await readCredential(settings.credentials.patFile));
    await github.preflight();
    try {
      await installationAccess(settings);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("App installation missing repository access:")
      )
        process.stderr.write(`${error.message}\n`);
      throw error;
    }
    const resources = await readResources(directory);
    hookId = resources.hook.id;
    const app = await readApp(settings);
    const token = await readCredential(settings.credentials.pinggyTokenFile);
    let overlay: Record<string, unknown> | undefined;
    if (process.env["OVERLAY"]) {
      const value: unknown = parse(await readFile(resolve(process.env["OVERLAY"]), "utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw Error("Configuration overlay must be a mapping");
      overlay = value as Record<string, unknown>;
    }
    const port = servicePort(process.env["SERVICE_PORT"]);
    const tunnelDirectory = join(directory, "tunnel");
    const serviceDirectory = join(directory, "service");
    await mkdir(tunnelDirectory, { recursive: true, mode: 0o700 });
    await mkdir(serviceDirectory, { recursive: true, mode: 0o700 });
    const log = (line: string) => {
      logs.write(join(tunnelDirectory, "supervisor.log"), line);
    };
    forwarder = await createForwarder({
      answers: status.answers,
      target: () => status.serviceAddress,
      log,
    });
    async function startService(url: string) {
      abort.signal.throwIfAborted();
      delete status.serviceAddress;
      await writeConfiguration(settings, directory, resources, app, {
        url,
        answers: status.answers,
        ...(port ? { port } : {}),
        ...(overlay ? { overlay } : {}),
      });
      const child = await ledger.launch(
        "service",
        process.execPath,
        serviceArguments(join(directory, "service.yml"), process.env["SERVICE_ENTRY"]),
        { cwd: process.cwd(), env: serviceEnvironment(process.env) },
      );
      service = child.record;
      status.service = { pid: child.record.pid, startTime: child.record.startTime };
      let address: string | undefined;
      let lines = "";

      const output = (chunk: Buffer) => {
        lines += chunk.toString();
        let index: number;
        while ((index = lines.indexOf("\n")) >= 0) {
          const line = lines.slice(0, index);
          lines = lines.slice(index + 1);
          address ??= startedAddress(line);
          logs.write(join(serviceDirectory, "service.log"), line);
        }
      };
      child.process.stdout.on("data", output);
      child.process.stderr.on("data", output);
      child.process.once("exit", () => {
        if (service?.pid === child.record.pid && !status.stopping) {
          process.stderr.write("Service ended\n");
          void shutdown();
        }
      });
      status.serviceAddress = await wait("Service started log", 120000, async () => address);
      await logs.flush();
    }
    async function updateHook(url: string) {
      abort.signal.throwIfAborted();
      const expected = `${url}/webhooks/github?owner-marker=${encodeURIComponent(settings.marker)}`;
      await setHookState(github!, directory, hookId!, true, expected);
    }
    let reconnecting = false;
    let initialized = false;
    async function startTunnel() {
      abort.signal.throwIfAborted();
      const debuggerPort = await freePort();
      const config = join(tunnelDirectory, "config");
      await writeIfChanged(
        config,
        tunnelConfiguration(
          settings.pinggyHost,
          token,
          forwarder!.port,
          debuggerPort,
          tunnelDirectory,
        ),
      );
      const child = await ledger.launch("tunnel", "ssh", ["-F", config, "-T", "-N", "live"], {
        env: serviceEnvironment(process.env),
      });
      let tunnelEnded = false;
      let lines = "";
      const output = (chunk: Buffer) => {
        lines += chunk.toString();
        let index: number;
        while ((index = lines.indexOf("\n")) >= 0) {
          const line = lines.slice(0, index).replaceAll(token, "[credential]");
          lines = lines.slice(index + 1);
          log(line);
        }
      };
      child.process.stdout.on("data", output);
      child.process.stderr.on("data", output);
      child.process.once("exit", () => {
        tunnelEnded = true;
        if (status.stopping || reconnecting || !initialized) return;
        reconnecting = true;
        operation = operation
          .then(async () => {
            await rm(config, { force: true });
            while (!status.stopping) {
              await delay(5000, undefined, { signal: abort.signal });
              let url: string;
              try {
                url = await startTunnel();
              } catch {
                if (!status.stopping) process.stderr.write("Tunnel reconnect will retry\n");
                continue;
              }
              if (url !== status.tunnelUrl) {
                status.tunnelUrl = url;
                if (status.answers && service) {
                  const previous = service;
                  service = undefined;
                  await ledger.stop(previous);
                  await startService(url);
                }
                await updateHook(url);
              }
              reconnecting = false;
              return;
            }
          })
          .catch(() => {
            if (!status.stopping) {
              process.stderr.write("Tunnel reconfiguration failed\n");
              void shutdown();
            }
          });
      });
      try {
        return await wait("Pinggy HTTPS URL", 30000, async () => {
          if (tunnelEnded) throw Error("Tunnel ended before HTTPS URL was read");
          try {
            const response = await fetch(`http://127.0.0.1:${debuggerPort}/urls`, {
              signal: AbortSignal.any([abort.signal, AbortSignal.timeout(2000)]),
            });
            if (!response.ok) return undefined;
            return debuggerHttpsUrl(await response.json());
          } catch {
            return undefined;
          }
        });
      } catch (error) {
        await ledger.stop(child.record);
        await rm(config, { force: true });
        throw error;
      }
    }
    status.tunnelUrl = await startTunnel();
    await startService(status.tunnelUrl);
    await updateHook(status.tunnelUrl);
    initialized = true;
    process.stdout.write(`Tunnel ${status.tunnelUrl}\nService ${status.serviceAddress}\n`);
  };
  operation = initialize();
  try {
    await operation;
    await ended;
  } catch (error) {
    await shutdown();
    if (!abort.signal.aborted || !(error instanceof Error && error.name === "AbortError"))
      throw error;
  } finally {
    process.off("SIGINT", signal);
    process.off("SIGTERM", signal);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runStart().catch(() => {
    process.stderr.write("Live environment start failed; check prerequisites and service log\n");
    process.exitCode = 1;
  });
}
