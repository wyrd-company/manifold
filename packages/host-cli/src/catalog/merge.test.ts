// ---
// relationships:
//   verifies: [host-command-catalog, host-cli]
// ---
import { expect, test } from "vite-plus/test";
import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";
import { mergeCommandTrees } from "./merge.ts";
import { commandTree } from "./command-tree.generated.ts";
import { commandHandlers } from "../commands.ts";
import { commandNodes } from "./catalog.ts";

const tool = { name: "sample", mode: "non-interactive", summary: "Handle files." };
const help = { flags: ["-h", "--help"], description: "Show help." };
const leaf = { name: "list", summary: "List files." };
const group = { name: "files", summary: "Handle files.", subcommands: [leaf] };
const root = {
  tool,
  "global-options": [help],
  commands: [{ name: "help", summary: "Show help." }],
};
function asset(commands: unknown[]) {
  return { tool, commands };
}

test("committed tree agrees with every specification asset", async () => {
  const directory = new URL("../../../../docs/specifications/", import.meta.url);
  const names = (await readdir(directory))
    .filter((name) => /^host-cli.*\.cli\.yml$/.test(name))
    .sort();
  const ordered = ["host-cli.cli.yml", ...names.filter((name) => name !== "host-cli.cli.yml")];
  const assets = await Promise.all(
    ordered.map(async (name) => parse(await readFile(new URL(name, directory), "utf8"))),
  );
  expect(mergeCommandTrees(assets)).toEqual(commandTree);
  expect(Object.keys(commandHandlers).sort()).toEqual(
    commandNodes(commandTree)
      .filter((node) => !node.subcommands && node.path.join(" ") !== "help")
      .map((node) => node.path.join(" "))
      .sort(),
  );
});
test("merges shared groups, sorts paths and drops fields that help does not read", () => {
  const result = mergeCommandTrees([
    root,
    asset([group]),
    asset([
      {
        ...group,
        subcommands: [{ name: "copy", summary: "Copy files.", mode: "non-interactive" }],
      },
    ]),
  ]);
  expect(result.commands[0]!.subcommands!.map((node) => node.name)).toEqual(["copy", "list"]);
  expect(result.commands[0]!.subcommands![0]).not.toHaveProperty("mode");
  expect(
    mergeCommandTrees([
      root,
      { tool: { summary: tool.summary, mode: tool.mode, name: tool.name }, commands: [group] },
    ]),
  ).toEqual(mergeCommandTrees([root, asset([group])]));
});
test.each([
  { name: "different tool", asset: { tool: { ...tool, name: "other" }, commands: [] } },
  {
    name: "different group summary",
    asset: asset([
      { ...group, summary: "Different.", subcommands: [{ name: "copy", summary: "Copy files." }] },
    ]),
  },
  { name: "duplicate leaf", asset: asset([group]) },
  { name: "group becomes leaf", asset: asset([{ name: "files", summary: "Handle files." }]) },
  {
    name: "leaf becomes group",
    asset: asset([{ ...group, subcommands: [{ ...leaf, subcommands: [] }] }]),
  },
  {
    name: "nested help",
    asset: asset([{ ...group, subcommands: [{ name: "help", summary: "Help." }] }]),
  },
  { name: "reserved command", asset: asset([{ name: "--help", summary: "Help." }]) },
  { name: "reserved short command", asset: asset([{ name: "-h", summary: "Help." }]) },
  {
    name: "reserved short flag",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [{ flags: ["-h"], kind: "flag", description: "Help.", required: false }],
      },
    ]),
  },
  {
    name: "reserved flag",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [{ flags: ["--help"], kind: "flag", description: "Help.", required: false }],
      },
    ]),
  },
  {
    name: "empty flags",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [{ flags: [], kind: "flag", description: "Help.", required: false }],
      },
    ]),
  },
  { name: "missing name", asset: asset([{ summary: "Copy." }]) },
  { name: "wrong summary", asset: asset([{ name: "copy", summary: 7 }]) },
  {
    name: "missing option flags",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [{ kind: "flag", description: "Quiet.", required: false }],
      },
    ]),
  },
  {
    name: "missing value type",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [
          {
            flags: ["--output"],
            kind: "option",
            description: "Output.",
            required: false,
            value: {},
          },
        ],
      },
    ]),
  },
  {
    name: "wrong argument position",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        "positional-arguments": [
          { name: "files", description: "Files.", position: "0", required: true },
        ],
      },
    ]),
  },
  {
    name: "wrong exit code",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        output: { "exit-codes": [{ code: "0", meaning: "Done." }] },
      },
    ]),
  },
  { name: "wrong example", asset: asset([{ name: "copy", summary: "Copy.", examples: [3] }]) },
  {
    name: "wrong default",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [
          { flags: ["--quiet"], kind: "flag", description: "Quiet.", required: false, default: {} },
        ],
      },
    ]),
  },
  {
    name: "wrong required",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [{ flags: ["--quiet"], kind: "flag", description: "Quiet.", required: "false" }],
      },
    ]),
  },
  {
    name: "wrong kind",
    asset: asset([
      {
        name: "copy",
        summary: "Copy.",
        options: [{ flags: ["--quiet"], kind: "other", description: "Quiet.", required: false }],
      },
    ]),
  },
])("rejects $name", ({ asset: extra }) => {
  expect(() => mergeCommandTrees([root, asset([group]), extra])).toThrow();
});
