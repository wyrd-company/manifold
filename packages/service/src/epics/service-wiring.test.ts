// ---
// relationships:
//   verifies: [epics-api, service-assembly]
// ---
import { expect, test } from "vite-plus/test";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { isEpicResponse, isEpicRootsResponse } from "@wyrd-company/manifold-shared/epics-api";
test("service mounts the epics part with its tasks read model", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    await f.commit(60, {
      bindings: {
        githubProjects: {
          sample: { owner: "sample", number: 1, item: "alpha", environment: "sample-host" },
        },
      },
    });
    f.api.addItem("IT_A", "I_A");
    f.api.addItem("IT_B", "I_B");
    f.api.subIssues.push(["I_A", "I_B"]);
    service = await startService({ configurationFile: f.file, log: () => {} });
    await expect.poll(() => service!.github.trackedIssue("I_A")?.subIssues.length).toBe(1);
    const { host, port } = service.http.address(),
      url = `http://${host}:${port}/api/epics`;
    const roots = await (await fetch(url)).json();
    expect(isEpicRootsResponse(roots)).toBe(true);
    const body = await (await fetch(url + "/I_A")).json();
    expect(isEpicResponse(body)).toBe(true);
    if (!isEpicResponse(body)) throw new Error("Invalid epic");
    expect(body.epic.issues.map((i) => i.issue.nodeId)).toEqual(["I_A", "I_B"]);
    expect(body.epic.issues[1]?.task?.actorId).toBe("task:I_B");
  } finally {
    await service?.stop();
    await f.close();
  }
});
