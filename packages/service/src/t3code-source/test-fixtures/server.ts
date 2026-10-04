// ---
// relationships:
//   verifies: t3code-environment-source
// ---
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { schemas } from "@wyrd-company/t3code-client";
const at = "2026-01-01T00:00:00.000Z";
export function fixtureThread(id = "conversation") {
  return schemas.orchestrationReadModel.OrchestrationThread.parse({
    id,
    projectId: "project",
    title: "A recipe",
    modelSelection: { instanceId: "provider", model: "model" },
    runtimeMode: "full-access",
    branch: null,
    worktreePath: null,
    latestTurn: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    messages: [],
    activities: [],
    checkpoints: [],
    session: null,
  });
}
export async function fakeServer() {
  let sequence = 0;
  let environmentId = "server-one";
  let bound = 1000;
  let token = "fixture-token";
  const hooks: {
    readModel?: () => void;
    threadSubscribe?: () => void;
    beforeThreadSnapshot?: () => boolean | void;
  } = {};
  const threads = new Map<string, ReturnType<typeof fixtureThread>>();
  const log: unknown[] = [];
  const subscriptions = new Map<
    WebSocket,
    Map<string, { tag: string; payload: Record<string, unknown> }>
  >();
  const requests: { tag: string; payload: Record<string, unknown> }[] = [];
  function shellThread(thread: ReturnType<typeof fixtureThread>) {
    return {
      ...thread,
      latestUserMessageAt: null,
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      hasActionableProposedPlan: false,
    };
  }
  function shell() {
    return {
      snapshotSequence: sequence,
      projects: [],
      threads: [...threads.values()].filter((t) => !t.archivedAt && !t.deletedAt).map(shellThread),
      updatedAt: at,
    };
  }
  let bufferThreadItems = false;
  const buffered: { socket: WebSocket; requestId: string; values: unknown[] }[] = [];
  const flow = new Map<WebSocket, Map<string, { waiting: boolean; queue: string[] }>>();
  let acknowledgements = 0;
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/.well-known/t3/environment") {
      response.end(
        JSON.stringify({
          environmentId,
          label: "Fixture",
          platform: { os: "linux", arch: "x64" },
          serverVersion: "0.0.45",
          capabilities: {},
        }),
      );
      return;
    }
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401);
      response.end("{}");
      return;
    }
    if (request.url?.startsWith("/api/auth/websocket-ticket")) {
      response.end(JSON.stringify({ ticket: "ticket", expiresAt: at }));
      return;
    }
    if (request.url === "/api/orchestration/snapshot") {
      response.end(
        JSON.stringify({
          snapshotSequence: sequence,
          projects: [],
          threads: [...threads.values()],
          updatedAt: at,
        }),
      );
      hooks.readModel?.();
      return;
    }
    const id = decodeURIComponent(request.url?.split("/").at(-1) ?? "");
    const thread = threads.get(id);
    if (thread && !thread.deletedAt)
      response.end(JSON.stringify({ snapshotSequence: sequence, thread }));
    else {
      response.writeHead(404);
      response.end("{}");
    }
  });
  const ws = new WebSocketServer({ server });
  function chunk(socket: WebSocket, requestId: string, values: unknown[]) {
    if (!values.length) return;
    if (
      bufferThreadItems &&
      subscriptions.get(socket)?.get(String(requestId))?.tag === "orchestration.subscribeThread"
    ) {
      buffered.push({ socket, requestId, values: structuredClone(values) });
      return;
    }
    const frames = flow.get(socket)!;
    const key = String(requestId);
    const state = frames.get(key) ?? { waiting: false, queue: [] };
    frames.set(key, state);
    const text = JSON.stringify({ _tag: "Chunk", requestId, values });
    if (state.waiting) state.queue.push(text);
    else {
      state.waiting = true;
      socket.send(text);
    }
  }
  ws.on("connection", (socket) => {
    const subs = new Map<string, { tag: string; payload: Record<string, unknown> }>();
    subscriptions.set(socket, subs);
    flow.set(socket, new Map());
    socket.on("close", () => {
      subscriptions.delete(socket);
      flow.delete(socket);
    });
    socket.on("message", (data) => {
      const frame = JSON.parse(String(data)) as {
        _tag: string;
        id: string;
        requestId: string;
        tag: string;
        payload: Record<string, unknown>;
      };
      if (frame._tag === "Ping") {
        socket.send(JSON.stringify({ _tag: "Pong" }));
        return;
      }
      if (frame._tag === "Interrupt") {
        subs.delete(String(frame.requestId));
        flow.get(socket)?.delete(String(frame.requestId));
        return;
      }
      if (frame._tag === "Ack") {
        acknowledgements++;
        const state = flow.get(socket)?.get(String(frame.requestId));
        if (state) {
          const next = state.queue.shift();
          if (next) socket.send(next);
          else state.waiting = false;
        }
        return;
      }
      if (frame._tag !== "Request") return;
      requests.push({ tag: frame.tag, payload: frame.payload });
      subs.set(String(frame.id), { tag: frame.tag, payload: frame.payload });
      const cursor = frame.payload["afterSequence"] as number | undefined;
      if (frame.tag === "orchestration.subscribeShell") {
        chunk(socket, frame.id, [
          { kind: "snapshot", snapshot: shell() },
          { kind: "synchronized" },
        ]);
      } else {
        bufferThreadItems = true;
        const held = hooks.beforeThreadSnapshot?.() === false;
        bufferThreadItems = false;
        // Changes before this subscription's snapshot belong in the snapshot.
        buffered.splice(0);
        if (held) return;
        const thread = threads.get(String(frame.payload["threadId"]));
        if (!thread || thread.deletedAt) {
          socket.send(
            JSON.stringify({
              _tag: "Exit",
              requestId: frame.id,
              exit: {
                _tag: "Failure",
                cause: [
                  {
                    _tag: "Fail",
                    error: {
                      _tag: "OrchestrationGetSnapshotError",
                      message: "Thread was not found",
                    },
                  },
                ],
              },
            }),
          );
          return;
        }
        const events = log.filter(
          (e) =>
            (e as { sequence: number }).sequence > (cursor ?? -1) &&
            (e as { aggregateId: string }).aggregateId === thread.id,
        );
        const items =
          cursor === undefined || sequence - cursor > bound
            ? [{ kind: "snapshot", snapshot: { snapshotSequence: sequence, thread } }]
            : events.map((event) => ({ kind: "event", event }));
        if (hooks.threadSubscribe) {
          chunk(socket, frame.id, items);
          bufferThreadItems = true;
          hooks.threadSubscribe();
          bufferThreadItems = false;
          chunk(socket, frame.id, [{ kind: "synchronized" }]);
          for (const item of buffered.splice(0)) chunk(item.socket, item.requestId, item.values);
        } else chunk(socket, frame.id, [...items, { kind: "synchronized" }]);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    threads,
    requests,
    log,
    acknowledgements: () => acknowledgements,
    hooks,
    reset(value: string) {
      environmentId = value;
      sequence = 0;
      log.length = 0;
      threads.clear();
    },
    baseline(thread = fixtureThread()) {
      threads.set(thread.id, thread);
    },
    setBound(value: number) {
      bound = value;
    },
    setIdentity(value: string) {
      environmentId = value;
    },
    setToken(value: string) {
      token = value;
    },
    drop() {
      for (const socket of ws.clients) socket.terminate();
    },
    change(
      thread: ReturnType<typeof fixtureThread>,
      type = "thread.session-set",
      payload: unknown = { threadId: thread.id, session: thread.session },
    ) {
      threads.set(thread.id, thread);
      sequence++;
      const event = {
        sequence,
        eventId: `event-${sequence}`,
        aggregateKind: "thread",
        aggregateId: thread.id,
        occurredAt: at,
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type,
        payload,
      };
      log.push(structuredClone(event));
      for (const [socket, subs] of subscriptions)
        for (const [id, sub] of subs) {
          if (sub.tag === "orchestration.subscribeShell")
            chunk(socket, id, [
              thread.archivedAt || thread.deletedAt
                ? { kind: "thread-removed", sequence, threadId: thread.id }
                : { kind: "thread-upserted", sequence, thread: shellThread(thread) },
            ]);
          else if (sub.payload["threadId"] === thread.id)
            chunk(socket, id, [{ kind: "event", event }]);
        }
    },
    async close() {
      for (const socket of ws.clients) socket.terminate();
      await new Promise<void>((resolve) => ws.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
