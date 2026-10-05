// ---
// relationships:
//   verifies: portfolio-api
// ---
import { expect, test, vi } from "vite-plus/test";
import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import git from "isomorphic-git";
import { parse, stringify } from "yaml";
import Ajv from "ajv/dist/2020.js";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
const schema = parse(
  readFileSync(
    new URL("../../../../docs/specifications/portfolio-api.openapi.yml", import.meta.url),
    "utf8",
  ),
);
const validate = new Ajv.default({ strict: false, validateFormats: false }).compile({
  $ref: "#/components/schemas/PortfolioResponse",
  components: schema.components,
});
test("started Portfolio endpoint observes credit, ledger balances, historical and removed usage, nested order and active tasks", async () => {
  const f = await serviceFixture(),
    at = Date.parse("2026-10-05T12:00:00Z"),
    day = Date.parse("2026-10-05T00:00:00Z");
  const clock = vi.spyOn(Date, "now").mockReturnValue(at);
  const accounts = {
    "acct-a": {
      unit: "usd",
      kind: "api",
      capacity: { amount: 10, reset: "2026-10-04T00:00:00Z", every: { days: 1 } },
    },
    "acct-b": {
      unit: "usd",
      kind: "subscription",
      capacity: { amount: 20, reset: "2026-10-04T00:00:00Z", every: { days: 1 } },
    },
  };
  await f.commit(50, { accounts: { accounts } });
  await git.setConfig({ fs, gitdir: f.remote.gitdir, path: "http.receivepack", value: true });
  let service = await startService({ configurationFile: f.file, log: () => {} });
  try {
    const text =
      "items:\n  alpha:\n    allocations:\n      acct-a: { guarantee: 60 }\n      acct-b: { guarantee: 50 }\n      acct-c: { guarantee: 30 }\n    items:\n      beta:\n        allocations:\n          acct-a: { guarantee: 40 }\n      gamma:\n        allocations:\n          acct-a: { guarantee: 20 }\n      other:\n        allocations:\n          acct-a: { guarantee: 10 }\n  delta:\n    archived: true\n  epsilon: {}\n";
    let sequence = 0;
    async function save(text: string) {
      const result = await service.revisions.save({
        path: "portfolio.yml",
        text,
        base: service.processRepository.current()!.commit,
        message: "Change sample budget",
        saveId: (++sequence).toString(16).padStart(32, "0"),
      });
      expect(result.outcome).toBe("saved");
      return result;
    }
    await save(text);
    const ledger = service.portfolio.ledger;
    ledger.credit({
      key: "old-credit",
      account: "acct-a",
      window: "previous",
      opensAt: day - 86400000,
      closesAt: day,
      amount: 10000000,
    });
    ledger.postActual({
      key: "old-actual",
      actor: "task:old",
      item: "beta",
      account: "acct-a",
      amount: 20000,
      usedAt: day - 1000,
    });
    const address = service.http.address(),
      url = `http://${address.host}:${address.port}/api/portfolio`;
    async function read() {
      const response = await fetch(
        `http://${service.http.address().host}:${service.http.address().port}/api/portfolio`,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as PortfolioResponse;
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
      expect(body.at).toBe(new Date(at).toISOString());
      return body;
    }
    const credits = () =>
      service.store.connection.database
        .prepare(
          "SELECT account, COUNT(*) AS count FROM ledger_entries WHERE kind='credit' AND window_key <> 'previous' GROUP BY account ORDER BY account",
        )
        .all();
    const first = await read();
    expect(first.accounts.map((a) => [a.name, a.declared])).toEqual([
      ["acct-a", true],
      ["acct-b", true],
      ["acct-c", false],
    ]);
    expect(first.accounts[2]?.window).toBeUndefined();
    expect(first.warnings).toMatchObject([
      {
        location: "/items/alpha/allocations/acct-c",
        details: { item: "alpha", account: "acct-c" },
      },
    ]);
    expect(credits()).toEqual([
      { account: "acct-a", count: 1 },
      { account: "acct-b", count: 1 },
    ]);
    await read();
    expect(credits()).toEqual([
      { account: "acct-a", count: 1 },
      { account: "acct-b", count: 1 },
    ]);
    ledger.reserve({
      key: "hold",
      actor: "task:parcel",
      item: "beta",
      account: "acct-a",
      amount: 1000000,
    });
    for (const [item, amount] of [
      ["beta", 100000],
      ["delta", 200000],
      ["epsilon", 300000],
    ] as const)
      ledger.postActual({
        key: "actual-" + item,
        actor: "task:" + item,
        item,
        account: "acct-a",
        amount,
        usedAt: at,
      });
    await save(text.replace("  epsilon: {}\n", ""));
    service.store.saveSnapshot({
      actorId: "task:parcel",
      machine: "blueprints/task.yml",
      snapshot: {
        status: "active",
        value: "idle",
        context: { manifold: { portfolioItem: "gamma" } },
      },
    });
    const body = await read();
    expect(body.items.map((i) => i.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
      "alpha/other",
      "delta",
      "other",
    ]);
    for (const item of ["beta", "alpha"]) {
      const balance = ledger.balance({ item, account: "acct-a", waiting: [] }),
        allocation = body.items
          .find((i) => i.id === item)!
          .allocations.find((a) => a.account === "acct-a")!;
      expect(allocation).toMatchObject({
        amount: balance.allocation,
        actual: balance.actual,
        outstanding: balance.outstanding,
        available: balance.available,
        reservable: balance.reservable,
        lifetime: 120000,
      });
    }
    expect(body.accounts[0]?.window?.used).toBe(1600000);
    expect(body.items.some((i) => i.id === "epsilon")).toBe(false);
    expect(body.items.find((i) => i.id === "delta")?.archived).toBe(true);
    expect(body.items.find((i) => i.id === "alpha")?.activeTasks).toBe(1);
    expect(body.items.find((i) => i.id === "gamma")?.activeTasks).toBe(1);
    expect(body.unallocated[0]).toEqual({ account: "acct-a", percent: 40, amount: 4000000 });
    expect(body.items.find((i) => i.id === "alpha")?.unallocated?.[0]).toEqual({
      account: "acct-a",
      percent: 30,
      amount: 1800000,
    });
    const changed = await save(
      text.replace("  epsilon: {}\n", "").replace("guarantee: 60", "guarantee: 70"),
    );
    const later = await read();
    expect(later.commit).toBe(changed.outcome === "saved" ? changed.commit : undefined);
    expect(later.items.find((i) => i.id === "alpha")?.allocations[0]?.guarantee).toBe(70);
    expect((await fetch(url, { method: "POST" })).status).toBe(405);
    expect((await fetch(url + "/missing")).status).toBe(404);
    service.store.saveSnapshot({
      actorId: "task:parcel",
      machine: "blueprints/task.yml",
      snapshot: { status: "stopped", value: "idle" },
    });
    const portfolioCommit = service.portfolio.current().commit;
    async function setAccounts(values: typeof accounts & Record<string, unknown>) {
      const parent = await git.resolveRef({ fs, gitdir: f.remote.gitdir, ref: "main" });
      const old = await git.readCommit({ fs, gitdir: f.remote.gitdir, oid: parent });
      const root = await git.readTree({ fs, gitdir: f.remote.gitdir, oid: old.commit.tree });
      const blob = await git.writeBlob({
        fs,
        gitdir: f.remote.gitdir,
        blob: Buffer.from(stringify({ accounts: values })),
      });
      const tree = await git.writeTree({
        fs,
        gitdir: f.remote.gitdir,
        tree: [
          ...root.tree.filter((e) => e.path !== "accounts.yml"),
          { path: "accounts.yml", mode: "100644", type: "blob", oid: blob },
        ],
      });
      const commit = await git.writeCommit({
        fs,
        gitdir: f.remote.gitdir,
        commit: { ...old.commit, tree, parent: [parent], message: "Change sample accounts" },
      });
      await f.remote.force(commit);
      await service.revisions.pull();
    }
    await setAccounts({ ...accounts, "acct-c": accounts["acct-a"] });
    expect((await read()).warnings).toEqual([]);
    expect((await read()).accounts.find((a) => a.name === "acct-c")?.declared).toBe(true);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
    await service.stop();
    service = await startService({ configurationFile: f.file, log: () => {} });
    expect((await read()).warnings).toEqual([]);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
    await setAccounts(accounts);
    expect((await read()).warnings).toHaveLength(1);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
    await service.stop();
    service = await startService({ configurationFile: f.file, log: () => {} });
    expect((await read()).warnings).toHaveLength(1);
    expect((await read()).accounts.find((a) => a.name === "acct-c")?.declared).toBe(false);
    expect(service.portfolio.current().commit).toBe(portfolioCommit);
    const failed = vi.spyOn(service.portfolio, "current").mockImplementation(() => {
      throw Error("Sample read failure");
    });
    try {
      expect(
        (
          await fetch(
            `http://${service.http.address().host}:${service.http.address().port}/api/portfolio`,
          )
        ).status,
      ).toBe(500);
    } finally {
      failed.mockRestore();
    }
  } finally {
    try {
      await service.stop();
    } finally {
      clock.mockRestore();
      await f.close();
    }
  }
});
