// ---
// relationships:
//   implements: process-repository
// ---
import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
export function layout(directory: string) {
  return { directory, gitdir: join(directory, "git"), pointer: join(directory, "current") };
}
export async function syncDirectory(directory: string) {
  const handle = await fs.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function publish(pointer: string, commit: string) {
  const temporary = `${pointer}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx");
  try {
    await handle.writeFile(commit + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, pointer);
  await syncDirectory(dirname(pointer));
}
