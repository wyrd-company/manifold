// ---
// relationships:
//   verifies: [github-event-source, tasks-api, epics-api]
// ---
import { expect, test, vi } from "vite-plus/test";
import { epicWorld } from "./test-fixtures/world.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";

test.each([10, 1000])(
  "Board, Task, and Epics requests read the mirror once with %i tracked issues",
  async (size) => {
    const f = epicWorld(),
      server = await consoleHost();
    try {
      const before = f.mirror.read(),
        after = f.mirror.read();
      after.items.get("item-archived")!.present = false;
      const ids = new Set(
        [...after.items.values()]
          .filter((r) => r.present && r.item.contentType === "issue")
          .map((r) => r.item.contentNodeId),
      );
      for (let i = ids.size; i < size; i++) {
        const id = `extra-${i}`;
        after.issues.set(id, {
          issue: {
            nodeId: id,
            repository: "example/delivery",
            number: 100 + i,
            state: "open",
            stateReason: null,
          },
          baselined: true,
          present: true,
          revision: 0,
        });
        after.items.set(id, {
          item: { nodeId: id, contentType: "issue", contentNodeId: id },
          projectId: "project-1",
          present: true,
          archived: false,
          revision: 0,
        });
      }
      f.mirror.write(before, after);
      expect(f.github.trackedIssues()).toHaveLength(size);
      server.host.mount("/api/tasks", f.tasks.requestListener);
      server.host.mount("/api/epics", f.epics.requestListener);
      const prepare = vi.spyOn(f.store.connection.database, "prepare");
      for (const path of [
        "/api/tasks",
        "/api/tasks/task%3Aparcel",
        "/api/epics",
        "/api/epics/root",
      ]) {
        prepare.mockClear();
        const response = await fetch(server.url + path);
        expect(response.status).toBe(200);
        await response.json();
        expect(
          prepare.mock.calls.filter(([sql]) => /\bFROM github_issue$/.test(sql)),
          path,
        ).toHaveLength(1);
      }
      prepare.mockClear();
      const tracked = f.github.trackedIssues();
      prepare.mockClear();
      const shared = f.tasks.list(tracked);
      expect(prepare.mock.calls.filter(([sql]) => /\bFROM github_issue$/.test(sql))).toHaveLength(
        0,
      );
      expect(shared).toEqual(f.tasks.list());
      prepare.mockClear();
      expect(f.tasks.list([]).projects.every((p) => p.tasks.length === 0)).toBe(true);
      expect(prepare.mock.calls.filter(([sql]) => /\bFROM github_issue$/.test(sql))).toHaveLength(
        0,
      );
      prepare.mockRestore();
    } finally {
      await server.close();
      await f.close();
    }
  },
);
