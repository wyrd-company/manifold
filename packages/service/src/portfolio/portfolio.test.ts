// ---
// relationships:
//   verifies: [portfolio, portfolio-declarations-table]
// ---
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { openStore } from "../store/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
import { openPortfolio, portfolioMigrationSteps } from "./index.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0).toReversed()) close();
});
const revision = (portfolio: unknown, bindings: unknown = {}, commit = "a".repeat(40)) =>
  memoryRevision(commit, {
    "portfolio.yml": stringify(portfolio),
    "bindings.yml": stringify(bindings),
  });
const split = (alpha = 50, beta = 50, archived = false) => ({
  items: {
    alpha: { archived, allocations: { acct: { guarantee: alpha } } },
    beta: { allocations: { acct: { guarantee: beta } } },
  },
});
const binding = (item = "alpha", archived = false) => ({
  githubProjects: {
    first: {
      owner: "example-org",
      number: 1,
      environment: "env-one",
      item,
      archived,
      t3codeProjects: ["project-1"],
    },
  },
});
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "portfolio-test-"));
  const path = join(directory, "test.sqlite");
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const store = openStore({ path, now: () => 0 });
  cleanup.push(() => store.close());
  store.connection.migrate("ledger", ledgerMigrationSteps);
  store.connection.migrate("portfolio", portfolioMigrationSteps);
  const portfolio = openPortfolio({ connection: store.connection, now: () => 0 });
  portfolio.ledger.credit({
    key: "credit-1",
    account: "acct",
    window: "w1",
    opensAt: 0,
    closesAt: 1000,
    amount: 100,
  });
  const balance = (item: string, waiting = ["alpha", "beta"]) =>
    portfolio.ledger.balance({ item, account: "acct", waiting });
  const rows = () =>
    store.connection.database.prepare("SELECT * FROM portfolio_declarations ORDER BY seq").all();
  return { path, store, portfolio, balance, rows };
}

