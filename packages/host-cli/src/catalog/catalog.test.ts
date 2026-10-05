// ---
// relationships:
//   verifies: [host-cli, host-command-catalog]
// ---
import { expect, test } from "vite-plus/test";
import { resolve, renderHelp, renderUsage, commandNodes, buildCatalog } from "./catalog.ts";
import type { CommandTree } from "./types.ts";

const tree: CommandTree = {
  tool: { name: "sample", summary: "Handle sample files." },
  help: { flags: ["-h", "--help"], description: "Show help and exit." },
  commands: [
    { name: "help", summary: "Show help.", arguments: [], flags: [], exitCodes: [], examples: [] },
    {
      name: "files",
      summary: "Handle files.",
      arguments: [],
      flags: [],
      exitCodes: [],
      examples: [],
      subcommands: [
        {
          name: "list",
          summary: "List files.",
          arguments: [],
          flags: [],
          exitCodes: [],
          examples: [],
        },
        {
          name: "write",
          summary: "Write files.",
          arguments: [
            {
              name: "files",
              description: "Files to write.",
              position: 0,
              required: false,
              greedy: true,
            },
          ],
          flags: [
            {
              flags: ["-o", "--output"],
              kind: "option",
              description: "Output directory.",
              required: true,
              value: { type: "path" },
            },
            {
              flags: ["--label"],
              kind: "option",
              description: "A label.",
              required: false,
              repeatable: true,
              value: { type: "string" },
            },
            {
              flags: ["--count"],
              kind: "option",
              description: "Number to write.",
              required: false,
              default: 5,
              value: { type: "integer" },
            },
            { flags: ["--quiet"], kind: "flag", description: "Quiet output.", required: false },
          ],
          exitCodes: [{ code: 0, meaning: "Files written." }],
          examples: ["sample files write -o ./out ./input"],
        },
      ],
    },
  ],
};
const nodes = commandNodes(tree);
const root = nodes[0]!;
const write = nodes.find((node) => node.path.join(" ") === "files write")!;
function help(path: string[]) {
  return resolve(tree, [...path, "--help"]);
}

test("root and group help lists relative runnable paths in order", () => {
  expect(renderHelp(root)).toBe(
    `Handle sample files.\n\nUsage:\n  sample <command> [flags]\n\nCommands:\n  files list          List files.\n  files write         Write files.\n  help                Show help.\n\nFlags:\n  -h, --help          Show help and exit.\n\nRun 'sample <command> --help' for the arguments and flags of a command.\n`,
  );
  const group = nodes.find((node) => node.path.join(" ") === "files")!;
  expect(renderHelp(group)).toContain("  list                List files.");
  expect(renderHelp(group)).not.toContain("files list");
  expect(resolve(tree, ["files"])).toEqual(help(["files"]));
});
test("runnable help renders arguments, required flags, defaults, repeatability, exits and examples", () => {
  const text = renderHelp(write);
  expect(text).toContain("Usage:\n  sample files write -o <value> [flags] [<files>]...");
  expect(text).toContain("Arguments:\n  <files>             Files to write.");
  expect(text).toContain("-o, --output <path> Output directory. Required.");
  expect(text).toContain("--label <string>    A label. Repeatable.");
  expect(text).toContain("--count <integer>   Number to write. Default: 5.");
  expect(text).toContain("Exit codes:\n  0                   Files written.");
  expect(text).toContain("Examples:\n  sample files write -o ./out ./input");
  expect(renderUsage(write)).toBe(
    "Usage:\n  sample files write -o <value> [flags] [<files>]...\n\nRun 'sample files write --help' for more.\n",
  );
});
test("wraps descriptions to 80 columns and starts long names on the next line", () => {
  const text = renderHelp({
    ...write,
    arguments: [
      {
        name: "a-very-long-argument-name",
        position: 0,
        required: true,
        description: "Long description ".repeat(12),
      },
    ],
  });
  expect(text).toContain("  <a-very-long-argument-name>\n                      Long description");
  for (const line of text.split("\n").filter((line) => line.includes("description")))
    expect(line.length).toBeLessThanOrEqual(80);
});
test.each([{ args: [] }, { args: ["--help"] }, { args: ["-h"] }, { args: ["help"] }])(
  "root forms $args",
  ({ args }) => {
    expect(resolve(tree, args)).toEqual({ kind: "help", text: renderHelp(root) });
  },
);
test.each([
  { args: ["files", "write", "--unknown", "--help"] },
  { args: ["files", "write", "--output=--help", "-h"] },
  { args: ["files", "write", "--label", "value", "--help"] },
])("help wins in flag position $args", ({ args }) => {
  expect(resolve(tree, args)).toEqual(help(["files", "write"]));
});
test.each([
  { args: ["--output", "--help"] },
  { args: ["--output=--help"] },
  { args: ["--quiet", "./file"] },
  { args: ["--output", "--unknown"] },
  { args: ["--label=value"] },
])("preserves runnable arguments $args", ({ args }) => {
  expect(resolve(tree, ["files", "write", ...args])).toEqual({
    kind: "run",
    path: ["files", "write"],
    args,
  });
});
test.each([
  { args: ["absent"], message: "unknown command 'absent'", node: root },
  {
    args: ["files", "absent"],
    message: "unknown command 'files absent'",
    node: nodes.find((node) => node.path.join(" ") === "files")!,
  },
  { args: ["--absent=x"], message: "unknown flag '--absent'", node: root },
  {
    args: ["files", "write", "--absent=x"],
    message: "unknown flag '--absent' for 'files write'",
    node: write,
  },
  {
    args: ["files", "write", "-file"],
    message: "unknown flag '-file' for 'files write'",
    node: write,
  },
])("refuses with reached usage $args", ({ args, message, node }) => {
  expect(resolve(tree, args)).toEqual({
    kind: "refusal",
    text: `sample: ${message}\n\n${renderUsage(node)}`,
  });
});
test("a lone dash is an unknown command before unknown flags in a group", () => {
  const group = nodes.find((node) => node.path.join(" ") === "files")!;
  expect(resolve(tree, ["files", "-", "--absent"])).toEqual({
    kind: "refusal",
    text: `sample: unknown command 'files -'\n\n${renderUsage(group)}`,
  });
});

