// ---
// relationships:
//   implements: live-github-environment
// ---
import { join } from "node:path";
import { readCredential } from "./settings.ts";
import type { GitHubPort } from "./github.ts";
export const hookEvents = [
  "issues",
  "issue_dependencies",
  "sub_issues",
  "projects_v2_item",
  "projects_v2",
  "push",
];
export function hookConfiguration(url: string, secret: string) {
  return { url, secret, content_type: "json", insecure_ssl: "0" };
}
export async function setHookState(
  github: Pick<GitHubPort, "hook" | "updateHook">,
  directory: string,
  id: number,
  active: boolean,
  url?: string,
) {
  const hook = await github.hook(id);
  const expected = url ?? hook.config.url;
  if (hook.active === active && hook.config.url === expected) return;
  const secret = await readCredential(join(directory, "hook.secret"));
  await github.updateHook(id, {
    active,
    events: hookEvents,
    config: hookConfiguration(expected, secret),
  });
}
