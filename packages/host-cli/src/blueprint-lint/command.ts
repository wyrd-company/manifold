// ---
// relationships:
//   implements: host-cli-blueprint-lint
// ---
import { readTaskMetadata } from "../task-metadata-lint/command.ts";
import { declaredLifecycleOptions, declaredTaskFields } from "@wyrd-company/manifold-shared";
import { join } from "node:path";
import { lstat, readdir, readFile } from "node:fs/promises";
import {
  lintBlueprint,
  manifoldImplementationNames,
  lintInvokedDecisionModels,
} from "@wyrd-company/manifold-shared";
import type { BlueprintFinding } from "@wyrd-company/manifold-shared";

function line(file: string, finding: BlueprintFinding) {
  const suffix =
    finding.kind === "yaml"
      ? ` (line ${finding.line}, column ${finding.column})`
      : finding.kind === "implementation-unknown"
        ? ` (${finding.implementationKind} ${finding.name})`
        : finding.gate
          ? ` (gate ${finding.gate})`
          : finding.sample
            ? ` (sample ${finding.sample}${finding.eventType ? `, event ${finding.eventType}` : ""})`
            : "";
  return `${file}:${finding.location} ${finding.kind} ${finding.message.replaceAll(/\r?\n/g, " ")}${suffix}`;
}
export async function blueprintLintCommand(
  args: readonly string[],
  bundle: { readonly files: ReadonlyMap<string, string> } = { files: new Map() },
) {
  const files: string[] = [];
  let repository: string | undefined;
  let lifecycleOptions: ReadonlySet<string> | undefined;
  let taskFields: ReturnType<typeof declaredTaskFields> | undefined;
  let configurationBound: number | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === "--repository") {
      const value = args[++index];
      if (repository !== undefined || !value || value.startsWith("--")) {
        console.error("--repository requires a directory");
        return 2;
      }
      repository = value;
    } else if (arg === "--configuration-bound") {
      const value = args[++index];
      if (
        configurationBound !== undefined ||
        value === undefined ||
        !/^[0-9]+$/.test(value) ||
        !Number.isInteger(Number(value)) ||
        Number(value) < 1
      ) {
        console.error("--configuration-bound requires a positive integer");
        return 2;
      }
      configurationBound = Number(value);
    } else if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      return 2;
    } else files.push(arg);
  }
  if (!files.length && repository === undefined) {
    console.error("Usage: manifold-host blueprint lint <file>...");
    return 2;
  }
  if (repository !== undefined) {
    try {
      const result = await readTaskMetadata(repository);
      if (!result.ok) {
        console.error(
          `task-metadata.yml: ${result.findings.length} findings; run manifold-host task-metadata lint`,
        );
        return 2;
      }
      lifecycleOptions = declaredLifecycleOptions(result.declaration);
      taskFields = declaredTaskFields(result.declaration);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
  }
  const inputs: { file: string; text: string }[] = [];
  if (!files.length && repository !== undefined) {
    try {
      const texts = new Map(
        [...bundle.files].filter(([path]) => /^blueprints\/.*\.ya?ml$/.test(path)),
      );
      async function discover(path: string) {
        let entries;
        try {
          entries = await readdir(join(repository!, path), { withFileTypes: true });
        } catch (error) {
          if (path === "blueprints" && (error as NodeJS.ErrnoException).code === "ENOENT") return;
          throw error;
        }
        for (const entry of entries) {
          const child = `${path}/${entry.name}`;
          if (entry.isDirectory()) await discover(child);
          else if (/\.ya?ml$/.test(entry.name))
            texts.set(child, await readFile(join(repository!, child), "utf8"));
        }
      }
      await discover("blueprints");
      for (const [file, text] of [...texts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        inputs.push({ file, text });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
  }
  for (const file of files) {
    try {
      inputs.push({ file, text: await readFile(file, "utf8") });
    } catch (error) {
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  let exitCode = 0;
  for (const { file, text } of inputs) {
    const decisionModels =
      repository === undefined
        ? undefined
        : await lintInvokedDecisionModels(async (path) => {
            try {
              let current = repository;
              for (const part of path.split("/")) {
                current = join(current, part);
                if ((await lstat(current)).isSymbolicLink()) return undefined;
              }
              return await readFile(current, "utf8");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
              throw error;
            }
          }, text);
    const result = await lintBlueprint(file, text, manifoldImplementationNames, {
      ...(decisionModels === undefined ? {} : { decisionModels }),
      ...(configurationBound === undefined ? {} : { configurationBound }),
      ...(lifecycleOptions === undefined ? {} : { lifecycleOptions }),
      ...(taskFields === undefined ? {} : { taskFields }),
    });
    if (!result.ok) {
      for (const finding of result.findings) console.log(line(file, finding));
      exitCode = 1;
    }
    for (const warning of result.warnings) console.log(line(file, warning));
  }
  return exitCode;
}
