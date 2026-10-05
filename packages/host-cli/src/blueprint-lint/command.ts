// ---
// relationships:
//   implements: host-cli-blueprint-lint
// ---
import { readTaskMetadata, printTaskMetadataFindings } from "../task-metadata-lint/command.ts";
import { declaredLifecycleOptions } from "@wyrd-company/manifold-shared";
import { readFile } from "node:fs/promises";
import { lintBlueprint, manifoldImplementationNames } from "@wyrd-company/manifold-shared";
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
export async function blueprintLintCommand(args: readonly string[]) {
  const files: string[] = [];
  let repository: string | undefined;
  let lifecycleOptions: ReadonlySet<string> | undefined;
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
  if (!files.length) {
    console.error("Usage: manifold-host blueprint lint <file>...");
    return 2;
  }
  if (repository !== undefined) {
    try {
      const result = await readTaskMetadata(repository);
      if (!result.ok) {
        printTaskMetadataFindings(result);
        return 2;
      }
      lifecycleOptions = declaredLifecycleOptions(result.declaration);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
  }
  const inputs = [];
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
    const result = await lintBlueprint(file, text, manifoldImplementationNames, {
      ...(configurationBound === undefined ? {} : { configurationBound }),
      ...(lifecycleOptions === undefined ? {} : { lifecycleOptions }),
    });
    if (!result.ok) {
      for (const finding of result.findings) console.log(line(file, finding));
      exitCode = 1;
    }
    for (const warning of result.warnings) console.log(line(file, warning));
  }
  return exitCode;
}
