// ---
// relationships:
//   verifies: service-distribution
// ---
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Only known non-packaging paths may skip the exhaustive recovery sweep.
// New build inputs, including package-manager configuration, fail closed.
export function selectMode(event, paths) {
  if (!["push", "pull_request"].includes(event) || !Array.isArray(paths)) return "full";
  return paths.every((path) =>
    /^(docs\/|testing\/|test-support\/|[^/]+\.md$|LICENSE$|NOTICE$|\.editorconfig$)/.test(path),
  )
    ? "short"
    : "full";
}

export function selectCut(mode, seen, command, operation, cut, recovery = "") {
  if (!["short", "full"].includes(mode)) throw new Error("Smoke mode must be short or full");
  const key = JSON.stringify([command, operation, cut, recovery]);
  if (mode === "short" && seen.has(key)) return false;
  seen.add(key);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let paths = null;
  const event = process.env.GITHUB_EVENT_NAME;
  const base = process.env.SMOKE_BASE;
  const head = process.env.SMOKE_HEAD;
  if (
    ["push", "pull_request"].includes(event) &&
    /^[a-f0-9]{40}$/.test(base || "") &&
    /^[a-f0-9]{40}$/.test(head || "") &&
    !/^0+$/.test(base)
  ) {
    try {
      const git = (...args) =>
        execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      const from = event === "pull_request" ? git("merge-base", base, head) : base;
      paths = git("diff", "--no-renames", "--name-only", "-z", from, head, "--")
        .split("\0")
        .filter(Boolean);
    } catch {
      /* An incomplete checkout must retain the full sweep. */
    }
  }
  console.log(selectMode(event, paths));
}
