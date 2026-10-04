// ---
// relationships:
//   verifies: [portfolio-declaration, bindings-declaration]
// ---
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { describe, expect, it } from "vite-plus/test";
import { lintPortfolioDeclaration, portfolioDeclarationAjv } from "./portfolio-declaration.ts";
import {
  portfolioDeclarationSchema,
  bindingsDeclarationSchema,
} from "./portfolio-declaration-schema.ts";

// Task 1135 owns the real root and section schemas. Replace this registration on rebase.
portfolioDeclarationAjv.addSchema({
  $id: "https://manifold.wyrd.company/schemas/service-configuration",
  $defs: {
    "declared-name": { type: "string", pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$", maxLength: 64 },
  },
});
const lint = (portfolio: unknown, bindings: unknown = {}) =>
  lintPortfolioDeclaration({ portfolio: stringify(portfolio), bindings: stringify(bindings) });
const findings = (portfolio: unknown, bindings: unknown = {}) => {
  const result = lint(portfolio, bindings);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected findings");
  return result.findings;
};
const github = (item = "alpha") => ({
  owner: "example-org",
  number: 1,
  environment: "env-one",
  item,
});
const t3 = (item = "alpha") => ({ environment: "env-one", project: "project-1", item });

describe("portfolio declaration lint", () => {
  it("embeds the exact specification schemas", () => {
    for (const [name, schema] of [
      ["portfolio", portfolioDeclarationSchema],
      ["bindings", bindingsDeclarationSchema],
    ])
      expect(schema).toEqual(
        parse(readFileSync(`../../docs/specifications/${name}-declaration.schema.yml`, "utf8")),
      );
  });
  it("normalizes Other, defaults, archive inheritance and empty allocations", () => {
    const result = lint({
      items: {
        alpha: {
          items: {
            beta: { allocations: { acct: {} } },
            gamma: { allocations: { acct: { ceiling: 80 } } },
            other: { allocations: { acct: {} } },
          },
        },
        delta: {
          archived: true,
          allocations: { acct: { guarantee: 99 } },
          items: { epsilon: { allocations: { acct: { guarantee: 99 } } } },
        },
        other: { allocations: { acct: { guarantee: 10 } } },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a declaration");
    expect(result.declaration.items).toEqual([
      { id: "alpha", parent: null, title: "alpha", archived: false, other: false },
      { id: "beta", parent: "alpha", title: "beta", archived: false, other: false },
      { id: "gamma", parent: "alpha", title: "gamma", archived: false, other: false },
      { id: "alpha/other", parent: "alpha", title: "Other", archived: false, other: true },
      { id: "delta", parent: null, title: "delta", archived: true, other: false },
      { id: "epsilon", parent: "delta", title: "epsilon", archived: true, other: false },
      { id: "delta/other", parent: "delta", title: "Other", archived: true, other: true },
      { id: "other", parent: null, title: "Other", archived: false, other: true },
    ]);
    expect(result.declaration.ledger.allocations).toEqual([
      { item: "beta", account: "acct", guarantee: 0 },
      { item: "gamma", account: "acct", guarantee: 0, ceiling: 80 },
      { item: "alpha/other", account: "acct", guarantee: 0 },
      { item: "other", account: "acct", guarantee: 10 },
    ]);
  });
  it("accepts missing and empty documents", () => {
    for (const text of [undefined, "", "# empty\n", "null"])
      expect(lintPortfolioDeclaration({ portfolio: text, bindings: text })).toMatchObject({
        ok: true,
        declaration: { items: [{ id: "other" }] },
      });
  });
  it("reports syntax and schema errors independently and suppresses unknown-item on an invalid portfolio shape", () => {
    const result = lintPortfolioDeclaration({
      portfolio: "items: [",
      bindings: stringify({ githubProjects: { first: github("missing") } }),
    });
    expect(result).toMatchObject({
      ok: false,
      findings: [{ file: "portfolio", kind: "syntax", location: "" }],
    });
    if (!result.ok) expect(result.findings).toHaveLength(1);
    expect(findings({ items: { alpha: { title: 3 } } })).toContainEqual(
      expect.objectContaining({ kind: "schema", location: "/items/alpha/title" }),
    );
    for (const text of ["---\n{}\n---\n{}", "items: {}\nitems: {}"])
      expect(lintPortfolioDeclaration({ portfolio: text, bindings: "[" })).toMatchObject({
        ok: false,
        findings: [
          { file: "portfolio", kind: "syntax" },
          { file: "bindings", kind: "syntax" },
        ],
      });
  });
  it.each([
    [{ items: { "1alpha": {} } }, {}],
    [{ items: { alpha: { allocations: { "1acct": {} } } } }, {}],
    [{ items: { alpha: {} } }, { githubProjects: { "1first": github() } }],
    [{ items: { alpha: {} } }, { t3codeProjects: { first: { ...t3(), environment: "1env" } } }],
    [{ items: { ["a".repeat(65)]: {} } }, {}],
  ])("uses the canonical declared-name rule", (portfolio, bindings) => {
    expect(findings(portfolio, bindings).some((f) => f.kind === "schema")).toBe(true);
  });
  it("reports duplicate ids and Other without siblings", () => {
    expect(
      findings({
        items: {
          alpha: { items: { beta: {} } },
          gamma: { items: { beta: {} } },
          delta: { items: { other: {} } },
        },
      }),
    ).toEqual([
      expect.objectContaining({ kind: "duplicate-item", location: "/items/gamma/items/beta" }),
      expect.objectContaining({
        kind: "other-without-items",
        location: "/items/delta/items/other",
      }),
      expect.objectContaining({
        kind: "invalid-portfolio",
        location: "/items",
        message: 'Duplicate item "beta".',
        details: { item: "beta" },
      }),
    ]);
  });
  it("reports guarantee limits alongside Other without siblings", () => {
    expect(
      findings({
        items: {
          alpha: { items: { other: {} }, allocations: { acct: { guarantee: 60 } } },
          beta: { allocations: { acct: { guarantee: 50 } } },
        },
      }),
    ).toEqual([
      expect.objectContaining({
        kind: "other-without-items",
        location: "/items/alpha/items/other",
      }),
      expect.objectContaining({
        kind: "guarantee-limit",
        location: "/items",
        message: 'Guarantees under the top level for account "acct" total 110%, above 100%.',
        details: { parent: null, account: "acct", sum: 110 },
      }),
    ]);
  });
  it.each(["guarantee", "ceiling", "burst"])(
    "maps %s precision errors to each row's source field",
    (field) => {
      const allocation = field === "burst" ? { pacing: { burst: 1.234 } } : { [field]: 1.234 };
      const rows = findings({
        items: {
          alpha: { allocations: { acct: allocation, second: allocation } },
          beta: { allocations: { acct: allocation, second: allocation } },
        },
      });
      expect(rows.map((f) => [f.kind, f.location])).toEqual(
        ["alpha", "beta"].flatMap((item) =>
          ["acct", "second"].map((account) => [
            "invalid-portfolio",
            `/items/${item}/allocations/${account}/${field === "burst" ? "pacing/burst" : field}`,
          ]),
        ),
      );
      expect(rows.every((f) => f.details?.[field] === 1.234)).toBe(true);
    },
  );
  it("uses an allocation pointer when the ledger names multiple fields", () => {
    expect(
      findings({ items: { alpha: { allocations: { acct: { guarantee: 60, ceiling: 50 } } } } }),
    ).toEqual([
      expect.objectContaining({
        kind: "invalid-portfolio",
        location: "/items/alpha/allocations/acct",
        message: 'Ceiling below guarantee for "alpha".',
      }),
    ]);
  });
  it("reports the ledger guarantee error at its parent's items mapping", () => {
    const rows = findings({
      items: {
        alpha: {
          items: {
            beta: { allocations: { acct: { guarantee: 70 } } },
            gamma: { allocations: { acct: { guarantee: 40 } } },
          },
        },
      },
    });
    expect(rows).toEqual([
      expect.objectContaining({
        kind: "guarantee-limit",
        location: "/items/alpha/items",
        details: { parent: "alpha", account: "acct", sum: 110 },
      }),
    ]);
    expect(rows[0]?.message).toContain('"alpha"');
    expect(rows[0]?.message).toContain("110%");
  });
  it("reports binding conflicts in declaration order with exact locations", () => {
    const rows = findings(
      { items: { alpha: {} } },
      {
        githubProjects: {
          first: { ...github(), t3codeProjects: ["project-1"] },
          second: { ...github(), owner: "EXAMPLE-ORG", t3codeProjects: ["project-1"] },
        },
        t3codeProjects: { first: t3(), third: t3() },
      },
    );
    expect(rows.map((f) => [f.kind, f.location])).toEqual([
      ["duplicate-project", "/githubProjects/second"],
      ["duplicate-association", "/githubProjects/second/t3codeProjects/0"],
      ["duplicate-binding", "/t3codeProjects/first"],
      ["bound-and-associated", "/t3codeProjects/first"],
      ["duplicate-project", "/t3codeProjects/third"],
      ["bound-and-associated", "/t3codeProjects/third"],
    ]);
  });
  it("checks missing, Other and inherited archived items, but permits archived bindings", () => {
    expect(
      findings(
        { items: { alpha: { archived: true, items: { beta: {} } } } },
        {
          githubProjects: {
            first: github("missing"),
            second: { ...github("other"), number: 2 },
            third: { ...github("beta"), number: 3 },
          },
        },
      ).map((f) => [f.kind, f.location]),
    ).toEqual([
      ["unknown-item", "/githubProjects/first/item"],
      ["unknown-item", "/githubProjects/second/item"],
      ["archived-item", "/githubProjects/third/item"],
    ]);
    expect(
      lint(
        { items: { alpha: { archived: true } } },
        { githubProjects: { first: { ...github(), archived: true } } },
      ).ok,
    ).toBe(true);
  });
  it("rejects non-finite percentages even on archived items", () => {
    expect(
      findings({
        items: { alpha: { archived: true, allocations: { acct: { guarantee: Number.NaN } } } },
      }),
    ).toContainEqual(
      expect.objectContaining({
        kind: "schema",
        location: "/items/alpha/allocations/acct/guarantee",
      }),
    );
  });
  it("reports a cyclic YAML document as a schema finding and permits ordinary aliases", () => {
    expect(
      lintPortfolioDeclaration({
        portfolio: "items: &cycle { alpha: { items: *cycle } }",
        bindings: undefined,
      }),
    ).toMatchObject({ ok: false, findings: [{ file: "portfolio", kind: "schema", location: "" }] });
    expect(
      lintPortfolioDeclaration({
        portfolio: "items: { alpha: &leaf {}, beta: *leaf }",
        bindings: undefined,
      }).ok,
    ).toBe(true);
  });
  it("reports row errors alongside structural findings in both files", () => {
    const rows = findings(
      {
        items: {
          alpha: { items: { beta: {} } },
          gamma: { items: { beta: { allocations: { acct: { guarantee: 1.234 } } } } },
          delta: { items: { other: {} }, allocations: { acct: { guarantee: 1.234 } } },
        },
      },
      { githubProjects: { first: github("missing") } },
    );
    expect(rows.map((f) => [f.kind, f.location])).toEqual([
      ["duplicate-item", "/items/gamma/items/beta"],
      ["other-without-items", "/items/delta/items/other"],
      ["invalid-portfolio", "/items/gamma/items/beta/allocations/acct/guarantee"],
      ["invalid-portfolio", "/items/delta/allocations/acct/guarantee"],
      ["unknown-item", "/githubProjects/first/item"],
    ]);
  });
});
