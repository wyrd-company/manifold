// ---
// relationships:
//   implements: live-github-environment
// ---
import { homedir } from "node:os";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync, existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parse } from "yaml";
export type Settings = {
  organization: string;
  marker: string;
  repository: string;
  processRepository: string;
  project: string;
  seedIssues: number;
  credentials: {
    patFile: string;
    pinggyTokenFile: string;
    appEnvFile: string;
    appPrivateKeyFile: string;
  };
  pinggyHost: string;
  sweepIntervalMs: number;
};
export function expandPath(path: string) {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);
}
export function stateDirectory() {
  const directory = resolve(
    process.env["XDG_STATE_HOME"] ?? resolve(homedir(), ".local/state"),
    "manifold-live-github",
  );
  let existing = directory;
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const physical = resolve(realpathSync(existing), relative(existing, directory));
  const worktree = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
  const path = relative(worktree, physical);
  if (!path || (!path.startsWith("../") && !isAbsolute(path)))
    throw new Error("Live state directory must be outside the worktree");
  return directory;
}
export async function ensureState(directory: string) {
  process.umask(0o077);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}
export async function readCredential(path: string) {
  try {
    const value = (await readFile(expandPath(path), "utf8")).trim();
    if (value) return value;
  } catch {
    /* name only, no value or underlying error */
  }
  throw new Error(`Missing or empty credential file: ${path}`);
}
export async function readApp(settings: Settings) {
  const text = await readCredential(settings.credentials.appEnvFile);
  const entries = new Map(
    text.split(/\r?\n/).map((line) => {
      const match = /^\s*(?:export\s+)?([A-Z_]+)\s*=\s*["']?(\d+)["']?\s*$/.exec(line);
      return match ? ([match[1]!, Number(match[2])] as const) : (["", 0] as const);
    }),
  );
  const appId = entries.get("APP_ID"),
    installationId = entries.get("INSTALLATION_ID");
  if (!appId || !installationId)
    throw new Error("App file needs numeric APP_ID and INSTALLATION_ID");
  return { appId, installationId };
}
export async function loadSettings(): Promise<Settings> {
  const value: unknown = parse(await readFile(new URL("../settings.yml", import.meta.url), "utf8"));
  if (!value || typeof value !== "object") throw new Error("Invalid live settings");
  const settings = value as Settings;
  for (const name of [
    "organization",
    "marker",
    "repository",
    "processRepository",
    "project",
    "pinggyHost",
  ] as const)
    if (typeof settings[name] !== "string" || !settings[name])
      throw new Error(`Invalid setting: ${name}`);
  if (!/^[A-Za-z0-9.-]+$/.test(settings.pinggyHost)) throw new Error("Invalid pinggyHost");
  if (
    !Number.isInteger(settings.seedIssues) ||
    settings.seedIssues < 0 ||
    !Number.isFinite(settings.sweepIntervalMs) ||
    settings.sweepIntervalMs < 1
  )
    throw new Error("Invalid numeric settings");
  for (const [name, variable] of [
    ["patFile", "PAT_FILE"],
    ["pinggyTokenFile", "PINGGY_TOKEN_FILE"],
    ["appEnvFile", "APP_ENV_FILE"],
    ["appPrivateKeyFile", "APP_PRIVATE_KEY_FILE"],
  ] as const) {
    const path = process.env[variable] ?? settings.credentials?.[name];
    if (typeof path !== "string" || !path) throw new Error(`Missing credential path: ${name}`);
    settings.credentials[name] = expandPath(path);
  }
  return settings;
}
export async function writeIfChanged(file: string, content: string) {
  try {
    if ((await readFile(file, "utf8")) === content) return false;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, file);
  return true;
}
