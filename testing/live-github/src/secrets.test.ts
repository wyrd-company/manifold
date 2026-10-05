// ---
// relationships:
//   verifies: live-github-environment
// ---
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vite-plus/test";
import { scanSecrets, runReportedSteps } from "./secrets.ts";
test("scan detects raw and encoded synthetic credentials and reports names without values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "secret-proof-"));
  const secret = 'synthetic "credential"/+with\ncharacters';
  try {
    for (const value of [
      secret,
      Buffer.from(secret).toString("base64"),
      encodeURIComponent(secret),
      JSON.stringify(secret).slice(1, -1),
    ]) {
      const file = join(dir, "generated");
      await writeFile(file, value);
      const findings = await scanSecrets([file], [{ name: "PAT", value: secret }]);
      expect(findings).toEqual([{ file, name: "PAT" }]);
      expect(JSON.stringify(findings)).not.toContain(secret);
    }
    await writeFile(join(dir, "generated"), "clean");
    expect(await scanSecrets([join(dir, "generated")], [{ name: "PAT", value: secret }])).toEqual(
      [],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("printed synthetic credential through the smoke reporter fails the run and identifies smoke log", async () => {
  const dir = await mkdtemp(join(tmpdir(), "report-proof-"));
  const file = join(dir, "smoke.log");
  const value = "synthetic-credential-proof";
  try {
    const output: string[] = [];
    expect(
      await runReportedSteps(
        file,
        [{ name: "sample", run: async () => value }],
        [{ name: "PAT", value }],
        [],
        (line) => output.push(line),
      ),
    ).toBe(false);
    expect(output.at(-1)).toContain(`${file} (PAT)`);
    expect(output.at(-1)).not.toContain(value);
    expect(
      await runReportedSteps(
        file,
        [{ name: "sample", run: async () => "clean" }],
        [{ name: "PAT", value }],
        [],
        () => {},
      ),
    ).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("a failed step does not hide independent checks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "report-proof-"));
  let ran = false;
  try {
    expect(
      await runReportedSteps(
        join(dir, "smoke.log"),
        [
          {
            name: "failure",
            run: async () => {
              throw new Error("no result");
            },
          },
          {
            name: "independent",
            run: async () => {
              ran = true;
              return "checked";
            },
          },
        ],
        [],
        [],
        () => {},
      ),
    ).toBe(false);
    expect(ran).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
