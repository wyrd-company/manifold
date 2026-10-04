// ---
// relationships:
//   implements: process-repository
// ---
import * as fs from "node:fs/promises";
import { join } from "node:path";
import git from "isomorphic-git";
import { removeTemporaryFiles } from "./git-fs.ts";
import { verify } from "./revision.ts";
import type { GitObjects } from "./revision.ts";
import type { layout } from "./layout.ts";
import { ProcessRepositoryOpenError } from "./types.ts";
export async function recover(
  paths: ReturnType<typeof layout>,
  objects: GitObjects,
): Promise<string | undefined> {
  await fs.mkdir(paths.directory, { recursive: true });
  await git.init({ ...objects, bare: true });
  await git.setConfig({
    ...objects,
    path: "remote.origin.fetch",
    value: "+refs/heads/*:refs/remotes/origin/*",
  });
  for (const name of await fs.readdir(paths.directory))
    if (/^current\..*\.tmp$/.test(name)) await fs.unlink(join(paths.directory, name));
  await removeTemporaryFiles(paths.gitdir);
  const packs = join(paths.gitdir, "objects/pack");
  const names = await fs.readdir(packs);
  for (const name of names)
    if (/^pack-[a-f0-9]{40}\.pack$/.test(name) && !names.includes(name.slice(0, -5) + ".idx"))
      await fs.unlink(join(packs, name));
  let commit: string;
  try {
    commit = (await fs.readFile(paths.pointer, "utf8")).trim();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
  try {
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid pointer");
    await verify(objects, commit);
  } catch {
    throw new ProcessRepositoryOpenError(commit, paths.directory);
  }
  return commit;
}
