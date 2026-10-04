// ---
// relationships:
//   implements: service-assembly
// ---
import type { HttpListener } from "./types.ts";
export interface Mount {
  readonly prefix: string;
  readonly listener: HttpListener;
  readonly operator: boolean;
}
export function validatePrefix(prefix: string, mounts: readonly Mount[]) {
  if (
    !/^\/(?:[^/?#%]+)(?:\/[^/?#%]+)*$/.test(prefix) ||
    mounts.some((mount) => mount.prefix === prefix)
  )
    throw new TypeError(`Invalid or repeated HTTP prefix: ${prefix}`);
}
export function matchMount(path: string, mounts: readonly Mount[]) {
  return mounts.find((mount) => path === mount.prefix || path.startsWith(mount.prefix + "/"));
}
