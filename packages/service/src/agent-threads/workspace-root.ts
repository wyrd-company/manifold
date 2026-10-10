// ---
// relationships:
//   implements: agent-threads
// ---
import { failure } from "./types.ts";
export function validateWorkspaceRoot(
  root: string,
  platform: "darwin" | "linux" | "windows" | "unknown",
) {
  if (platform === "unknown") throw failure("environment", "Host platform is unknown");
  const home = /^~(?:$|[/\\])/.test(root);
  const absolute =
    platform === "windows"
      ? /^[a-zA-Z]:[/\\]/.test(root) || /^[/\\]{2}[^/\\]+[/\\][^/\\]+(?:[/\\]|$)/.test(root)
      : root.startsWith("/");
  if (/\p{Cc}/u.test(root) || (!home && !absolute))
    throw failure("template", "Workspace root must be absolute on the host or start with ~");
}
