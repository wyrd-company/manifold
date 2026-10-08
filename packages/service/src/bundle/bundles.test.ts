// ---
// relationships:
//   verifies: [default-process, bundle-tables]
// ---
import { expect, it } from "vite-plus/test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { bundleDigest } from "@wyrd-company/manifold-shared";
import { openStore } from "../store/index.ts";
import { openBundles, bundleMigrationSteps, shippedBundle, bundle } from "./index.ts";
it("migrates the bundle schema declared in the SQL asset", () => {
  const store = openStore({ path: ":memory:" });
  const reference = new DatabaseSync(":memory:");
  try {
    store.connection.migrate("bundle", bundleMigrationSteps);
    reference.exec(
      readFileSync(
        new URL("../../../../docs/specifications/bundle-tables.sql", import.meta.url),
        "utf8",
      ),
    );
    const rows = (database: DatabaseSync) =>
      database
        .prepare(
          "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name = 'bundle' OR name LIKE 'bundle_%' ORDER BY name",
        )
        .all()
        .map((row) => ({ ...row, sql: String(row["sql"]).replace(/\s+/g, " ").trim() }));
    expect(rows(store.connection.database)).toEqual(rows(reference));
  } finally {
    reference.close();
    store.close();
  }
});
it("keeps whole immutable bundles across opens and upgrades", () => {
  const dir = mkdtempSync(join(tmpdir(), "bundles-"));
  const path = join(dir, "store.sqlite");
  const firstFiles = new Map([
    ["blueprints/parcel.yml", "one"],
    ["blueprints/route.yml", "two"],
  ]);
  const first = { files: firstFiles, digest: bundleDigest(firstFiles) };
  const secondFiles = new Map([["blueprints/parcel.yml", "three"]]);
  const second = { files: secondFiles, digest: bundleDigest(secondFiles) };
  let store = openStore({ path, now: () => 123 });
  try {
    store.connection.migrate("bundle", bundleMigrationSteps);
    openBundles({ store, current: first });
    openBundles({ store, current: first });
    expect(
      store.connection.database.prepare("SELECT recorded_at FROM bundle").get()?.["recorded_at"],
    ).toBe(123);
    expect(store.connection.database.prepare("SELECT * FROM bundle_file").all()).toHaveLength(2);
    store.close();
    store = openStore({ path });
    store.connection.migrate("bundle", bundleMigrationSteps);
    const bundles = openBundles({ store, current: second });
    expect(bundles.current).toEqual(second);
    expect(bundles.recordedAt!(first.digest)).toBe(123);
    expect(bundles.recordedAt!("absent")).toBeUndefined();
    expect(bundles.at(first.digest)).toEqual(first);
    expect(bundles.at(second.digest)).toEqual(second);
    expect(bundles.at("a".repeat(64))).toBeUndefined();
    expect(() => store.connection.database.exec("UPDATE bundle_file SET text = 'changed'")).toThrow(
      "immutable",
    );
    expect(() => store.connection.database.exec("DELETE FROM bundle_file")).toThrow(
      "never deleted",
    );
    expect(() => store.connection.database.exec("UPDATE bundle SET recorded_at = 456")).toThrow(
      "immutable",
    );
    expect(() => store.connection.database.exec("DELETE FROM bundle")).toThrow("never deleted");
    const invalid = new Map([
      ["blueprints/valid.yml", "one"],
      ["invalid", "two"],
    ]);
    expect(() =>
      openBundles({ store, current: { files: invalid, digest: bundleDigest(invalid) } }),
    ).toThrow();
    expect(store.connection.database.prepare("SELECT * FROM bundle").all()).toHaveLength(2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
it("ships the exact authored blueprint text and digest", () => {
  expect(bundle).toEqual({ digest: shippedBundle.digest, blueprints: shippedBundle.files });
  expect(shippedBundle.files.size).toBe(1);
  expect(shippedBundle.files.get("blueprints/task.yml")).toBe(
    readFileSync(new URL("../../bundle/blueprints/task.yml", import.meta.url), "utf8"),
  );
  expect(shippedBundle.digest).toBe(bundleDigest(shippedBundle.files));
});
it("refuses a digest that does not identify the supplied texts", () => {
  const store = openStore({ path: ":memory:" });
  try {
    store.connection.migrate("bundle", bundleMigrationSteps);
    expect(() =>
      openBundles({
        store,
        current: {
          digest: "a".repeat(64),
          files: new Map([["blueprints/parcel.yml", "different"]]),
        },
      }),
    ).toThrow("digest");
    expect(store.connection.database.prepare("SELECT * FROM bundle").all()).toEqual([]);
  } finally {
    store.close();
  }
});
