// ---
// relationships:
//   implements: process-repository
// ---
import git from "isomorphic-git";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { gitFileSystem } from "./git-fs.ts";
export interface GitObjects {
  fs: ReturnType<typeof gitFileSystem>;
  gitdir: string;
  cache: object;
}
const isFile = (mode: string) => mode === "100644" || mode === "100755";
async function treeAt(objects: GitObjects, commit: string, path: string) {
  let oid = (await git.readCommit({ ...objects, oid: commit })).commit.tree;
  for (const segment of path ? path.split("/") : []) {
    const entry = (await git.readTree({ ...objects, oid })).tree.find(
      (entry) => entry.path === segment,
    );
    if (!entry || entry.type !== "tree") return undefined;
    oid = entry.oid;
  }
  return oid;
}
export async function verify(objects: GitObjects, commit: string): Promise<void> {
  const root = (await git.readCommit({ ...objects, oid: commit })).commit.tree;
  async function walk(oid: string): Promise<void> {
    for (const entry of (await git.readTree({ ...objects, oid })).tree) {
      if (entry.type === "tree") await walk(entry.oid);
      else if (entry.type === "blob") await git.readBlob({ ...objects, oid: entry.oid });
    }
  }
  await walk(root);
}
export function revision(objects: GitObjects, commit: string): ProcessRepositoryRevision {
  return Object.freeze({
    commit,
    async read(path: string) {
      assertRevisionPath(path);
      const segments = path.split("/");
      const name = segments.pop()!;
      const tree = await treeAt(objects, commit, segments.join("/"));
      if (!tree) return undefined;
      const entry = (await git.readTree({ ...objects, oid: tree })).tree.find(
        (entry) => entry.path === name,
      );
      if (!entry || !isFile(entry.mode)) return undefined;
      return new TextDecoder().decode((await git.readBlob({ ...objects, oid: entry.oid })).blob);
    },
    async list(prefix: string) {
      assertRevisionPath(prefix, true);
      const tree = await treeAt(objects, commit, prefix);
      if (!tree) return [];
      const paths: string[] = [];
      async function walk(oid: string, prefix: string): Promise<void> {
        for (const entry of (await git.readTree({ ...objects, oid })).tree) {
          const path = prefix ? `${prefix}/${entry.path}` : entry.path;
          if (entry.type === "tree") await walk(entry.oid, path);
          else if (isFile(entry.mode)) paths.push(path);
        }
      }
      await walk(tree, prefix);
      return paths.sort();
    },
  });
}

function assertRevisionPath(path: string, prefix = false): void {
  if (prefix && path === "") return;
  if (
    !path ||
    path.includes("\\") ||
    path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new TypeError(`Invalid ${prefix ? "prefix" : "path"}: ${path}`);
  }
}
