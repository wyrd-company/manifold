// ---
// relationships:
//   verifies: [service-assembly, host-cli-usage]
// ---
import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { TestProject } from "vite-plus/test/node";
import type { ChildArtifacts } from "./child-process.ts";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

export default async function setup(project: TestProject) {
  const directory = await mkdtemp(join(tmpdir(), "manifold-test-children-"));
  const close = () => rm(directory, { recursive: true, force: true });
  const artifacts: ChildArtifacts = {
    service: join(directory, "service"),
    host: join(directory, process.platform === "win32" ? "manifold-host.exe" : "manifold-host"),
    blueprint: join(directory, process.platform === "win32" ? "blueprint.exe" : "blueprint"),
  };
  try {
    const host = join(root, "packages/host-cli");
    const bun = join(host, "node_modules/.bin/bun");
    await execute(bun, [
      "build",
      join(host, "src/cli.ts"),
      join(host, "src/hook/worker.ts"),
      "--compile",
      "--bytecode",
      "--outfile",
      artifacts.host,
    ]);
    if (project.config.name === "service-children") {
      const service = join(root, "packages/service");
      const configuration = join(directory, "tsconfig.json");
      await writeFile(
        configuration,
        JSON.stringify({
          extends: join(service, "tsconfig.build.json"),
          compilerOptions: {
            outDir: artifacts.service,
            declaration: false,
            typeRoots: [join(service, "node_modules/@types")],
          },
          include: [join(service, "src/**/*.ts")],
          exclude: [join(service, "src/**/*.test.ts"), join(service, "src/**/test-fixtures/**")],
          files: [
            "environments/test-fixtures/control-worker.ts",
            "gates/test-fixtures/crash-worker.ts",
            "gates/test-fixtures/comparator-failure-worker.ts",
            "test-fixtures/foundation-worker.ts",
            "test-fixtures/default-process-worker.ts",
            "task-metadata/test-fixtures/card-move-worker.ts",
            "task-metadata/test-fixtures/project-config-worker.ts",
            "capacity/test-fixtures/recovery-worker.ts",
            "service/test-fixtures/crash-worker.ts",
          ].map((file) => join(service, "src", file)),
        }),
      );
      await execute(process.execPath, [
        join(service, "node_modules/typescript/bin/tsc"),
        "-p",
        configuration,
      ]);
      await symlink(join(service, "node_modules"), join(artifacts.service, "node_modules"), "dir");
      await writeFile(join(artifacts.service, "package.json"), '{"type":"module"}');
    } else {
      await execute(bun, [
        "build",
        join(host, "src/blueprint-lint/test-fixtures/bundle-worker.ts"),
        "--compile",
        "--outfile",
        artifacts.blueprint,
      ]);
    }
    project.provide("childArtifacts", artifacts);
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}
