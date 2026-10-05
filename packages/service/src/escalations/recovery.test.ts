// ---
// relationships:
//   verifies: escalations
// ---
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Snapshot } from "xstate";
import { createActor, createMachine, assign } from "xstate";
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { openEscalations, heldActorHandler } from "./index.ts";
import { serve, readRequest, eventually, request } from "./test-support.ts";
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const clean of cleanup.splice(0).toReversed()) await clean();
});
function path() {
  const directory = mkdtempSync(join(tmpdir(), "questions-crash-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "store.sqlite");
}
async function crash(path: string, mode: string, server?: string) {
  const worker = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("./test-fixtures/fault-process.ts", import.meta.url)),
      path,
      mode,
      ...(server ? [server] : []),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  worker.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      worker.on("error", reject);
      worker.on("exit", (code, signal) => resolve({ code, signal }));
    },
  );
  expect(exit, stderr).toEqual({ code: null, signal: "SIGKILL" });
}
function reopen(path: string, server?: string) {
  const store = openStore({ path });
  cleanup.push(() => store.close());
  const releases: string[] = [];
  const module = openEscalations({
    store,
    configuration: {
      publicUrl: "http://localhost",
      destinations: server
        ? { default: { server, topic: "opaque-topic", posture: "open", priority: 4 } }
        : {},
      requestTimeoutMs: 1000,
      retryIntervalMs: 1000,
    },
    tokenFile: () => "",
    handlers: {
      "intake-failed": () => {},
      "comparator-failed": () => {},
      "held-actor": heldActorHandler((id) => releases.push(id)),
      "stranded-token": () => {},
    },
    invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
  });
  cleanup.push(() => module.stop());
  return { store, module, releases };
}
test.each(["answer", "exit"])(
  "SIGKILL before save restores the asking state and takes the answer once: %s",
  async (mode) => {
    const file = path();
    await crash(file, mode);
    const f = reopen(file);
    const escalation = f.module.list({})[0]!;
    if (mode === "exit") {
      expect(escalation.status).toBe("open");
      f.module.answer(escalation.id, { text: "Proceed" }, "api");
    }
    const snapshot = f.store.loadSnapshot("parcel")!.snapshot;
    const actor = createActor(
      createMachine({
        initial: "asking",
        context: { answers: 0 },
        states: {
          asking: {
            invoke: { src: f.module.escalate, input: { question: "Send it?", freeText: true } },
            on: {
              "escalation.answered": {
                actions: assign({ answers: ({ context }) => context.answers + 1 }),
              },
            },
          },
        },
      }),
      { snapshot: snapshot as unknown as Snapshot<unknown> },
    ).start();
    expect(actor.getSnapshot().context.answers).toBe(1);
    f.module.saving({
      machine: "delivery",
      entered: [],
      entries: {},
      actorId: "parcel",
      snapshot: { status: "active", value: "asking" },
      activeInvokes: [{ invokeId: "ask", entryId: "1" }],
    });
    actor.stop();
  },
);
test("SIGKILL after a retry answer commits resumes its handler exactly once", async () => {
  const file = path();
  await crash(file, "handler");
  const f = reopen(file);
  expect(f.module.list({})[0]?.status).toBe("answered");
  f.module.start();
  f.module.start();
  expect(f.releases).toEqual(["parcel"]);
  expect(f.module.raise(request).raiser).toMatchObject({ occurrence: 2 });
});
test.each(["replay", "answer", "withdraw"] as const)(
  "SIGKILL after ntfy accepts retains the message and converges on restart: %s",
  async (outcome) => {
    const messages: {
      click?: string;
      actions?: unknown[];
      sequence_id: string;
      message: string;
    }[] = [];
    const ntfy = await serve((req, res) => {
      void readRequest(req).then((body) => {
        messages.push(JSON.parse(body) as (typeof messages)[number]);
        res.end("{}");
      });
    });
    cleanup.push(ntfy.close);
    const file = path();
    await crash(file, "publish", ntfy.url);
    expect(messages).toHaveLength(1);
    const f = reopen(file, ntfy.url);
    const escalation = f.module.list({})[0]!;
    if (outcome === "answer") f.module.answer(escalation.id, { choice: "retry" }, "api");
    if (outcome === "withdraw") f.module.withdraw(request);
    f.module.start();
    await eventually(() => expect(messages).toHaveLength(2));
    expect(messages[1]?.sequence_id).toBe(messages[0]?.sequence_id);
    if (outcome === "replay") {
      expect(messages[1]).toEqual(messages[0]);
      const host = await serve(f.module.requestListener);
      cleanup.push(host.close);
      const key = new URL(messages[1]!.click!).searchParams.get("key")!;
      expect(
        (
          await fetch(`${host.url}/escalations/${escalation.id}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ key, choice: "retry" }).toString(),
          })
        ).status,
      ).toBe(200);
    } else {
      expect(messages[1]?.actions).toBeUndefined();
      expect(messages[1]?.message).toBe(
        outcome === "answer" ? "Answered: Retry (api)" : "Withdrawn",
      );
    }
  },
);
