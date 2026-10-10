// ---
// relationships:
//   verifies: live-github-environment
// ---
import { beforeEach, expect, it, vi } from "vite-plus/test";
const { rest, graph } = vi.hoisted(() => ({ rest: vi.fn(), graph: vi.fn() }));
vi.mock("@octokit/request", () => ({ request: { defaults: () => rest } }));
vi.mock("@octokit/graphql", () => ({ graphql: { defaults: () => graph } }));
import { GitHub } from "./github.ts";
beforeEach(() => {
  rest.mockReset();
  graph.mockReset();
});
it("checks classic scopes and requires delete_repo only for teardown", async () => {
  rest.mockResolvedValue({
    headers: { "x-oauth-scopes": "repo, project, admin:org_hook" },
    data: {},
  });
  const github = new GitHub("example-org", "synthetic-test-value");
  await github.preflight();
  await expect(github.preflight(true)).rejects.toThrow("PAT missing scope delete_repo");
  expect(rest.mock.calls.filter(([route]) => route === "GET /orgs/{org}")).toHaveLength(1);
});
it("checks authentication and organization without classic headers for fine-grained tokens", async () => {
  rest.mockResolvedValue({ headers: {}, data: {} });
  await new GitHub("example-org", "synthetic-test-value").preflight(true);
  expect(rest.mock.calls.map(([route]) => route)).toEqual(["GET /user", "GET /orgs/{org}"]);
});
it("names missing scopes and sanitizes REST and GraphQL failures", async () => {
  const github = new GitHub("example-org", "synthetic-test-value");
  rest.mockResolvedValue({ headers: { "x-oauth-scopes": "repo" }, data: {} });
  await expect(github.preflight()).rejects.toThrow("PAT missing scope project");
  const error = Object.assign(Error("synthetic-test-value response"), {
    status: 403,
    request: { headers: { authorization: "synthetic-test-value" } },
  });
  rest.mockRejectedValue(error);
  graph.mockRejectedValue(error);
  await expect(github.preflight()).rejects.toThrow(/^PAT authentication failed \(403\)$/);
  await expect(github.rest("create issue", "POST /repos/{owner}/{repo}/issues")).rejects.toThrow(
    /^create issue failed \(403\)$/,
  );
  await expect(github.graph("read projects", "query{}")).rejects.toThrow(
    /^read projects failed \(403\)$/,
  );
});
vi.mock("@octokit/auth-app", () => ({
  createAppAuth: () => async () => ({ token: "synthetic-installation-token" }),
}));
vi.mock("./settings.ts", () => ({
  readApp: async () => ({ appId: 1, installationId: 2 }),
  readCredential: async () => "synthetic-key",
}));
it("requires installation access to both repositories and reports no token", async () => {
  const { installationAccess } = await import("./github.ts");
  const settings = {
    organization: "example-org",
    repository: "fixture-app",
    processRepository: "fixture-settings",
    credentials: { appPrivateKeyFile: "synthetic-file" },
  } as import("./settings.ts").Settings;
  rest.mockResolvedValue({
    data: { repositories: [{ full_name: "example-org/fixture-app" }] },
  });
  await expect(installationAccess(settings)).rejects.toThrow(
    /^App installation missing repository access: example-org\/fixture-settings$/,
  );
  rest.mockResolvedValue({
    data: {
      repositories: [
        { full_name: "example-org/fixture-app" },
        { full_name: "example-org/fixture-settings" },
      ],
    },
  });
  await expect(installationAccess(settings)).resolves.toBeUndefined();
});
it("reads recorded delivery pages using the Link cursor and never page", async () => {
  rest.mockImplementation(async (_route, params) => {
    if ("page" in params) throw Object.assign(Error("invalid page"), { status: 422 });
    if (!params.cursor)
      return {
        data: [{ id: 1 }],
        headers: {
          link: '<https://api.github.com/orgs/example-org/hooks/7/deliveries?cursor=next%2Fpage>; rel="next"',
        },
      };
    expect(params.cursor).toBe("next/page");
    return { data: [{ id: 2 }], headers: {} };
  });
  await expect(new GitHub("example-org", "synthetic").deliveries(7)).resolves.toEqual([
    { id: 1 },
    { id: 2 },
  ]);
  expect(rest).toHaveBeenCalledTimes(2);
});
it("sends only route-bound organization and owner parameters", async () => {
  rest.mockResolvedValue({ data: {} });
  const github = new GitHub("example-org", "synthetic");
  await github.rest("detail", "GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}", {
    hook_id: 7,
    delivery_id: 8,
  });
  expect(rest.mock.calls[0]?.[1]).toEqual({
    org: "example-org",
    hook_id: 7,
    delivery_id: 8,
  });
  await github.rest("ref", "GET /repos/{owner}/{repo}/git/ref/{ref}", {
    repo: "fixture",
    ref: "heads/main",
  });
  expect(rest.mock.calls[1]?.[1]).toEqual({
    owner: "example-org",
    repo: "fixture",
    ref: "heads/main",
  });
});
