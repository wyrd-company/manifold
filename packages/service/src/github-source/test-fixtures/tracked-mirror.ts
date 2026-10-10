// ---
// relationships:
//   verifies: [github-event-source, intake, gate-runtime]
// ---
import type { Store } from "../../store/index.ts";
import { createMirror } from "../mirror.ts";
import { githubSteps } from "../migrations.ts";

export function trackedMirror(store: Store, size: number) {
  store.connection.migrate("github", githubSteps);
  const mirror = createMirror(store, () => 0);
  const project = { nodeId: "P1", owner: "example-org", number: 1 };
  const before = mirror.read(),
    after = mirror.read();
  after.projects.set(project.nodeId, { project, closed: false, revision: 0 });
  for (let i = 0; i < size; i++) {
    const id = `parcel-${i}`;
    after.issues.set(id, {
      issue: {
        nodeId: id,
        repository: "example-org/parcels",
        number: i + 1,
        state: "open",
        stateReason: null,
      },
      baselined: true,
      present: true,
      revision: 0,
    });
    after.items.set(id, {
      item: { nodeId: id, contentType: "issue", contentNodeId: id },
      projectId: project.nodeId,
      present: true,
      archived: false,
      revision: 0,
    });
  }
  mirror.write(before, after);
  return { mirror, bound: new Map([[project.nodeId, project]]) };
}
