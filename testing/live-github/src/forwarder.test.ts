// ---
// relationships:
//   verifies: live-github-environment
// ---
import { createServer, request } from "node:http";
import { once } from "node:events";
import { afterEach, expect, test } from "vite-plus/test";
import { createForwarder } from "./forwarder.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function fixture(answers: boolean) {
  const received: {
    url: string;
    method: string;
    body: string;
    headers: Record<string, unknown>;
  }[] = [];
  const logs: string[] = [];
  const echo = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    received.push({ url: req.url!, method: req.method!, body, headers: req.headers });
    res.writeHead(202, { "x-echo": "yes" });
    res.end(body);
  });
  echo.listen(0, "127.0.0.1");
  await once(echo, "listening");
  cleanup.push(() => new Promise<void>((resolve) => echo.close(() => resolve())));
  const address = echo.address();
  if (!address || typeof address === "string") throw Error("address");
  const forwarder = await createForwarder({
    answers,
    target: () => `http://127.0.0.1:${address.port}`,
    log: (line) => logs.push(line),
  });
  cleanup.push(forwarder.close);
  async function send(method: string, path: string) {
    return await new Promise<{ status: number; headers: Record<string, unknown>; body: string }>(
      (resolve, reject) => {
        const req = request(
          forwarder.address,
          {
            method,
            path,
            headers: {
              "content-length": "6",
              "x-example": "kept",
              connection: "x-remove",
              "x-remove": "gone",
            },
          },
          async (res) => {
            let body = "";
            for await (const chunk of res) body += String(chunk);
            resolve({ status: res.statusCode!, headers: res.headers, body });
          },
        );
        req.on("error", reject);
        req.end("sample");
      },
    );
  }
  return { received, logs, send };
}
for (const answers of [false, true])
  test(`passes only exact raw paths (answers=${answers})`, async () => {
    const { received, logs, send } = await fixture(answers);
    const id = "abcdefghijklmnopqrstuv";
    const webhook = await send("POST", "/webhooks/github?owner-marker=example");
    expect(webhook.status).toBe(202);
    expect(webhook.body).toBe("sample");
    expect(received[0]).toMatchObject({
      url: "/webhooks/github",
      method: "POST",
      body: "sample",
      headers: { "x-example": "kept" },
    });
    expect(received[0]!.headers["x-remove"]).toBeUndefined();
    const page = await send("GET", `/escalations/${id}?key=secret-answer`);
    const answer = await send("POST", `/escalations/${id}/answer?key=dropped`);
    expect(page.status).toBe(answers ? 202 : 404);
    expect(answer.status).toBe(answers ? 202 : 404);
    if (answers) {
      expect(received[1]!.url).toBe(`/escalations/${id}?key=secret-answer`);
      expect(received[2]!.url).toBe(`/escalations/${id}/answer`);
    }
    for (const [method, path] of [
      ["GET", "/webhooks/github"],
      ["POST", "/webhooks/github/"],
      ["POST", "/webhooks/github/x"],
      ["POST", "/webhooks/%67ithub"],
      ["POST", "/webhooks/../webhooks/github"],
      ["GET", "/api/actors"],
      ["GET", "/escalations"],
      ["GET", "/"],
      ["GET", `/escalations/${id}/answer`],
      ["GET", `/escalations/${id}/`],
      ["POST", `/escalations/${id}/answer/x`],
    ]) {
      const result = await send(method!, path!);
      expect(result).toMatchObject({
        status: 404,
        headers: { "x-live-forwarder": "refused" },
        body: "",
      });
    }
    expect(received).toHaveLength(answers ? 3 : 1);
    expect(logs.join("\n")).not.toContain("secret-answer");
    expect(logs.join("\n")).not.toContain("?");
  });
test("passed paths return 503 until service listens", async () => {
  const forwarder = await createForwarder({
    answers: false,
    target: () => undefined,
    log: () => {},
  });
  cleanup.push(forwarder.close);
  const response = await fetch(`${forwarder.address}/webhooks/github`, { method: "POST" });
  expect(response.status).toBe(503);
});
