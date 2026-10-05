// ---
// relationships:
//   implements: [default-process, bundle-tables]
// ---
import { bundleDigest } from "@wyrd-company/manifold-shared";
import type { Store } from "../store/index.ts";
import type { Bundle, BundleSource } from "../blueprint-loader/index.ts";
import { bundledFiles } from "./bundle.generated.ts";
export const shippedBundle: Bundle = {
  files: new Map(Object.entries(bundledFiles)),
  digest: bundleDigest(new Map(Object.entries(bundledFiles))),
};
/** The console's structural bundle seam. */
export const bundle = { digest: shippedBundle.digest, blueprints: shippedBundle.files };
export function openBundles(options: {
  readonly store: Store;
  readonly current?: Bundle;
}): BundleSource {
  const supplied = options.current ?? shippedBundle;
  const current: Bundle = { digest: supplied.digest, files: new Map(supplied.files) };
  if (bundleDigest(current.files) !== current.digest)
    throw new TypeError("Bundle digest does not match its files");
  const database = options.store.connection.database;
  options.store.connection.transaction(() => {
    if (!database.prepare("SELECT digest FROM bundle WHERE digest = ?").get(current.digest)) {
      database
        .prepare("INSERT INTO bundle (digest, recorded_at) VALUES (?, ?)")
        .run(current.digest, options.store.now());
      const insert = database.prepare(
        "INSERT INTO bundle_file (digest, path, text) VALUES (?, ?, ?)",
      );
      for (const [path, text] of current.files) insert.run(current.digest, path, text);
    }
  });
  const cache = new Map<string, Bundle>([[current.digest, current]]);
  return {
    current,
    at(digest) {
      const cached = cache.get(digest);
      if (cached) return cached;
      if (!database.prepare("SELECT digest FROM bundle WHERE digest = ?").get(digest))
        return undefined;
      const files = new Map(
        database
          .prepare("SELECT path, text FROM bundle_file WHERE digest = ? ORDER BY path")
          .all(digest)
          .map((row) => [String(row["path"]), String(row["text"])]),
      );
      const bundle = { digest, files };
      cache.set(digest, bundle);
      return bundle;
    },
  };
}
