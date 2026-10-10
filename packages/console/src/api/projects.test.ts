// ---
// relationships:
//   verifies: [projects-api, operator-console]
// ---
import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  applyProject,
  fetchProjectPlan,
  fetchProjects,
  isProjectApplyResponse,
  isProjectPlanResponse,
  isProjectsResponse,
  mapProjectResult,
} from "./projects.ts";
const configuration = { state: "in-sync" };
const summary = {
  binding: "shipping",
  owner: "example",
  number: 1,
  projectNodeId: null,
  portfolioItem: "shipping",
  environment: "local",
  configuration,
  lastApplied: null,
  observedAt: null,
};
const change = {
  id: "create-status",
  storage: "project-field",
  target: { field: "Status", lifecycle: true },
  description: "Create the Status field.",
  action: "create",
  side: "github",
  drift: false,
  requiresRemoval: false,
  properties: ["name"],
  from: null,
  to: {
    name: "Status",
    type: "single-select",
    options: [{ name: "Ready", color: "blue", description: "Ready to ship." }],
  },
};
const plan = {
  binding: "shipping",
  owner: "example",
  number: 1,
  projectNodeId: "project-1",
  declarationCommit: "a".repeat(40),
  observedAt: 10,
  observation: { status: "fresh" },
  configuration,
  changes: [change],
  digest: "b".repeat(64),
  fields: [{ field: "Status", lifecycle: true, github: "missing", detail: "Creates Status." }],
  frontMatter: null,
};
const applied = {
  outcome: "applied",
  writes: 1,
  configuration,
  declarationCommit: "a".repeat(40),
  changes: [{ ...change, outcome: "applied" }],
};
afterEach(() => vi.unstubAllGlobals());
test("guards check every nested Project response used by the console", () => {
  expect(isProjectsResponse({ projects: [summary] })).toBe(true);
  expect(
    isProjectsResponse({
      projects: [
        {
          ...summary,
          configuration: { state: "pending", count: 2 },
          lastApplied: { at: 0, commit: "revision" },
        },
      ],
    }),
  ).toBe(true);
  expect(isProjectPlanResponse(plan)).toBe(true);
  expect(
    isProjectPlanResponse({
      ...plan,
      observation: { status: "stale", message: "Offline" },
      frontMatter: { mismatched: 2 },
    }),
  ).toBe(true);
  expect(isProjectApplyResponse(applied)).toBe(true);
  for (const value of [
    { ...plan, observation: { status: "stale" } },
    { ...plan, fields: [{ ...plan.fields[0], github: "unknown" }] },
    { ...plan, changes: [{ ...change, properties: ["name", "name"] }] },
    { ...plan, changes: [{ ...change, to: { name: "Ready", color: "invalid", description: "" } }] },
    { ...plan, configuration: { state: "pending", count: 0 } },
    { ...plan, unknown: true },
  ])
    expect(isProjectPlanResponse(value)).toBe(false);
  expect(isProjectsResponse({ projects: [{ ...summary, number: 0 }] })).toBe(false);
  expect(isProjectsResponse({ projects: [{ ...summary, lastApplied: { at: 1 } }] })).toBe(false);
  expect(isProjectApplyResponse({ ...applied, changes: [{ ...change, outcome: "unknown" }] })).toBe(
    false,
  );
  expect(isProjectApplyResponse({ ...applied, writes: -1 })).toBe(false);
  for (const key of ["__proto__", "constructor", "toString"])
    expect(isProjectsResponse(JSON.parse(`{"projects":[],"${key}":true}`))).toBe(false);
});
test("maps errors to screen outcomes and preserves partial Apply results", () => {
  for (const [status, errorKind, resultKind] of [
    [404, "unknown-binding", "missing"],
    [409, "unresolved-project", "unresolved"],
    [409, "declaration-invalid", "invalid"],
    [409, "declaration-pending", "pending"],
  ] as const)
    expect(
      mapProjectResult("apply", status, {
        error: { kind: errorKind, message: "Check project", commit: "revision" },
      }).kind,
    ).toBe(resultKind);
  expect(
    mapProjectResult("apply", 409, {
      error: { kind: "declaration-pending", message: "Waiting", commit: "revision" },
    }),
  ).toEqual({ kind: "pending", message: "Waiting", commit: "revision" });
  const changes = [
    { ...change, outcome: "failed" },
    { ...change, id: "later", outcome: "not-run" },
  ];
  expect(
    mapProjectResult("apply", 502, {
      error: { kind: "forbidden", message: "Cannot write" },
      writes: 1,
      changes,
    }),
  ).toEqual({
    kind: "failed",
    message: "Cannot write",
    errorKind: "forbidden",
    writes: 1,
    changes,
  });
  expect(mapProjectResult("plan", 200, plan)).toEqual({ kind: "ok", body: plan });
  expect(mapProjectResult("list", 200, { projects: [] }).kind).toBe("ok");
  expect(mapProjectResult("apply", 200, applied).kind).toBe("ok");
  expect(mapProjectResult("plan", 200, {}).kind).toBe("failed");
  const malformed = mapProjectResult("apply", 502, {
    error: { kind: "forbidden", message: "Cannot write" },
    writes: -1,
    changes: [],
  });
  expect(malformed.kind).toBe("failed");
  if (malformed.kind === "failed") expect(malformed.message).toContain("connection");
  expect(
    mapProjectResult("plan", 503, { error: { kind: "unavailable", message: "Offline" } }),
  ).toEqual({ kind: "failed", errorKind: "unavailable", message: "Offline" });
});
test("percent-encodes bindings and posts the reviewed digest without authentication", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ projects: [] })));
  vi.stubGlobal("fetch", fetch);
  await fetchProjects();
  await fetchProjectPlan("shipping/express");
  await applyProject("shipping/express", false, "b".repeat(64));
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "/api/projects",
    "/api/projects/shipping%2Fexpress/plan",
    "/api/projects/shipping%2Fexpress/apply",
  ]);
  expect(fetch.mock.calls[2]?.[1]).toEqual({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removeUndeclared: false, digest: "b".repeat(64) }),
  });
  fetch.mockRejectedValue(new Error("offline"));
  expect((await fetchProjects()).kind).toBe("failed");
  fetch.mockResolvedValue(new Response("invalid json"));
  expect((await fetchProjectPlan("shipping")).kind).toBe("failed");
});

