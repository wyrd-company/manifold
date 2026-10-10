// ---
// relationships:
//   verifies: live-github-environment
// ---
import { test, expect } from "vite-plus/test";
import { createServer } from "node:http";
import { once } from "node:events";
import { hasTaskActor, deliveryIssue } from "./smoke-http.ts";
test("reads actorId from the actual actors API response shape", async () => {
  const server = createServer((req, res) => {
    expect(req.url).toBe("/api/actors");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ actors: [{ actorId: "task:sample-id", states: ["waiting"] }] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("address");
  try {
    expect(await hasTaskActor(`http://127.0.0.1:${address.port}`, "sample-id")).toBe(true);
    expect(await hasTaskActor(`http://127.0.0.1:${address.port}`, "other-id")).toBe(false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("Project delivery issue is under projects_v2_item", () => {
  expect(deliveryIssue({ projects_v2_item: { content_node_id: "sample-id" } })).toBe("sample-id");
  expect(deliveryIssue({ issue: { node_id: "wrong" } })).toBeUndefined();
});
