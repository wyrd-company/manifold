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
  let output = "";
  const stdout = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  const io = { stdout, stderr: stdout, env: {}, home: dir };
  const account = {
    unit: "usd",
    kind: "api",
    capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
  };
  const text = () => stringify({ accounts: { acct: account } });
  await writeFile(join(dir, "accounts.yml"), text());
  expect(await runUsageCommand(["lint", dir], io)).toBe(0);
  expect(output).toBe("");
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
  expect(await runUsageCommand(["lint", join(dir, "missing")], io)).toBe(2);
  expect(await runUsageCommand(["lint", dir, dir], io)).toBe(2);
});
