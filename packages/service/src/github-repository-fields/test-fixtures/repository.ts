// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { createServer } from "node:http";
import { once } from "node:events";
import { expect } from "vite-plus/test";
import { createRepositoryFields } from "../index.ts";
import { SecretValue } from "../../service-configuration/index.ts";
import type { TaskFieldWrite, TrackedIssue } from "../../github-source/index.ts";
export async function repositoryFixture() {
  let labels = [
    { node_id: "L_small", name: "size: Small", color: "aabbcc", description: "Compact" },
    { node_id: "L_large", name: "size: Large", color: "ededed", description: null },
    { node_id: "L_keep", name: "personal", color: "eeeeee", description: "" },
  ];
  let milestones = [
    { node_id: "M_one", number: 1, title: "Spring", description: null, state: "closed" },
  ];
  const repositories = new Map([["sample/depot", { labels, milestones }]]);
  let sequence = 10;
  let assigned = ["size: Large", "personal"];
  let milestone: number | null = null;
  let status = 200;
  let interruptRemoval = false;
  const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
    const url = new URL(req.url!, "http://localhost");
    const path = url.pathname;
    const repository = path.split("/").slice(2, 4).join("/");
    const state = repositories.get(repository) ?? repositories.get("sample/depot")!;
    const method = req.method!;
    calls.push({ method, path, body });
    res.setHeader("Content-Type", "application/json");
    if (status !== 200) {
      res.writeHead(status);
      res.end(JSON.stringify({ message: "refused" }));
      return;
    }
    let data: unknown = {};
    if (path.endsWith("/issues/1/labels")) {
      if (method === "GET")
        data = assigned.map((name) => state.labels.find((l) => l.name === name)!);
      else {
        assigned = [...new Set([...assigned, ...(body["labels"] as string[])])];
        data = [];
      }
    } else if (path.includes("/issues/1/labels/")) {
      if (interruptRemoval) {
        interruptRemoval = false;
        res.writeHead(500);
        res.end('{"message":"interrupted"}');
        return;
      }
      assigned = assigned.filter((name) => name !== decodeURIComponent(path.split("/labels/")[1]!));
      data = [];
    } else if (path.endsWith("/issues/1")) {
      if (method === "GET")
        data = {
          milestone:
            milestone === null ? null : state.milestones.find((m) => m.number === milestone),
        };
      else milestone = body["milestone"] as number | null;
    } else if (path.endsWith("/labels")) {
      if (method === "GET") {
        const page = Number(url.searchParams.get("page") ?? "1");
        data = state.labels.slice((page - 1) * 100, page * 100);
        if (state.labels.length > page * 100)
          res.setHeader(
            "Link",
            `<http://${req.headers.host}${path}?page=${page + 1}&per_page=100>; rel="next"`,
          );
      } else {
        const l = { node_id: `L_new${++sequence}`, ...body };
        state.labels.push(l as (typeof labels)[number]);
        data = l;
      }
    } else if (path.includes("/labels/")) {
      const name = decodeURIComponent(path.split("/labels/")[1]!);
      if (method === "DELETE") {
        state.labels = state.labels.filter((l) => l.name !== name);
        res.writeHead(204);
        res.end();
        return;
      }
      state.labels = state.labels.map((l) =>
        l.name === name ? { ...l, ...body, name: String(body["new_name"] ?? l.name) } : l,
      );
      data = state.labels.find((l) => l.name === (body["new_name"] ?? name));
    } else if (path.endsWith("/milestones")) {
      if (method === "GET") {
        expect(url.searchParams.get("state")).toBe("all");
        data = state.milestones;
      } else {
        const m = {
          node_id: `M_new${++sequence}`,
          number: state.milestones.length + 1,
          state: "open",
          ...body,
        };
        state.milestones.push(m as (typeof milestones)[number]);
        data = m;
      }
    } else if (path.includes("/milestones/")) {
      state.milestones = state.milestones.map((m) =>
        m.number === Number(path.split("/").at(-1)) ? { ...m, ...body } : m,
      );
      data = state.milestones.at(0);
    } else {
      res.writeHead(404);
      res.end('{"message":"not found"}');
      return;
    }
    res.end(JSON.stringify(data));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const closeServer = () => new Promise<void>((resolve) => server.close(() => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const adapters = createRepositoryFields({
    configuration: {
      apiUrl: `http://127.0.0.1:${address.port}`,
      owners: { sample: { credential: "example", hooks: [] } },
      requestTimeoutMs: 5000,
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
    },
    credentials: {
      names: ["example"],
      resolve: () => ({
        kind: "github-app",
        name: "example",
        installationToken: async () => new SecretValue("example", "synthetic-token"),
      }),
    },
  });

  const issue: TrackedIssue = {
    issue: {
      nodeId: "I_one",
      repository: "sample/depot",
      number: 1,
      state: "open",
      stateReason: null,
    },
    items: [],
    projects: [],
    blockedBy: [],
    blocking: [],
    subIssues: [],
    parent: undefined,
  };
  const write: TaskFieldWrite = {
    actorId: "parcel",
    invokeId: "size",
    entryId: "entry",
    issueNodeId: "I_one",
    projectNodeId: "P_one",
    field: "size",
    storage: { kind: "label", prefix: "size: " },
    labels: ["size: Small", "size: Large"],
    repositories: ["sample/*"],
    value: "Small",
  };
  return {
    apiUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      adapters.stop();
      await closeServer();
    },
    adapters,
    issue,
    write,
    calls,
    labels: () => repositories.get("sample/depot")!.labels,
    assigned: () => assigned,
    addRepository: (name: string) => repositories.set(name, { labels: [], milestones: [] }),
    milestone: () => milestone,
    deny: (s: number) => {
      status = s;
    },
    interrupt: () => {
      interruptRemoval = true;
    },
  };
}
