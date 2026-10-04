// ---
// relationships:
//   verifies: escalations
// ---
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createActor, createMachine } from "xstate";
import { afterEach, expect, test } from "vite-plus/test";
import { fixture, serve, readRequest, eventually, request } from "./test-support.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanup.splice(0).toReversed()) await clean();
});
interface Publish {
  topic: string;
  sequence_id: string;
  message: string;
  actions?: { action: string; body?: string; url: string; headers?: Record<string, string> }[];
  click?: string;
}
async function notified(
  options: {
    statuses?: number[];
    drop?: boolean;
    posture?: "open" | "reserved" | "self-hosted";
    question?: string;
    credential?: boolean;
    freeText?: boolean;
    hold?: boolean;
    requestTimeoutMs?: number;
  } = {},
) {
  const messages: Publish[] = [];
  const headers: (string | undefined)[] = [];
  let anonymous = 0;
  let finish: (() => void) | undefined;
  const ntfy = await serve((req, res) => {
    if (req.method === "GET") {
      anonymous++;
      res.end("[]");
      return;
    }
    void readRequest(req).then((body) => {
      messages.push(JSON.parse(body) as Publish);
      headers.push(req.headers.authorization);
      res.statusCode = options.statuses?.[messages.length - 1] ?? 200;
      if (res.statusCode >= 300 && res.statusCode < 400) res.setHeader("Location", "/unexpected");
      if (options.hold && messages.length === 1) {
        finish = () => res.end("{}");
        return;
      }
      if (options.drop && messages.length === 1) {
        req.socket.destroy();
        return;
      }
      res.end("{}");
    });
  });
  cleanup.push(ntfy.close);
  let time = Date.now();
  const f = fixture({
    configuration: {
      publicUrl: "http://localhost",
      destinations: {
        default: {
          server: ntfy.url,
          topic: "opaque-topic",
          posture: options.posture ?? "open",
          priority: 4,
          ...(options.credential ? { credential: "publisher" } : {}),
        },
      },
      requestTimeoutMs: options.requestTimeoutMs ?? 1000,
      retryIntervalMs: 60,
    },
    clock: { now: () => time },
    invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
    tokenFile: () => join(f.directory, "token"),
  });
  cleanup.push(f.close);
  if (options.credential) writeFileSync(join(f.directory, "token"), "publish-key");
  const actor = options.freeText
    ? createActor(
        createMachine({
          initial: "asking",
          states: {
            asking: {
              invoke: {
                src: f.module.escalate,
                input: { question: options.question ?? "Proceed?", freeText: true },
              },
            },
          },
        }),
      ).start()
    : undefined;
  if (actor)
    cleanup.push(async () => {
      actor.stop();
    });
  const escalation = actor
    ? f.module.list({})[0]!
    : f.module.raise({ ...request, question: options.question ?? request.question });
  f.module.start();
  await eventually(() => expect(messages).toHaveLength(1));
  return {
    ...f,
    messages,
    headers,
    escalation,
    advance: () => {
      time += 100;
    },
    now: () => time,
    anonymous: () => anonymous,
    finish: () => finish?.(),
    ntfy,
  };
}
test("ntfy JSON has stable sequence id, bearer token and usable HTTP buttons; close replaces the ask", async () => {
  const f = await notified({ credential: true, posture: "reserved" });
  expect(f.messages[0]).toMatchObject({
    topic: "opaque-topic",
    sequence_id: f.escalation.id,
    actions: [
      { action: "http", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      { action: "http" },
    ],
  });
  expect(f.headers[0]).toBe("Bearer publish-key");
  expect(f.anonymous()).toBe(1);
  expect(f.warnings.some((line) => line.includes("readable without a credential"))).toBe(true);
  const button = f.messages[0]!.actions![0]!;
  const api = await serve(f.module.requestListener);
  cleanup.push(api.close);
  const key = new URLSearchParams(button.body).get("key")!;
  expect(
    await (await fetch(api.url + "/escalations/" + f.escalation.id + "?key=" + key)).text(),
  ).toContain("Try the delivery again?");
  expect(f.module.get(f.escalation.id)?.status).toBe("open");
  const result = await fetch(api.url + "/escalations/" + f.escalation.id + "/answer", {
    method: "POST",
    headers: button.headers!,
    body: button.body!,
  });
  expect(result.status).toBe(200);
  expect(result.headers.get("access-control-allow-origin")).toBe("*");
  await eventually(() => expect(f.messages).toHaveLength(2));
  expect(f.messages[1]).toMatchObject({
    sequence_id: f.escalation.id,
    message: "Answered: Retry (link)",
  });
  expect(f.messages[1]?.actions).toBeUndefined();
  expect(f.messages[1]?.click).toBeUndefined();
  const persisted = JSON.stringify(
    f.store.connection.database.prepare("SELECT * FROM escalation_notification").all(),
  );
  for (const secret of ["opaque-topic", f.ntfy.url, "publish-key", key])
    expect(persisted).not.toContain(secret);
  for (const secret of ["opaque-topic", f.ntfy.url, "publish-key", key])
    expect(f.warnings.join(" ")).not.toContain(secret);
});
test("500 retries the same buttons and reads a rotated token; 400 is terminal and gets no close", async () => {
  const f = await notified({ statuses: [500, 200], credential: true });
  await eventually(() =>
    expect(
      f.store.connection.database.prepare("SELECT last_error FROM escalation_notification").get()?.[
        "last_error"
      ],
    ).toBe("500"),
  );
  const first = f.messages[0];
  writeFileSync(join(f.directory, "token"), "rotated-key");
  f.advance();
  await eventually(() => expect(f.messages).toHaveLength(2));
  expect(f.messages[1]).toEqual(first);
  expect(f.headers[1]).toBe("Bearer rotated-key");
  const refused = await notified({ statuses: [400] });
  await eventually(() =>
    expect(
      refused.store.connection.database
        .prepare("SELECT status FROM escalation_notification")
        .get()?.["status"],
    ).toBe("failed"),
  );
  refused.module.answer(refused.escalation.id, { choice: "retry" }, "api");
  refused.advance();
  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(refused.messages).toHaveLength(1);
});
test("retry time starts when the response completes", async () => {
  const f = await notified({ statuses: [500, 200], hold: true });
  f.advance();
  f.finish();
  await eventually(() =>
    expect(
      f.store.connection.database
        .prepare("SELECT last_error,next_attempt_at FROM escalation_notification")
        .get(),
    ).toMatchObject({ last_error: "500", next_attempt_at: f.now() + 60 }),
  );
  expect(f.messages).toHaveLength(1);
  f.advance();
  await eventually(() => expect(f.messages).toHaveLength(2));
  expect(f.messages[1]).toEqual(f.messages[0]);
});
test.each(["drop", "timeout", "inflight"] as const)(
  "an ask with an uncertain publication gets one close, after the request ends: %s",
  async (mode) => {
    const f = await notified({
      drop: mode === "drop",
      hold: mode !== "drop",
      requestTimeoutMs: mode === "timeout" ? 50 : 1000,
    });
    f.module.answer(f.escalation.id, { choice: "retry" }, "api");
    if (mode === "inflight") f.finish();
    await eventually(() => expect(f.messages).toHaveLength(2));
    expect(f.messages[1]).toMatchObject({
      message: "Answered: Retry (api)",
      sequence_id: f.escalation.id,
    });
  },
);
test("a failed second attempt closes an earlier uncertain publication", async () => {
  const f = await notified({ drop: true, statuses: [200, 400] });
  await eventually(() =>
    expect(
      f.store.connection.database.prepare("SELECT last_error FROM escalation_notification").get()?.[
        "last_error"
      ],
    ).toBe("unavailable"),
  );
  f.advance();
  await eventually(() => expect(f.messages).toHaveLength(2));
  await eventually(() =>
    expect(
      f.store.connection.database.prepare("SELECT status FROM escalation_notification").get()?.[
        "status"
      ],
    ).toBe("failed"),
  );
  f.module.answer(f.escalation.id, { choice: "retry" }, "api");
  await eventually(() => expect(f.messages).toHaveLength(3));
  expect(f.messages[2]?.actions).toBeUndefined();
});
test("ending before the first attempt sends nothing", async () => {
  const ntfy = await serve(() => {
    throw new Error("No request expected");
  });
  cleanup.push(ntfy.close);
  const f = fixture({
    configuration: {
      publicUrl: "http://localhost",
      destinations: {
        default: { server: ntfy.url, topic: "opaque-topic", posture: "open", priority: 4 },
      },
      requestTimeoutMs: 50,
      retryIntervalMs: 60,
    },
  });
  cleanup.push(f.close);
  const escalation = f.module.raise(request);
  f.module.answer(escalation.id, { choice: "retry" }, "api");
  f.module.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(
    f.store.connection.database
      .prepare("SELECT status,attempts FROM escalation_notification")
      .get(),
  ).toMatchObject({ status: "cancelled", attempts: 0 });
});
test.each(["x", "😀"])(
  "close messages fit 4096 bytes and retain the full answer: %s",
  async (char) => {
    const f = await notified({ freeText: true, question: "😀".repeat(8000) });
    expect(Buffer.byteLength(f.messages[0]!.message)).toBeLessThanOrEqual(4096);
    expect(f.messages[0]?.actions?.[0]?.action).toBe("view");
    const text = char.repeat(4096);
    f.module.answer(f.escalation.id, { text }, "api");
    await eventually(() => expect(f.messages).toHaveLength(2));
    expect(Buffer.byteLength(f.messages[1]!.message)).toBeLessThanOrEqual(4096);
    expect(f.messages[1]?.message.endsWith("…")).toBe(true);
    expect(f.module.get(f.escalation.id)?.answer?.value).toEqual({ text });
  },
);

test("302 fails the notification, clears its message, and sends no retry or close", async () => {
  const f = await notified({ statuses: [302] });
  await eventually(() =>
    expect(
      f.store.connection.database
        .prepare("SELECT status,message,last_error FROM escalation_notification")
        .get(),
    ).toMatchObject({ status: "failed", message: null, last_error: "302" }),
  );
  f.advance();
  f.module.answer(f.escalation.id, { choice: "retry" }, "api");
  await new Promise((resolve) => setTimeout(resolve, 90));
  expect(f.messages).toHaveLength(1);
  expect(f.anonymous()).toBe(0);
});
test("open posture warns about exposure and a short topic without polling", async () => {
  const f = await notified();
  expect(f.warnings).toContain(
    "Notification destination default: anyone who knows its topic can read and answer questions",
  );
  expect(f.warnings).toContain(
    "Notification destination default: topic name is shorter than 32 characters",
  );
  expect(f.anonymous()).toBe(0);
});
test("self-hosted posture on ntfy.sh warns about the hosted service", async () => {
  const f = fixture({
    configuration: {
      destinations: {
        default: {
          server: "https://ntfy.sh",
          topic: "opaque-topic",
          posture: "self-hosted",
          priority: 4,
          credential: "publisher",
        },
      },
      requestTimeoutMs: 1000,
      retryIntervalMs: 60,
    },
    fetch: async () => new Response(null, { status: 403 }),
  });
  cleanup.push(f.close);
  f.module.start();
  await eventually(() =>
    expect(f.warnings).toContain(
      "Notification destination default: self-hosted posture uses the hosted service",
    ),
  );
});
