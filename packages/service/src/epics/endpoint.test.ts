// ---
// relationships:
//   verifies: epics-api
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { isEpicResponse, isEpicRootsResponse } from "@wyrd-company/manifold-shared/epics-api";
import { epicWorld } from "./test-fixtures/world.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";
import { openEpics } from "./index.ts";
const api = parse(
  readFileSync(
    new URL("../../../../docs/specifications/epics-api.openapi.yml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
ajv.addFormat("uri", {
  type: "string",
  validate: (v: string) => /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(v),
});
ajv.addSchema({ $id: "epics", ...api });
test("HTTP reads a populated three-level mirror and real tasks from two bound Projects", async () => {
  const f = epicWorld(),
    server = await consoleHost();
  try {
    server.host.mount("/api/epics", f.epics.requestListener);
    const roots = await fetch(server.url + "/api/epics?ignored=yes"),
      rootsBody = await roots.json();
    expect(roots.status).toBe(200);
    expect(roots.headers.get("cache-control")).toBe("no-store");
    expect(ajv.compile({ $ref: "epics#/components/schemas/EpicRootsResponse" })(rootsBody)).toBe(
      true,
    );
    expect(isEpicRootsResponse(rootsBody)).toBe(true);
    expect(rootsBody.roots.map((r: { issue: { nodeId: string } }) => r.issue.nodeId)).toEqual([
      "root",
      "outside",
      "orphan",
      "closed-root",
    ]);
    const response = await fetch(server.url + "/api/epics/%72oot"),
      body = await response.json();
    expect(response.headers.get("content-type")).toBe("application/json");
    const validate = ajv.compile({ $ref: "epics#/components/schemas/EpicResponse" });
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(isEpicResponse(body)).toBe(true);
    if (!isEpicResponse(body)) throw new Error("Invalid epic");
    expect(body.epic.issues.map((i) => [i.issue.nodeId, i.placement, i.parent])).toEqual([
      ["root", "root", undefined],
      ["waiting", "tree", "root"],
      ["branch", "tree", "root"],
      ["parcel", "tree", "branch"],
      ["untracked", "tree", "root"],
      ["outside", "outside", undefined],
      ["external", "outside", undefined],
      ["external-two", "outside", undefined],
    ]);
    expect(body.epic.issues.find((i) => i.issue.nodeId === "parcel")?.task).toEqual({
      actorId: "task:parcel",
      projects: [
        { binding: "delivery", status: "Ready" },
        { binding: "secondary", status: null },
      ],
      actor: { status: "done", states: ["delivered"] },
      openEscalations: 1,
    });
    expect(body.epic.issues.find((i) => i.issue.nodeId === "untracked")?.task).toBeUndefined();
    expect(body.epic.dependencies).toEqual([
      { blocking: "outside", blocked: "branch" },
      { blocking: "external", blocked: "branch" },
      { blocking: "waiting", blocked: "parcel" },
      { blocking: "branch", blocked: "parcel" },
      { blocking: "parcel", blocked: "external-two" },
    ]);
    expect((await (await fetch(server.url + "/api/epics/branch")).json()).epic.root).toBe("branch");
    for (const path of ["unknown", "untracked", "root/extra"])
      expect((await fetch(server.url + "/api/epics/" + path)).status).toBe(404);
    const archived = await (await fetch(server.url + "/api/epics/archived")).json();
    expect(archived.epic.issues[0].task).toBeUndefined();
    const method = await fetch(server.url + "/api/epics/root", { method: "POST" });
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET");
  } finally {
    await server.close();
    await f.close();
  }
});
test("read errors produce an empty 500 and log the request path", async () => {
  const server = await consoleHost(),
    logs: unknown[] = [];
  try {
    const epics = openEpics({
      github: {
        trackedIssues: () => {
          throw new Error("mirror unavailable");
        },
      },
      tasks: { list: () => ({ projects: [] }) },
      log: (entry) => logs.push(entry),
    });
    server.host.mount("/api/epics", epics.requestListener);
    const response = await fetch(server.url + "/api/epics");
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    expect(logs).toEqual([{ level: "error", path: "/api/epics", error: "mirror unavailable" }]);
  } finally {
    await server.close();
  }
});