describe("portfolio module", () => {
  it("starts empty, then loads a tree with Other under every parent", async () => {
    const s = setup();
    expect(s.portfolio.current()).toMatchObject({
      commit: null,
      declaration: { items: [{ id: "other" }] },
    });
    expect(s.portfolio.t3codeProject({ environment: "env-one", id: "project-1" })).toEqual({
      item: "other",
      via: "unbound",
    });
    expect(s.portfolio.githubProject({ owner: "example-org", number: 1 })).toBeUndefined();
    expect(
      await s.portfolio.apply(
        revision({
          items: {
            alpha: { allocations: { acct: { guarantee: 60 } }, items: { beta: {}, gamma: {} } },
          },
        }),
      ),
    ).toEqual({ status: "applied", commit: "a".repeat(40) });
    expect(() => s.balance("alpha/other", [])).not.toThrow();
    expect(s.portfolio.current().declaration.items.map((item) => item.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
      "alpha/other",
      "other",
    ]);
  });
  it("keeps the last valid declaration after rejection and after reopening the database", async () => {
    const s = setup();
    await s.portfolio.apply(revision(split(), binding()));
    const rejected = await s.portfolio.apply(
      revision(split(70, 40), binding("beta"), "b".repeat(40)),
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      findings: [
        { kind: "guarantee-limit", location: "/items", details: { parent: null, sum: 110 } },
      ],
    });
    if (rejected.status === "rejected")
      expect(rejected.findings[0]?.message).toContain("the top level");
    expect(s.balance("alpha").reservable).toBe(50);
    expect(s.portfolio.githubProject({ owner: "example-org", number: 1 })?.item).toBe("alpha");
    expect(s.rows()).toHaveLength(1);
    s.store.close();
    cleanup.pop();
    const reopenedStore = openStore({ path: s.path });
    cleanup.push(() => reopenedStore.close());
    const reopened = openPortfolio({ connection: reopenedStore.connection, now: () => 0 });
    expect(reopened.current().commit).toBe("a".repeat(40));
    expect(
      reopened.ledger.balance({ item: "alpha", account: "acct", waiting: ["alpha", "beta"] })
        .reservable,
    ).toBe(50);
    expect(reopened.githubProject({ owner: "EXAMPLE-ORG", number: 1 })?.item).toBe("alpha");
    expect(
      reopenedStore.connection.database
        .prepare("SELECT COUNT(*) AS count FROM portfolio_declarations")
        .get()?.["count"],
    ).toBe(1);
  });
  it("applies new allocations to the same ledger without a restart", async () => {
    const s = setup();
    const ledger = s.portfolio.ledger;
    await s.portfolio.apply(revision(split()));
    await s.portfolio.apply(revision(split(30, 70), {}, "b".repeat(40)));
    expect(s.portfolio.ledger).toBe(ledger);
    expect(s.balance("beta").allocation).toBe(70);
    s.store.close();
    cleanup.pop();
    const reopenedStore = openStore({ path: s.path });
    cleanup.push(() => reopenedStore.close());
    const reopened = openPortfolio({ connection: reopenedStore.connection, now: () => 0 });
    expect(reopened.current().commit).toBe("b".repeat(40));
    expect(
      reopened.ledger.balance({ item: "beta", account: "acct", waiting: ["alpha", "beta"] })
        .allocation,
    ).toBe(70);
  });
  it("archives an item with outstanding reservations while keeping account usage charged", async () => {
    const s = setup();
    await s.portfolio.apply(revision(split(), binding()));
    s.portfolio.ledger.reserve({
      key: "reserve-1",
      actor: "actor-1",
      item: "alpha",
      account: "acct",
      amount: 20,
    });
    expect(
      await s.portfolio.apply(revision(split(50, 50, true), binding(), "b".repeat(40))),
    ).toMatchObject({ status: "rejected", findings: [{ kind: "archived-item" }] });
    expect(
      await s.portfolio.apply(revision(split(50, 50, true), binding("beta"), "c".repeat(40))),
    ).toMatchObject({ status: "applied" });
    expect(s.balance("beta").reservable).toBe(80);
    expect(() =>
      s.portfolio.ledger.reserve({
        key: "reserve-2",
        actor: "actor-2",
        item: "alpha",
        account: "acct",
        amount: 1,
      }),
    ).toThrow(expect.objectContaining({ code: "invalid-input" }));
    expect(s.portfolio.githubProject({ owner: "example-org", number: 1 })?.item).toBe("beta");
    s.portfolio.ledger.settle({ actor: "actor-1" });
    expect(s.balance("beta").reservable).toBe(100);
  });
  it("resolves bindings, associations, environment scopes and archived bindings", async () => {
    const s = setup();
    await s.portfolio.apply(
      revision(split(), {
        ...binding(),
        t3codeProjects: {
          second: { environment: "env-one", project: "project-2", item: "beta", archived: true },
        },
      }),
    );
    expect(s.portfolio.githubProject({ owner: "EXAMPLE-ORG", number: 1 })).toEqual({
      binding: "first",
      item: "alpha",
      environment: "env-one",
      t3codeProjects: ["project-1"],
      archived: false,
    });
    expect(s.portfolio.t3codeProject({ environment: "env-one", id: "project-1" })).toEqual({
      item: "alpha",
      via: "association",
      binding: "first",
      archived: false,
    });
    expect(s.portfolio.t3codeProject({ environment: "env-one", id: "project-2" })).toEqual({
      item: "beta",
      via: "binding",
      binding: "second",
      archived: true,
    });
    expect(s.portfolio.t3codeProject({ environment: "env-two", id: "project-1" })).toEqual({
      item: "other",
      via: "unbound",
    });
    await s.portfolio.apply(revision(split(), binding("alpha", true)));
    expect(s.portfolio.githubProject({ owner: "example-org", number: 1 })?.archived).toBe(true);
    expect(s.portfolio.t3codeProject({ environment: "env-one", id: "project-1" })).toMatchObject({
      archived: true,
    });
    expect(s.portfolio.t3codeProject({ environment: "env-one", id: "project-2" })).toEqual({
      item: "other",
      via: "unbound",
    });
  });
  it("lets one item hold several projects of both kinds", async () => {
    const s = setup();
    await s.portfolio.apply(
      revision(split(), {
        githubProjects: {
          first: { ...binding().githubProjects.first, t3codeProjects: [] },
          second: { ...binding().githubProjects.first, number: 2, t3codeProjects: [] },
        },
        t3codeProjects: {
          third: { environment: "env-one", project: "project-3", item: "alpha" },
          fourth: { environment: "env-one", project: "project-4", item: "alpha" },
        },
      }),
    );
    for (const number of [1, 2])
      expect(s.portfolio.githubProject({ owner: "example-org", number })?.item).toBe("alpha");
    for (const id of ["project-3", "project-4"])
      expect(s.portfolio.t3codeProject({ environment: "env-one", id }).item).toBe("alpha");
  });
  it("converges by content, rejects repeatedly without writing, and stores canonical JSON", async () => {
    const s = setup();
    expect((await s.portfolio.apply(revision(split()))).status).toBe("applied");
    expect((await s.portfolio.apply(revision(split()))).status).toBe("unchanged");
    expect((await s.portfolio.apply(revision(split(), {}, "b".repeat(40)))).status).toBe(
      "unchanged",
    );
    for (let index = 0; index < 2; index++)
      expect((await s.portfolio.apply(revision(split(70, 40)))).status).toBe("rejected");
    expect(s.rows()).toHaveLength(1);
    expect(s.rows()[0]).toMatchObject({ commit_id: "a".repeat(40), accepted_at: 0 });
    expect(s.rows()[0]?.["declaration"]).toMatch(/^\{"githubProjects":/);
    expect(s.portfolio.current().commit).toBe("a".repeat(40));
  });
  it("serializes revision reads and applies in call order", async () => {
    const s = setup();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = revision(split(30, 70));
    const reads: string[] = [];
    const one = s.portfolio.apply({
      ...first,
      async read(path) {
        reads.push("first");
        await blocked;
        return first.read(path);
      },
    });
    const second = revision(split(60, 40), {}, "b".repeat(40));
    const two = s.portfolio.apply({
      ...second,
      async read(path) {
        reads.push("second");
        return second.read(path);
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(reads).toEqual(["first", "first"]);
    release();
    expect((await one).status).toBe("applied");
    expect((await two).status).toBe("applied");
    expect(s.balance("alpha").allocation).toBe(60);
    expect(s.portfolio.current().commit).toBe(second.commit);
  });
  it("keeps state on read or write failure and permits the next apply", async () => {
    const s = setup();
    await s.portfolio.apply(revision(split(), binding()));
    await expect(
      s.portfolio.apply({
        ...revision(split(), {}, "b".repeat(40)),
        async read() {
          throw new Error("read failed");
        },
      }),
    ).rejects.toThrow("read failed");
    expect(s.rows()).toHaveLength(1);
    expect(s.balance("alpha").allocation).toBe(50);
    s.store.connection.database.exec(
      "CREATE TRIGGER fail_portfolio_insert BEFORE INSERT ON portfolio_declarations BEGIN SELECT RAISE(ABORT, 'write failed'); END;",
    );
    await expect(s.portfolio.apply(revision(split(30, 70), binding("beta")))).rejects.toThrow(
      "write failed",
    );
    expect(s.portfolio.githubProject({ owner: "example-org", number: 1 })?.item).toBe("alpha");
    expect(s.balance("alpha").allocation).toBe(50);
    expect(s.rows()).toHaveLength(1);
    s.store.connection.database.exec("DROP TRIGGER fail_portfolio_insert");
    expect((await s.portfolio.apply(revision(split(30, 70), binding("beta")))).status).toBe(
      "applied",
    );
  });
  it("recovers the committed declaration when a crash prevents the in-memory swap", () => {
    const s = setup();
    const prior = s.portfolio.current().declaration;
    const declaration = {
      ...prior,
      items: [
        ...prior.items,
        { id: "alpha", parent: null, title: "alpha", archived: false, other: false },
      ],
      ledger: { items: [...prior.ledger.items, { id: "alpha", parent: null }], allocations: [] },
    };
    s.store.connection.database
      .prepare(
        "INSERT INTO portfolio_declarations (commit_id, declaration, accepted_at) VALUES (?, ?, ?)",
      )
      .run("b".repeat(40), JSON.stringify(declaration), 0);
    const reopened = openPortfolio({ connection: s.store.connection, now: () => 0 });
    expect(reopened.current().commit).toBe("b".repeat(40));
    expect(() =>
      reopened.ledger.balance({ item: "alpha", account: "acct", waiting: [] }),
    ).not.toThrow();
    expect(s.rows()).toHaveLength(1);
  });
  it("rejects digit-leading names through the service boundary", async () => {
    const s = setup();
    expect(await s.portfolio.apply(revision({ items: { "1alpha": {} } }))).toMatchObject({
      status: "rejected",
      findings: expect.arrayContaining([expect.objectContaining({ kind: "schema" })]),
    });
    expect(s.rows()).toHaveLength(0);
  });
  it("matches the specified schema and blocks update and delete on a populated table", async () => {
    const s = setup();
    const expected = new DatabaseSync(":memory:");
    try {
      expected.exec(
        readFileSync("../../docs/specifications/portfolio-declarations-table.sql", "utf8"),
      );
      const schema = (database: DatabaseSync) =>
        database
          .prepare(
            "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name LIKE 'portfolio_%' ORDER BY name",
          )
          .all()
          .map((row) => ({ ...row, sql: String(row["sql"]).replace(/\s+/g, " ") }));
      expect(schema(s.store.connection.database)).toEqual(schema(expected));
    } finally {
      expected.close();
    }
    await s.portfolio.apply(revision(split()));
    for (const statement of [
      "UPDATE portfolio_declarations SET commit_id = 'changed'",
      "DELETE FROM portfolio_declarations",
    ])
      expect(() => s.store.connection.database.exec(statement)).toThrow(
        "portfolio_declarations is append-only",
      );
    s.store.connection.migrate("portfolio", portfolioMigrationSteps);
    expect(s.rows()).toHaveLength(1);
  });
});
