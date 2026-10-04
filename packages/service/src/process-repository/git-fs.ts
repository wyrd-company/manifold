// ---
// relationships:
//   implements: process-repository
// ---
import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { syncDirectory } from "./layout.ts";
export function gitFileSystem(gitdir: string) {
  const objectPrefix = resolve(gitdir, "objects") + sep;
  return {
    promises: {
      ...fs,
      async writeFile(...[path, data, options]: Parameters<typeof fs.writeFile>) {
        const target = String(path);
        const temporary = `${target}.${randomUUID()}.manifold-tmp`;
        await fs.writeFile(temporary, data, options);
        const handle = await fs.open(temporary, "r");
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
        if (resolve(target).startsWith(objectPrefix)) {
          try {
            await fs.link(temporary, target);
          } catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST"))
              throw error;
          }
          await fs.unlink(temporary);
        } else await fs.rename(temporary, target);
        await syncDirectory(dirname(target));
      },
    },
  };
}
export async function removeTemporaryFiles(directory: string): Promise<void> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeTemporaryFiles(path);
    else if (entry.name.endsWith(".manifold-tmp")) await fs.unlink(path);
  }
}
