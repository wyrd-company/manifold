// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { repositoryFixture } from "./test-fixtures/repository.ts";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).toReversed()) await c();
});
async function fixture() {
  const h = await repositoryFixture();
  cleanups.push(h.close);
  return h;
}

test("repository read/write adapters preserve label identity, read closed milestones and normalize null descriptions", async () => {
  const h = await fixture();
  const scope = { kind: "repository" as const, repository: "sample/depot" };
  expect(await h.adapters.observeScope(scope)).toMatchObject({
    status: "ready",
    labels: [{ nodeId: "L_small", color: "aabbcc" }, { description: "" }, {}],
    milestones: [{ nodeId: "M_one", title: "Spring", state: "closed", description: "" }],
  });
  await h.adapters.writeScopeEntity({
    kind: "label-update",
    repository: scope.repository,
    nodeId: "L_small",
    name: "size: Tiny",
    description: "Tiny",
  });
  expect(h.labels()[0]).toMatchObject({
    node_id: "L_small",
    name: "size: Tiny",
    description: "Tiny",
  });
  await h.adapters.writeScopeEntity({
    kind: "label-create",
    repository: scope.repository,
    name: "size: Medium",
    color: "123abc",
    description: "",
  });
  await h.adapters.writeScopeEntity({
    kind: "label-delete",
    repository: scope.repository,
    nodeId: "L_new11",
  });
  expect(h.labels()).toHaveLength(3);
  await h.adapters.writeScopeEntity({
    kind: "milestone-update",
    repository: scope.repository,
    number: 1,
    title: "Summer",
  });
  expect(await h.adapters.observeScope(scope)).toMatchObject({
    milestones: [{ nodeId: "M_one", title: "Summer", state: "closed" }],
  });
});
test("label assignment converges after interruption between add and remove, preserving unrelated labels", async () => {
  const h = await fixture();
  h.interrupt();
  await expect(h.adapters.writeTaskField(h.write, h.issue)).rejects.toMatchObject({
    kind: "transport",
  });
  expect(h.assigned()).toEqual(["size: Large", "personal", "size: Small"]);
  await h.adapters.writeTaskField(h.write, h.issue);
  await h.adapters.writeTaskField(h.write, h.issue);
  expect(h.assigned()).toEqual(["personal", "size: Small"]);
  expect(
    h.calls.filter((c) => c.method === "POST" && c.path.endsWith("/issues/1/labels")),
  ).toHaveLength(1);
  await h.adapters.writeTaskField({ ...h.write, value: null }, h.issue);
  expect(h.assigned()).toEqual(["personal"]);
});
test("milestone assignment sets and clears and missing options make no mutation", async () => {
  const h = await fixture();
  const write = {
    ...h.write,
    storage: { kind: "milestone" as const },
    labels: [],
    value: "Spring",
  };
  await h.adapters.writeTaskField(write, h.issue);
  expect(h.milestone()).toBe(1);
  await h.adapters.writeTaskField({ ...write, value: null }, h.issue);
  expect(h.milestone()).toBeNull();
  await expect(
    h.adapters.writeTaskField({ ...write, value: "Absent" }, h.issue),
  ).rejects.toMatchObject({ kind: "missing" });
});
test("outside repositories are refused before any request; read and write failures remain explicit", async () => {
  const h = await fixture();
  await expect(
    h.adapters.writeTaskField({ ...h.write, repositories: ["elsewhere/*"] }, h.issue),
  ).rejects.toMatchObject({ kind: "out-of-scope" });
  expect(h.calls).toEqual([]);
  for (const [status, expected] of [
    [403, "forbidden"],
    [404, "missing"],
  ] as const) {
    h.deny(status);
    expect(
      await h.adapters.observeScope({ kind: "repository", repository: "sample/depot" }),
    ).toMatchObject({ status: expected });
    await expect(
      h.adapters.writeScopeEntity({
        kind: "milestone-create",
        repository: "sample/depot",
        title: "New",
        description: "",
      }),
    ).rejects.toMatchObject({ kind: status === 404 ? "missing" : "forbidden" });
  }
});
test("repository observations paginate labels and use the repository's owner credential", async () => {
  const h = await fixture();
  for (let i = 0; i < 103; i++)
    h.labels().push({
      node_id: `L_page${i}`,
      name: `option ${i}`,
      color: "abcdef",
      description: "",
    });
  const scope = await h.adapters.observeScope({ kind: "repository", repository: "SAMPLE/depot" });
  expect(scope.status === "ready" && scope.labels).toHaveLength(106);
  expect(h.calls.filter((c) => c.path.endsWith("/labels"))).toHaveLength(2);
  expect(
    await h.adapters.observeScope({ kind: "repository", repository: "elsewhere/depot" }),
  ).toMatchObject({ status: "unconfigured" });
});
