// ---
// relationships:
//   verifies: [service-distribution, service-assembly]
// ---
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import git from "isomorphic-git";
import { stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import { model } from "../intake/test-fixtures/fixture.ts";
import { serviceFixture } from "./test-fixtures/repository.ts";
import { signedDelivery } from "../github-source/test-fixtures/api.ts";
import { serve, readRequest } from "../escalations/test-support.ts";
import { startService } from "./index.ts";

// REBASE STAND-IN: replace these process declarations with examples/starter/
// and the bundled blueprints/task.yml once task 1158 lands.
test("the guide reaches an issue's actor through the private API against fake GitHub", async () => {
  const f = await serviceFixture();
  let stop: (() => Promise<void>) | undefined;
  try {
    const gitdir = f.remote.gitdir;
    const { commit } = await git.readCommit({ fs, gitdir, oid: f.first });
    const { tree } = await git.readTree({ fs, gitdir, oid: commit.tree });
    async function blob(path: string, value: unknown) {
      return {
        path,
        mode: "100644",
        type: "blob" as const,
        oid: await git.writeBlob({ fs, gitdir, blob: Buffer.from(stringify(value)) }),
      };
    }
    const models = await git.writeTree({
      fs,
      gitdir,
      tree: [
        await blob(
          "intake.yml",
          model('{"blueprint":"blueprints/counter.yml","portfolioItem":"alpha"}'),
        ),
      ],
    });
    const next = await git.writeTree({
      fs,
      gitdir,
      tree: [
        ...tree.filter((entry) => entry.path !== "bindings.yml"),
        await blob("bindings.yml", {
          githubProjects: {
            first: { owner: "sample", number: 1, environment: "env-one", item: "alpha" },
          },
        }),
        await blob("manifold.yml", { intake: { decisionModel: "models/intake.yml" } }),
        { path: "models", mode: "040000", type: "tree", oid: models },
      ],
    });
    await f.remote.force(
      await git.writeCommit({
        fs,
        gitdir,
        commit: { ...commit, tree: next, parent: [f.first], message: "Example declaration" },
      }),
    );
    const service = await startService({ configurationFile: f.file, log: () => {} });
    stop = service.stop;
    const { host, port } = service.http.address();
    const base = `http://${host}:${port}`;
    f.api.addItem("item-one", "I_A");
    const delivery = signedDelivery("projects_v2_item", {
      action: "created",
      organization: { login: "sample" },
      projects_v2_item: {
        node_id: "item-one",
        project_node_id: "P_one",
        content_node_id: "I_A",
        content_type: "Issue",
      },
    });
    expect(
      (
        await fetch(`${base}/webhooks/github`, {
          method: "POST",
          headers: delivery.headers,
          body: delivery.body,
        })
      ).status,
    ).toBe(202);
    await expect
      .poll(async () => {
        const response = await fetch(`${base}/api/actors`);
        expect(response.status).toBe(200);
        return (await response.json()).actors;
      })
      .toContainEqual(
        expect.objectContaining({
          actorId: "task:I_A",
          issue: "I_A",
          project: "P_one",
          portfolioItem: "alpha",
          blueprint: expect.objectContaining({ path: "blueprints/counter.yml" }),
        }),
      );
    expect((await fetch(`${base}/console/`)).status).toBe(200);
  } finally {
    await stop?.();
    await f.close();
  }
});

test("the guide token pipeline exchanges a pairing credential for the approved scopes without output", async () => {
  const guide = await fs.readFile(
    new URL("../../../../docs/guides/operator-setup.md", import.meta.url),
    "utf8",
  );
  const script = guide
    .split("t3 auth pairing create --json | node --input-type=module -e '\n")[1]
    ?.split("\n'\n")[0];
  expect(script).toBeDefined();
  const f = await serviceFixture();
  let requestBody = "";
  const oauth = await serve((request, response) => {
    expect(request.url).toBe("/oauth/token");
    expect(request.method).toBe("POST");
    void readRequest(request).then((body) => {
      requestBody = body;
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ access_token: "synthetic-access-token" }));
    });
  });
  try {
    await fs.mkdir(join(f.directory, "credentials"));
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        ["--input-type=module", "-e", script!.replace("http://127.0.0.1:3773", oauth.url)],
        { cwd: f.directory },
        (error, stdout, stderr) => (error ? reject(error) : resolve({ stdout, stderr })),
      );
      child.stdin!.end(JSON.stringify({ credential: "synthetic-pairing-credential" }));
    });
    expect(Object.fromEntries(new URLSearchParams(requestBody))).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "synthetic-pairing-credential",
      subject_token_type: "urn:t3:params:oauth:token-type:environment-bootstrap",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "orchestration:read orchestration:operate",
    });
    expect(result).toEqual({ stdout: "", stderr: "" });
    const file = join(f.directory, "credentials/workstation.token");
    expect(await fs.readFile(file, "utf8")).toBe("synthetic-access-token");
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  } finally {
    await oauth.close();
    await f.close();
  }
});
