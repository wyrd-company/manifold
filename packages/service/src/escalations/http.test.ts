// ---
// relationships:
//   verifies: escalation-contract
// ---
import { createActor, createMachine, assign } from "xstate";
import { afterEach, expect, test } from "vite-plus/test";
import { fixture, serve, readRequest, eventually } from "./test-support.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanup.splice(0).toReversed()) await clean();
});
async function endpoints() {
  let key = "";
  const ntfy = await serve((req, res) => {
    void readRequest(req).then((body) => {
      const value = JSON.parse(body) as { click?: string };
      if (value.click) key = new URL(value.click).searchParams.get("key")!;
      res.end("{}");
    });
  });
  cleanup.push(ntfy.close);
  const f = fixture({
    configuration: {
      publicUrl: "http://localhost",
      destinations: {
        default: { server: ntfy.url, topic: "opaque-topic", posture: "open", priority: 4 },
      },
      requestTimeoutMs: 1000,
      retryIntervalMs: 1000,
    },
    invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
  });
  cleanup.push(f.close);
  const machine = createMachine({
    initial: "asking",
    context: { answers: 0 },
    states: {
      asking: {
        invoke: {
          src: f.module.escalate,
          input: {
            question: "<script>Question</script>",
            freeText: true,
            choices: [{ id: "send", label: "Send" }],
          },
        },
        on: {
          "escalation.answered": {
            actions: assign({ answers: ({ context }) => context.answers + 1 }),
          },
        },
      },
    },
  });
  const actor = createActor(machine).start();
  cleanup.push(async () => {
    actor.stop();
  });
  const escalation = f.module.list({})[0]!;
  const host = await serve((req, res) => {
    if (req.url?.startsWith("/api/")) f.module.apiListener(req, res);
    else f.module.requestListener(req, res);
  });
  cleanup.push(host.close);
  f.module.start();
  await eventually(() => expect(key).not.toBe(""));
  return { ...f, actor, id: escalation.id, key, url: host.url };
}
test.each(["link", "api"] as const)(
  "first answer wins from simultaneous %s posts; GET never answers",
  async (channel) => {
    const f = await endpoints();
    const page = await fetch(`${f.url}/escalations/${f.id}?key=${f.key}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("&lt;script&gt;");
    expect(f.actor.getSnapshot().context.answers).toBe(0);
    expect((await fetch(`${f.url}/escalations/${f.id}?key=wrong`)).status).toBe(404);
    const api = channel === "api";
    const path = `${f.url}/${api ? "api/" : ""}escalations/${f.id}/answer`;
    const responses = await Promise.all(
      ["First", "Second"].map((text) =>
        fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": api ? "application/json" : "application/x-www-form-urlencoded",
          },
          body: api
            ? JSON.stringify({ text })
            : new URLSearchParams({ key: f.key, text }).toString(),
        }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(f.actor.getSnapshot().context.answers).toBe(1);
    expect(f.module.get(f.id)?.answer?.channel).toBe(channel);
    const list = (await (await fetch(f.url + "/api/escalations?status=answered")).json()) as {
      escalations: unknown[];
    };
    expect(list.escalations).toHaveLength(1);
    const read = await (await fetch(f.url + "/api/escalations/" + f.id)).json();
    expect(read).toEqual(f.module.get(f.id));
  },
);
test.each(["form", "json", "escaped"] as const)(
  "4096 four-byte code points are accepted and retained over %s",
  async (encoding) => {
    const f = await endpoints();
    const text = "😀".repeat(4096);
    const api = encoding !== "form";
    const body =
      encoding === "form"
        ? new URLSearchParams({ key: f.key, text }).toString()
        : encoding === "escaped"
          ? ' {"text":"' + "\\ud83d\\ude00".repeat(4096) + '"}'
          : JSON.stringify({ text });
    const response = await fetch(`${f.url}/${api ? "api/" : ""}escalations/${f.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": api ? "application/json" : "application/x-www-form-urlencoded" },
      body,
    });
    expect(response.status).toBe(200);
    expect(f.module.get(f.id)?.answer?.value).toEqual({ text });
    expect(f.actor.getSnapshot().context.answers).toBe(1);
  },
);
test.each(["form", "json", "escaped"] as const)(
  "4097 code points and bodies over 64 KiB are refused over %s",
  async (encoding) => {
    const f = await endpoints();
    const api = encoding !== "form";
    const path = `${f.url}/${api ? "api/" : ""}escalations/${f.id}/answer`;
    const headers = {
      "Content-Type": api ? "application/json" : "application/x-www-form-urlencoded",
    };
    const text = "😀".repeat(4097);
    const body =
      encoding === "form"
        ? new URLSearchParams({ key: f.key, text }).toString()
        : encoding === "escaped"
          ? ' {"text":"' + "\\ud83d\\ude00".repeat(4097) + '"}'
          : JSON.stringify({ text });
    expect((await fetch(path, { method: "POST", headers, body })).status).toBe(400);
    expect((await fetch(path, { method: "POST", headers, body: "x".repeat(65537) })).status).toBe(
      413,
    );
    expect(f.module.get(f.id)?.status).toBe("open");
  },
);
test("malformed requests never change the escalation", async () => {
  const f = await endpoints();
  const path = f.url + "/escalations/" + f.id + "/answer";
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  for (const value of [
    { key: "wrong", choice: "send" },
    { key: f.key, choice: "missing" },
    { key: f.key, choice: "send", text: "Both" },
    { key: f.key },
  ])
    expect(
      (await fetch(path, { method: "POST", headers, body: new URLSearchParams(value).toString() }))
        .status,
    ).toBe(value.key === "wrong" ? 404 : 400);
  expect((await fetch(path)).status).toBe(405);
  expect((await fetch(f.url + "/api/escalations?status=missing")).status).toBe(400);
  f.module.saving({
    actorId: "parcel",
    snapshot: { status: "active", value: "later" },
    activeInvokes: [],
  });
  expect(
    (
      await fetch(path, {
        method: "POST",
        headers,
        body: new URLSearchParams({ key: f.key, choice: "send" }).toString(),
      })
    ).status,
  ).toBe(200);
  expect(f.actor.getSnapshot().context.answers).toBe(0);
});
