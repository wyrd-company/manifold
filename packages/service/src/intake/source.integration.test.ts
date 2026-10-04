// ---
// relationships:
//   verifies: [intake, github-event-source]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { stringify, parse } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { startGitHubSource } from "../github-source/index.ts";
import { githubFake, FakeClock } from "../github-source/test-fixtures/api.ts";
import { SecretValue } from "../service-configuration/index.ts";
import { startIntake } from "./index.ts";
import type { Intake } from "./index.ts";
import { setup, files, first } from "./test-fixtures/fixture.ts";
it("takes existing Project items through discovery, then hears their later issue changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "intake-source-"));
  const fake = await githubFake();
  const s = await setup(join(dir, "store.sqlite"));
  await s.intake.stop();
  let source: ReturnType<typeof startGitHubSource> | undefined, intake: Intake | undefined;
  try {
    fake.addItem("IT_A", "I_A");
    const basis = s.current()!;
    const data = files();
    const blueprint = parse(data["blueprints/parcel.yml"]) as {
      machine: { states: Record<string, unknown> };
      schemas: { events: Record<string, unknown> };
    };
    blueprint.machine.states["sorting"] = {
      on: {
        "github.issue.closed": {
          actions: [
            { type: "expression.assign", params: { expression: '{"seen": [event.issue.state]}' } },
          ],
        },
      },
    };
    blueprint.schemas.events = { "github.issue.closed": true };
    data["blueprints/parcel.yml"] = stringify(blueprint);
    const revision = memoryRevision(first, data);
    s.revisions.set(first, revision);
    // Use a fresh loader since a version is immutable once loaded.
    const { createBlueprintLoader } = await import("../blueprint-loader/index.ts");
    const loader = createBlueprintLoader({
      implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
      revisionAt: async () => revision,
      onExpressionError: (error) => {
        throw error;
      },
    });
    const loaded = await loader.loadRevision(revision);
    for (const b of loaded.blueprints.values()) s.versions.set(b.key, b);
    s.setCurrent({
      ...basis,
      revision,
      blueprints: loaded,
      portfolio: {
        ...basis.portfolio,
        declaration: {
          ...basis.portfolio.declaration,
          githubProjects: basis.portfolio.declaration.githubProjects.map((b) => ({
            ...b,
            owner: "sample",
          })),
        },
      },
    });
    const errors: unknown[] = [];
    const discoveries: string[][] = [];
    source = startGitHubSource({
      store: s.store,
      router: s.host.router,
      clock: new FakeClock(),
      configuration: {
        apiUrl: fake.url,
        owners: { sample: { credential: "sample-token", hooks: [] } },
        sweepIntervalMs: 900000,
        redeliveryIntervalMs: 60000,
        requestTimeoutMs: 30000,
      },
      credentials: {
        names: ["sample-token"],
        resolve: () => ({
          kind: "github-app",
          name: "sample-token",
          installationToken: async () => new SecretValue("example-app", "synthetic-token"),
        }),
      },
      boundProjects: () => [{ owner: "sample", number: 1 }],
      processRepository: {
        url: "https://example.test/sample/process.git",
        branch: "main",
        pull: async () => ({ kind: "unchanged", commit: first }),
      },
      onTracked: (ids) => {
        discoveries.push([...ids]);
        intake!.discovered(ids);
      },
      onError: (error) => errors.push(error),
    });
    intake = startIntake({
      store: s.store,
      tracked: source,
      blueprints: loader,
      current: s.current,
      actors: s.host.host,
      onError: (error) => errors.push(error),
    });
    await expect.poll(() => intake!.record("I_A")?.status).toBe("started");
    expect(discoveries).toEqual([["I_A"]]);
    expect(s.host.inputs).toMatchObject([
      { task: { issue: { nodeId: "I_A", state: "open" }, item: { nodeId: "IT_A" } } },
    ]);
    expect(intake.record("I_A")).toMatchObject({ portfolioItem: "gamma" });
    fake.issues.get("I_A")!.state = "CLOSED";
    source.requestSweep();
    await expect
      .poll(() => s.store.loadSnapshot("task:I_A")?.snapshot["context"])
      .toMatchObject({ seen: ["closed"] });
    source.requestSweep();
    await intake.idle();
    expect(s.host.starts).toEqual(["task:I_A"]);
    expect(errors).toEqual([]);
  } finally {
    await source?.stop();
    await intake?.stop();
    await s.close();
    await fake.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
