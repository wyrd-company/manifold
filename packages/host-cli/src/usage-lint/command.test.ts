// ---
// relationships:
//   verifies: host-cli-usage
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { stringify } from "yaml";
import { lintUsageDeclaration } from "@wyrd-company/manifold-shared";
import { runUsageCommand } from "../usage/index.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
test("usage lint accepts capacity without a price file and shares located findings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "usage-lint-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  let output = "",
    errors = "";
  const stdout = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  const stderr = new Writable({
    write(chunk, _encoding, done) {
      errors += String(chunk);
      done();
    },
  });
  const io = { stdout, stderr, env: {}, home: dir };
  const account = {
    unit: "usd",
    kind: "api",
    capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
  };
  const text = () => stringify({ accounts: { acct: account } });
  await writeFile(join(dir, "accounts.yml"), text());
  expect(await runUsageCommand(["lint", dir], io)).toBe(0);
  expect(output).toBe("");
  expect(errors).toBe("");
  account.capacity.amount = 0.0000001;
  await writeFile(join(dir, "accounts.yml"), text());
  expect(await runUsageCommand(["lint", dir], io)).toBe(1);
  const result = lintUsageDeclaration({ accounts: text(), prices: undefined });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(output).toBe(
      result.findings
        .map(
          (finding) =>
            `${finding.file}.yml:${finding.location} ${finding.kind} ${finding.message}\n`,
        )
        .join(""),
    );
  expect(errors).toBe("");
  output = "";
  expect(await runUsageCommand(["lint", join(dir, "missing")], io)).toBe(2);
  expect(output).toBe("");
  expect(errors.startsWith(`${join(dir, "missing")}: `)).toBe(true);
  expect(await runUsageCommand(["lint", dir, dir], io)).toBe(2);
});

test.each(["accounts.yml", "prices.yml"])(
  "names the unreadable file %s before linting",
  async (file) => {
    const dir = await mkdtemp(join(tmpdir(), "usage-lint-"));
    cleanup.push(() => rm(dir, { recursive: true, force: true }));
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(dir, file));
    await writeFile(join(dir, file === "accounts.yml" ? "prices.yml" : "accounts.yml"), "[");
    let stdout = "",
      stderr = "";
    const io = {
      stdout: new Writable({
        write(chunk, _encoding, done) {
          stdout += String(chunk);
          done();
        },
      }),
      stderr: new Writable({
        write(chunk, _encoding, done) {
          stderr += String(chunk);
          done();
        },
      }),
      env: {},
      home: dir,
    };
    expect(await runUsageCommand(["lint", dir], io)).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toMatch(new RegExp(`^${file.replace(".", "\\.")}: `));
  },
);
test("prints accounts findings before prices findings, preserving each file's order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "usage-lint-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const accounts = stringify({
    accounts: {
      acct: {
        unit: "usd",
        kind: "api",
        capacity: { amount: 0.0000001, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
      },
      alternate: {
        unit: "usd",
        kind: "api",
        capacity: { amount: 1.1234567, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
      },
    },
  });
  const prices =
    "models: { first: { standard: { input: 1 } }, second: { standard: { input: 1 } } }";
  await writeFile(join(dir, "accounts.yml"), accounts);
  await writeFile(join(dir, "prices.yml"), prices);
  let output = "";
  const stdout = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  expect(
    await runUsageCommand(["lint", dir], { stdout, stderr: process.stderr, env: {}, home: dir }),
  ).toBe(1);
  const findings = lintUsageDeclaration({ accounts, prices });
  expect(findings.ok).toBe(false);
  if (!findings.ok) {
    const ordered = ["accounts", "prices"].flatMap((file) =>
      findings.findings.filter((finding) => finding.file === file),
    );
    expect(output).toBe(
      ordered
        .map(
          (finding) =>
            `${finding.file}.yml:${finding.location} ${finding.kind} ${finding.message}\n`,
        )
        .join(""),
    );
  }
});
