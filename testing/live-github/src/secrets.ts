// ---
// relationships:
//   implements: live-github-environment
// ---
import { readFile, writeFile, appendFile, mkdir, readdir, lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readCredential } from "./settings.ts";
import type { Settings } from "./settings.ts";
export type Secret = { name: string; value: string };
export async function credentialValues(settings: Settings, directory: string): Promise<Secret[]> {
  return Promise.all(
    [
      ["PAT", settings.credentials.patFile],
      ["Pinggy", settings.credentials.pinggyTokenFile],
      ["private key", settings.credentials.appPrivateKeyFile],
      ["hook secret", join(directory, "hook.secret")],
    ].map(async ([name, file]) => ({ name: name!, value: await readCredential(file!) })),
  );
}
function forms(value: string) {
  return [
    value,
    Buffer.from(value).toString("base64"),
    encodeURIComponent(value),
    JSON.stringify(value).slice(1, -1),
    ...value.split(/\r?\n/).filter((line) => /^[A-Za-z0-9+/]{64}$/.test(line)),
  ];
}
export async function scanSecrets(files: string[], secrets: Secret[]) {
  const findings: { file: string; name: string }[] = [];
  for (const file of new Set(files)) {
    const data = await readFile(file);
    for (const secret of secrets)
      if (secret.value && forms(secret.value).some((form) => data.includes(Buffer.from(form))))
        findings.push({ file, name: secret.name });
  }
  return findings;
}
export async function generatedFiles(
  directory: string,
  worktree = process.cwd(),
): Promise<string[]> {
  const excluded = new Set([
    resolve(directory, "hook.secret"),
    resolve(directory, "hook.secret.pending"),
    resolve(directory, "tunnel/config"),
  ]);
  async function walk(dir: string): Promise<string[]> {
    const result: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...(await walk(path)));
      else if (entry.isFile() && !excluded.has(path)) result.push(path);
    }
    return result;
  }
  const { stdout } = await promisify(execFile)(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: worktree },
  );
  const tracked: string[] = [];
  for (const name of stdout.split("\0").filter(Boolean)) {
    const file = resolve(worktree, name);
    try {
      if ((await lstat(file)).isFile()) tracked.push(file);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return [...(await walk(directory)), ...tracked];
}
export type SmokeStep = { name: string; run: () => Promise<string> };
export async function runReportedSteps(
  logFile: string,
  steps: SmokeStep[],
  secrets: Secret[],
  files: string[] | (() => Promise<string[]>),
  output: (line: string) => void = console.log,
) {
  await mkdir(dirname(logFile), { recursive: true, mode: 0o700 });
  await writeFile(logFile, "", { mode: 0o600 });
  let passed = true;
  async function report(line: string) {
    await appendFile(logFile, `${line}\n`);
    output(line);
  }
  for (const step of steps) {
    try {
      await report(`PASS ${step.name}: ${await step.run()}`);
    } catch (error) {
      passed = false;
      await report(`FAIL ${step.name}: ${error instanceof Error ? error.message : "step failed"}`);
    }
  }
  const findings = await scanSecrets(
    [...(typeof files === "function" ? await files() : files), logFile],
    secrets,
  );
  if (findings.length) {
    passed = false;
    for (const finding of findings)
      await report(`FAIL Secret scan: ${finding.file} (${finding.name})`);
  } else await report("PASS Secret scan: no credential values found");
  return passed;
}
