// ---
// relationships:
//   implements: host-cli-blueprint-lint
// ---
import { readFile } from "node:fs/promises";
import { lintBlueprint, manifoldImplementationNames } from "@wyrd-company/manifold-shared";
import type { BlueprintFinding } from "@wyrd-company/manifold-shared";

function line(file: string, finding: BlueprintFinding) {
  const suffix =
    finding.kind === "yaml"
      ? ` (line ${finding.line}, column ${finding.column})`
      : finding.kind === "implementation-unknown"
        ? ` (${finding.implementationKind} ${finding.name})`
        : finding.sample
          ? ` (sample ${finding.sample}${finding.eventType ? `, event ${finding.eventType}` : ""})`
          : "";
  return `${file}:${finding.location} ${finding.kind} ${finding.message.replaceAll(/\r?\n/g, " ")}${suffix}`;
}
export async function blueprintLintCommand(files: readonly string[]) {
  if (!files.length) {
    console.error("Usage: manifold-host blueprint lint <file>...");
    return 2;
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
    const result = await lintBlueprint(file, text, manifoldImplementationNames);
    if (!result.ok) {
      for (const finding of result.findings) console.log(line(file, finding));
      exitCode = 1;
    }
  }
  return exitCode;
}
