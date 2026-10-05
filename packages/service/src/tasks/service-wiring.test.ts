// ---
// relationships:
//   verifies: [tasks-api, operator-console, service-assembly]
// ---
import { expect, test } from "vite-plus/test";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { isTasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
test("service mounts tasks with live bindings, excludes archived bindings, and reads the lifecycle declaration in force", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    await f.commit(60, {
      taskMetadata: {
        projects: { sample: { lifecycle: { field: "Stage", options: ["Ready", "Delivered"] } } },
      },
      bindings: {
        githubProjects: {
          sample: { owner: "sample", number: 1, item: "alpha", environment: "sample-host" },
          archived: {
            owner: "sample",
            number: 2,
            item: "beta",
            environment: "sample-host",
            archived: true,
          },
        },
      },
    });
    f.api.addItem("IT_A", "I_A");
    service = await startService({
      configurationFile: f.file,
      log: () => {},
    });
    const { host, port } = service.http.address(),
      url = `http://${host}:${port}/api/tasks`;
    await expect.poll(() => service!.github.trackedIssueIds()).toContain("I_A");
    const response = await fetch(url),
      body = await response.json();
    expect(response.status).toBe(200);
    expect(isTasksResponse(body)).toBe(true);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      binding: "sample",
      lifecycle: { field: "Stage", options: ["Ready", "Delivered"] },
      tasks: [{ actorId: "task:I_A" }],
    });
  } finally {
    await service?.stop();
    await f.close();
  }
});
