// ---
// relationships:
//   verifies: github-event-source
// ---
import { SecretValue } from "../service-configuration/index.ts";
import { createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { startGitHubSource, GitHubDeliveryError } from "./index.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "github-source-"));
  const secretFile = join(directory, "hook-secret");
  writeFileSync(secretFile, "synthetic-secret");
  const store = openStore({ path: join(directory, "store.sqlite") });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: ["github"] }),
      restore: () => ({ status: "held", reason: "test" }),
    },
  });
  const source = startGitHubSource({
    store,
    router,
    configuration: {
      apiUrl: "http://127.0.0.1:1",
      owners: {
        sample: {
          credential: "sample-token",
          hooks: [
            { id: 1, repository: undefined, secretFile },
            { id: 2, repository: "records", secretFile },
          ],
        },
      },
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
    boundProjects: () => [],
    processRepository: {
      url: "https://example.test/sample/process.git",
      branch: "main",
      pull: async () => ({ kind: "unchanged", commit: "a".repeat(40) }),
    },
  });
  cleanups.push(async () => {
    await source.stop();
    router.stop();
    store.close();
    rmSync(directory, { recursive: true });
  });
  return { source, store, secretFile };
}
function delivery(event: string, payload: unknown, id = "delivery-one", hook = "1") {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    body,
    headers: {
      "X-GitHub-Delivery": id,
      "X-GitHub-Event": event,
      "X-GitHub-Hook-ID": hook,
      "X-Hub-Signature-256": `sha256=${createHmac("sha256", "synthetic-secret").update(body).digest("hex")}`,
    },
  };
}
test("accepts a GUID once across organization and repository hooks", () => {
  const { source, store } = setup();
  expect(source.receive(delivery("issues", { issue: { node_id: "I_one" } }))).toEqual({
    status: "accepted",
    deliveryId: "delivery-one",
    duplicate: false,
  });
  expect(
    source.receive(delivery("issues", { issue: { node_id: "I_one" } }, "delivery-one", "2")),
  ).toEqual({ status: "accepted", deliveryId: "delivery-one", duplicate: true });
  expect(
    store.connection.database.prepare("SELECT count(*) AS count FROM github_delivery").get()?.[
      "count"
    ],
  ).toBe(1);
});
test.each([
  [
    "missing header",
    (d: ReturnType<typeof delivery>) => ({
      ...d,
      headers: { ...d.headers, "X-GitHub-Event": undefined },
    }),
    "malformed",
  ],
  [
    "unknown hook",
    (d: ReturnType<typeof delivery>) => ({
      ...d,
      headers: { ...d.headers, "X-GitHub-Hook-ID": "3" },
    }),
    "unknown-hook",
  ],
  [
    "altered body",
    (d: ReturnType<typeof delivery>) => ({ ...d, body: Buffer.from("{}") }),
    "signature",
  ],
  ["bad node id", () => delivery("issues", { issue: { node_id: "I.bad" } }), "malformed"],
  ["missing payload field", () => delivery("issues", {}), "malformed"],
])("rejects %s without a durable write", (_name, change, kind) => {
  const { source, store } = setup();
  const outcome = source.receive(change(delivery("issues", { issue: { node_id: "I_one" } })));
  expect(outcome.status).toBe("rejected");
  if (outcome.status === "rejected") {
    expect(outcome.error).toBeInstanceOf(GitHubDeliveryError);
    expect(outcome.error.kind).toBe(kind);
  }
  expect(
    store.connection.database.prepare("SELECT count(*) AS count FROM github_delivery").get()?.[
      "count"
    ],
  ).toBe(0);
});
test("unknown events and ping accept valid JSON without naming an entity", () => {
  const { source, store } = setup();
  expect(source.receive(delivery("ping", {}, "ping")).status).toBe("accepted");
  expect(source.receive(delivery("unhandled", null, "unhandled")).status).toBe("accepted");
  expect(
    store.connection.database.prepare("SELECT count(*) AS count FROM github_pending").get()?.[
      "count"
    ],
  ).toBe(0);
});
test("rotating a hook secret takes effect at the next receive", () => {
  const { source, secretFile } = setup();
  writeFileSync(secretFile, "rotated-secret");
  const outcome = source.receive(delivery("ping", {}));
  expect(outcome.status === "rejected" && outcome.error.kind).toBe("signature");
});
test("the migrations produce the declared source schema", async () => {
  const { store } = setup();
  const { DatabaseSync } = await import("node:sqlite");
  const { readFileSync } = await import("node:fs");
  const declared = new DatabaseSync(":memory:");
  try {
    declared.exec(
      readFileSync(
        new URL(
          "../../../../docs/specifications/github-source-database-schema.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const query =
      "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name LIKE 'github_%' ORDER BY name";
    const normalize = (rows: Record<string, unknown>[]) =>
      rows.map((row) => ({ ...row, sql: (row["sql"] as string).replace(/\s+/g, " ") }));
    expect(normalize(store.connection.database.prepare(query).all())).toEqual(
      normalize(declared.prepare(query).all()),
    );
  } finally {
    declared.close();
  }
});
test("signature checks use the named hook secret and reject signed non-JSON", () => {
  const { source, secretFile, store } = setup();
  const invalid = delivery("ping", {});
  invalid.body = Buffer.from("not-json");
  invalid.headers["X-Hub-Signature-256"] =
    `sha256=${createHmac("sha256", "synthetic-secret").update(invalid.body).digest("hex")}`;
  const badJson = source.receive(invalid);
  expect(badJson.status === "rejected" && badJson.error.kind).toBe("malformed");
  writeFileSync(secretFile, "different-secret");
  const wrongSecret = source.receive(delivery("ping", {}));
  expect(wrongSecret.status === "rejected" && wrongSecret.error.kind).toBe("signature");
  expect(
    store.connection.database.prepare("SELECT count(*) AS count FROM github_delivery").get()?.[
      "count"
    ],
  ).toBe(0);
});

test.each(["\n", "\r\n"])(
  "a secret file ending in %j verifies with the one line ending removed",
  (ending) => {
    const { source, secretFile } = setup();
    writeFileSync(secretFile, `synthetic-secret${ending}`);
    expect(source.receive(delivery("ping", {})).status).toBe("accepted");
  },
);