test("help targets every node without dispatch", () => {
  for (const node of nodes)
    expect(resolve(tree, ["help", ...node.path])).toEqual({ kind: "help", text: renderHelp(node) });
  expect(resolve(tree, ["help", "files", "--help"])).toEqual(help(["help"]));
});
test.each([
  { args: ["help", "absent"], message: "unknown command 'absent'", node: root },
  {
    args: ["help", "files", "absent"],
    message: "unknown command 'files absent'",
    node: nodes.find((node) => node.path.join(" ") === "files")!,
  },
  {
    args: ["help", "files", "write", "extra"],
    message: "unknown command 'files write extra'",
    node: write,
  },
  {
    args: ["help", "files", "write", "--output"],
    message: "unknown flag '--output' for 'help'",
    node: nodes.find((node) => node.path.join(" ") === "help")!,
  },
])("help refuses invalid targets $args", ({ args, message, node }) => {
  expect(resolve(tree, args)).toEqual({
    kind: "refusal",
    text: `sample: ${message}\n\n${renderUsage(node)}`,
  });
});
test("catalog joins runnable declarations to their handlers", async () => {
  const handler = async () => 7;
  const catalog = buildCatalog(tree, { "files list": handler, "files write": handler });
  expect(catalog.map((command) => command.path)).toEqual([
    ["files", "list"],
    ["files", "write"],
  ]);
  expect(catalog[1]).toMatchObject({
    summary: write.summary,
    arguments: write.arguments,
    flags: write.flags,
  });
  expect(
    await catalog[1]!.handler([], {
      stdout: process.stdout,
      stderr: process.stderr,
      home: "/sample",
      env: {},
    }),
  ).toBe(7);
});

test("orders required arguments and omits empty sections and optional flag placeholder", () => {
  const node = {
    ...write,
    flags: [],
    arguments: [
      { name: "second", position: 1, required: true, description: "Second." },
      { name: "first", position: 0, required: true, description: "First." },
    ],
    examples: [],
    exitCodes: [],
  };
  const text = renderHelp(node);
  expect(text).toContain("Usage:\n  sample files write <first> <second>");
  expect(text.indexOf("<first>             First.")).toBeLessThan(
    text.indexOf("<second>            Second."),
  );
  expect(text).not.toContain("[flags]");
  expect(text).not.toContain("Exit codes:");
  expect(text).not.toContain("Examples:");
  expect(renderHelp(nodes.find((node) => node.path.join(" ") === "files list")!)).not.toContain(
    "Arguments:",
  );
});