test("Project plan digests require exactly 64 lowercase hexadecimal characters", () => {
  expect(isProjectPlanResponse({ ...plan, digest: "a".repeat(64) })).toBe(true);
  for (const digest of ["bad", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), 64])
    expect(isProjectPlanResponse({ ...plan, digest })).toBe(false);
});
test("in-sync Project configuration rejects a count member", () => {
  expect(
    isProjectsResponse({ projects: [{ ...summary, configuration: { state: "in-sync" } }] }),
  ).toBe(true);
  expect(
    isProjectsResponse({
      projects: [{ ...summary, configuration: { state: "in-sync", count: 1 } }],
    }),
  ).toBe(false);
});
test("a stale Apply plan maps to stale only for the Apply conflict response", () => {
  const body = { error: { kind: "plan-stale", message: "Review the changed plan." } };
  expect(mapProjectResult("apply", 409, body)).toEqual({
    kind: "stale",
    message: "Review the changed plan.",
  });
  expect(mapProjectResult("plan", 409, body).kind).toBe("failed");
  expect(mapProjectResult("apply", 503, body).kind).toBe("failed");
});

test("plan guards read shared scope changes and unavailable scope status", () => {
  const scope = { kind: "repository", name: "sample/depot", bindings: ["shipping"] };
  expect(
    isProjectPlanResponse({
      ...plan,
      scopes: [{ scope, status: "forbidden", observedAt: null, message: "Cannot read" }],
      outside: [{ repository: "sample/other", issues: 1 }],
      changes: [
        {
          ...change,
          storage: "label",
          scope,
          target: { lifecycle: false, option: "size: small" },
          to: { entity: "label", name: "size: small", color: "aaaaaa", description: "" },
        },
      ],
    }),
  ).toBe(true);
  expect(
    isProjectPlanResponse({ ...plan, scopes: [{ scope, status: "broken", observedAt: null }] }),
  ).toBe(false);
  expect(
    mapProjectResult("apply", 409, {
      error: {
        kind: "scope-unavailable",
        message: "Nothing was written.",
        scopes: [{ scope, status: "forbidden", observedAt: null }],
      },
    }),
  ).toMatchObject({ kind: "failed", errorKind: "scope-unavailable" });
});
