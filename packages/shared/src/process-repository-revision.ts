// ---
// relationships:
//   implements: process-repository
// ---
/** The process repository's declared files at one commit. Read-only. */
export interface ProcessRepositoryRevision {
  readonly commit: string;
  read(path: string): Promise<string | undefined>;
  list(prefix: string): Promise<readonly string[]>;
}

/** A revision over a copy of the given files, for tests and tools. */
export function memoryRevision(
  commit: string,
  files: Readonly<Record<string, string>>,
): ProcessRepositoryRevision {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new TypeError(`Invalid commit: ${commit}`);
  const contents = new Map(Object.entries(files));
  for (const path of contents.keys()) assertRevisionPath(path);
  return Object.freeze({
    commit,
    async read(path: string) {
      assertRevisionPath(path);
      return contents.get(path);
    },
    async list(prefix: string) {
      assertRevisionPath(prefix, true);
      return [...contents.keys()].filter((path) => !prefix || path.startsWith(prefix + "/")).sort();
    },
  });
}

/** Shared boundary for implementations of ProcessRepositoryRevision. */
export function assertRevisionPath(path: string, prefix = false): void {
  if (prefix && path === "") return;
  if (
    !path ||
    path.includes("\\") ||
    path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new TypeError(`Invalid ${prefix ? "prefix" : "path"}: ${path}`);
  }
}
