// ---
// relationships:
//   verifies: default-process
// ---
import type { Tasks } from "../tasks/types.ts";
import { createMirror } from "../github-source/mirror.ts";
import { startService } from "../service/index.ts";
const config = JSON.parse(process.argv[2]!) as { file: string; crash?: "event" | "command" };
const service = await startService({
  configurationFile: config.file,
  probes: {
    delivery: (step, row) => {
      if (
        config.crash === "event" &&
        step === "sent" &&
        (row.payload as { type: string }).type === "github.project-item.field-changed"
      ) {
        process.send?.({ type: "fault", boundary: "event", eventId: row.eventId });
        process.kill(process.pid, "SIGKILL");
      }
    },
    command: (command) => {
      if (config.crash === "command" && command.implementation === "turn-start") {
        process.send?.({ type: "fault", boundary: "command", commandId: command.commandId });
        process.kill(process.pid, "SIGKILL");
      }
    },
  },
  log: (entry) => process.send?.({ type: "log", entry }),
});
process.send?.({ type: "ready", address: service.http.address() });
process.on("message", (message) => {
  if (typeof message === "object" && message !== null && "id" in message) {
    const request = message as { id: string; action: string; arguments: { size?: number } };
    void (async () => {
      if (request.action === "prune") return service.retention.prune();
      if (request.action !== "board") throw new Error("Unknown test action");
      const database = service.store.connection.database;
      const mirror = createMirror(service.store, Date.now);
      const before = mirror.read();
      const after = mirror.read();
      const issue = after.issues.get("I_A")!;
      const item = [...after.items.values()].find((row) => row.item.contentNodeId === "I_A")!;
      const extra = Array.from(
        { length: request.arguments.size! - 1 },
        (_, i) => `board-sample-${i}`,
      );
      for (const [index, id] of extra.entries()) {
        after.issues.set(id, {
          ...issue,
          issue: { ...issue.issue, nodeId: id, number: index + 2 },
        });
        after.items.set(id, { ...item, item: { ...item.item, nodeId: id, contentNodeId: id } });
      }
      service.store.connection.transaction(() => mirror.write(before, after));
      // The listener calls list synchronously. Count only that request's reads,
      // so source and intake activity cannot enter the measurement.
      const tasks = (service as typeof service & { tasks: Tasks }).tasks;
      const list = tasks.list;
      let measuring = false;
      tasks.list = (...args) => {
        measuring = true;
        try {
          return list(...args);
        } finally {
          measuring = false;
        }
      };
      let mirrorReads = 0;
      const prepare = database.prepare;
      database.prepare = function (sql) {
        if (measuring && sql === "SELECT * FROM github_issue") mirrorReads++;
        return prepare.call(this, sql);
      };
      try {
        const { host, port } = service.http.address();
        const response = await fetch(`http://${host}:${port}/api/tasks`);
        const body = (await response.json()) as { projects: { tasks: unknown[] }[] };
        return {
          status: response.status,
          issues: body.projects.flatMap((project) => project.tasks).length,
          mirrorReads,
        };
      } finally {
        database.prepare = prepare;
        tasks.list = list;
        service.store.connection.transaction(() => {
          for (const id of extra) {
            database.prepare("DELETE FROM github_item WHERE item_node_id=?").run(id);
            database.prepare("DELETE FROM github_issue WHERE issue_node_id=?").run(id);
          }
        });
      }
    })()
      .then((answer) => process.send?.({ id: request.id, answer }))
      .catch((error: unknown) =>
        process.send?.({ id: request.id, answer: { error: String(error) } }),
      );
  }
  if (message === "stop") void service.stop().then(() => process.exit(0));
});
