// ---
// relationships:
//   verifies: process-repository
// ---
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import git from "isomorphic-git";

export async function fixture(directory: string) {
  const gitdir = join(directory, "recipes.git");
  await git.init({ fs, gitdir, bare: true, defaultBranch: "main" });
  let parent: string | undefined;
  async function commit(text: string) {
    const blob = await git.writeBlob({ fs, gitdir, blob: Buffer.from(text) });
    const link = await git.writeBlob({ fs, gitdir, blob: Buffer.from("recipes/a.txt") });
    const tree = await git.writeTree({
      fs,
      gitdir,
      tree: [{ path: "a.txt", mode: "100644", type: "blob", oid: blob }],
    });
    const root = await git.writeTree({
      fs,
      gitdir,
      tree: [
        { path: "recipes", mode: "040000", type: "tree", oid: tree },
        { path: "z.txt", mode: "100755", type: "blob", oid: blob },
        { path: "link", mode: "120000", type: "blob", oid: link },
        ...(parent
          ? [{ path: "external", mode: "160000", type: "commit" as const, oid: parent }]
          : []),
      ],
    });
    const author = {
      name: "Example",
      email: "example@example.test",
      timestamp: 1700000000,
      timezoneOffset: 0,
    };
    parent = await git.writeCommit({
      fs,
      gitdir,
      commit: {
        message: "Example recipe",
        tree: root,
        parent: parent ? [parent] : [],
        author,
        committer: author,
      },
    });
    await git.writeRef({ fs, gitdir, ref: "refs/heads/main", value: parent, force: true });
    return parent;
  }
  const requests: { path: string; body: string; authorization: string | undefined }[] = [];
  const responses: Buffer[] = [];
  const state: {
    mode: "healthy" | "headers" | "pack" | "close" | "replay";
    auth: string | undefined;
    replay: Buffer | undefined;
    packStarted?: () => void;
    beforeReceive?: () => Promise<void>;
    loseReceiveReply?: boolean;
    refuseNextFetch?: boolean;
    hold?: { reached: () => void; released: Promise<void> };
  } = { mode: "healthy", auth: undefined, replay: undefined };
  const server = createServer((request, response) => {
    request.on("error", () => response.destroy());
    response.on("error", () => response.destroy());
    void (async () => {
      const parts: Buffer[] = [];
      for await (const part of request) parts.push(Buffer.from(part));
      const body = Buffer.concat(parts);
      requests.push({
        path: request.url!,
        body: body.toString(),
        authorization: request.headers.authorization,
      });
      if (
        state.auth &&
        request.headers.authorization !==
          "Basic " + Buffer.from(`x-access-token:${state.auth}`).toString("base64")
      ) {
        response.writeHead(401, { "www-authenticate": 'Basic realm="example"' });
        response.end();
        return;
      }
      if (request.url!.includes("git-upload-pack") && state.refuseNextFetch) {
        state.refuseNextFetch = false;
        response.destroy();
        return;
      }
      if (request.method === "POST" && request.url!.endsWith("git-receive-pack"))
        await state.beforeReceive?.();
      if (state.hold) {
        const hold = state.hold;
        delete state.hold;
        hold.reached();
        await hold.released;
      }
      if (state.mode === "headers") {
        response.writeHead(200, { "content-type": "application/x-git-upload-pack-advertisement" });
        response.flushHeaders();
        return;
      }
      const post = request.method === "POST";
      if (post && state.mode === "replay") {
        response.writeHead(200, { "content-type": "application/x-git-upload-pack-result" });
        response.end(state.replay);
        return;
      }
      const backend = spawn("git", ["http-backend"], {
        env: {
          ...process.env,
          GIT_PROJECT_ROOT: directory,
          GIT_HTTP_EXPORT_ALL: "1",
          PATH_INFO: new URL(request.url!, "http://example.test").pathname,
          QUERY_STRING: new URL(request.url!, "http://example.test").search.slice(1),
          REQUEST_METHOD: request.method!,
          CONTENT_TYPE: request.headers["content-type"] ?? "",
          CONTENT_LENGTH: String(body.length),
        },
      });
      const stop = () => {
        response.destroy();
        backend.stdin.destroy();
        backend.stdout.destroy();
        backend.stderr.destroy();
        backend.kill();
      };
      // Stream errors arrive after writes return, outside the async handler's catch.
      backend.on("error", stop);
      backend.stdin.on("error", stop);
      backend.stdout.on("error", stop);
      backend.stderr.on("error", stop);
      response.on("close", stop);
      if (response.destroyed) {
        stop();
        return;
      }
      const chunks: Buffer[] = [];
      backend.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      backend.stderr.resume();
      backend.stdin.end(body);
      backend.on("close", () => {
        if (response.destroyed) return;
        if (request.url!.endsWith("git-receive-pack") && state.loseReceiveReply) {
          state.loseReceiveReply = false;
          response.destroy();
          return;
        }
        const result = Buffer.concat(chunks);
        const boundary = result.indexOf("\r\n\r\n");
        const headers: Record<string, string> = {};
        let status = 200;
        for (const line of result.subarray(0, boundary).toString().split("\r\n")) {
          const colon = line.indexOf(":");
          if (colon < 0) continue;
          const key = line.slice(0, colon).toLowerCase();
          const value = line.slice(colon + 1).trim();
          if (key === "status") status = Number(value.split(" ")[0]);
          else headers[key] = value;
        }
        const payload = result.subarray(boundary + 4);
        if (post) responses.push(payload);
        response.writeHead(status, headers);
        if (post && (state.mode === "pack" || state.mode === "close")) {
          response.write(payload.subarray(0, Math.min(64, payload.length)));
          response.flushHeaders();
          state.packStarted?.();
          if (state.mode === "close") response.destroy();
        } else response.end(payload);
      });
    })().catch(() => response.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address");
  return {
    gitdir,
    commit,
    requests,
    responses,
    state,
    url: `http://127.0.0.1:${address.port}/recipes.git`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    holdNext() {
      let release!: () => void;
      let entered!: () => void;
      const reached = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      state.hold = { reached: entered, released };
      return { reached, release };
    },
    async force(commit: string) {
      await git.writeRef({ fs, gitdir, ref: "refs/heads/main", value: commit, force: true });
    },
  };
}

export async function apiFixture() {
  const calls: { path: string; body: unknown }[] = [];
  const state = { stall: false, status: 201, token: "generic-installation-token" };
  const server = createServer((request, response: ServerResponse) => {
    request.on("error", () => response.destroy());
    response.on("error", () => response.destroy());
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      calls.push({
        path: request.url!,
        body: JSON.parse(Buffer.concat(chunks).toString() || "{}") as unknown,
      });
      if (state.stall) return;
      response.writeHead(state.status, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          token: state.token,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          permissions: { contents: "read" },
          repositories: [{ id: 1, name: "recipes" }],
        }),
      );
    })().catch(() => response.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  return {
    calls,
    state,
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
