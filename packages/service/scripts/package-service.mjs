// ---
// relationships:
//   implements: service-distribution
// ---
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

const run = promisify(execFile);
const arch = process.argv[2] || process.arch;
if (!["x64", "arm64"].includes(arch)) throw new Error("ARCH must be x64 or arm64");
const root = resolve(import.meta.dirname, "../../..");
const output = resolve(root, "dist/packages");
const workspace = resolve(output, `workspace-linux-${arch}`);
const staging = resolve(output, `staging-linux-${arch}`);
await rm(workspace, { recursive: true, force: true });
await rm(staging, { recursive: true, force: true });
await mkdir(workspace, { recursive: true });
try {
  for (const name of ["service", "shared", "console"]) {
    await rm(resolve(root, "packages", name, "dist"), { recursive: true, force: true });
  }
  const build = await run("pnpm", ["run", "build"], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(build.stdout);
  // A private build workspace makes architecture selection local to this deploy.
  for (const file of ["package.json", "pnpm-lock.yaml"])
    await cp(resolve(root, file), resolve(workspace, file));
  const settings = parse(await readFile(resolve(root, "pnpm-workspace.yaml"), "utf8"));
  settings.injectWorkspacePackages = true;
  settings.supportedArchitectures = { os: ["linux"], cpu: [arch], libc: ["glibc"] };
  await writeFile(resolve(workspace, "pnpm-workspace.yaml"), stringify(settings));
  for (const name of ["service", "shared", "console"]) {
    const target = resolve(workspace, "packages", name);
    await mkdir(target, { recursive: true });
    await cp(resolve(root, "packages", name, "package.json"), resolve(target, "package.json"));
    await cp(resolve(root, "packages", name, "dist"), resolve(target, "dist"), { recursive: true });
    // Preserve source in the build workspace so manifests, rather than this
    // script, define what pnpm ships. The smoke detects missing files fields.
    await cp(resolve(root, "packages", name, "src"), resolve(target, "src"), { recursive: true });
  }
  const deployed = resolve(staging, "manifold-service");
  const deployedResult = await run(
    "pnpm",
    ["--filter", "@wyrd-company/manifold-service", "deploy", "--prod", deployed],
    { cwd: workspace, maxBuffer: 16 * 1024 * 1024 },
  );
  process.stdout.write(deployedResult.stdout);
  for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml"])
    await rm(resolve(deployed, file), { force: true });
  async function removeTests(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (
        ["test", "tests", "__tests__", "test-fixtures", "spec"].includes(entry.name) ||
        /\.(test|spec)\.[jt]s$/.test(entry.name)
      )
        await rm(path, { recursive: true, force: true });
      else if (entry.isDirectory()) await removeTests(path);
    }
  }
  await removeTests(resolve(deployed, "node_modules"));
  const { version } = JSON.parse(await readFile(resolve(deployed, "package.json"), "utf8"));
  const archive = resolve(output, `manifold-service-${version}-linux-${arch}.tar.gz`);
  const partial = `${archive}.partial`;
  await rm(partial, { force: true });
  await run("tar", ["-czf", partial, "-C", staging, "manifold-service"]);
  await rename(partial, archive);
  await cp(
    resolve(import.meta.dirname, "manifold-upgrade.sh"),
    resolve(output, "manifold-upgrade.sh"),
  );
  process.stdout.write(`${archive}\n`);
} finally {
  await rm(workspace, { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
}
