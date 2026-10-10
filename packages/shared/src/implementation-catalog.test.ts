// ---
// relationships:
//   verifies: [operator-console, blueprint-loader]
// ---
import { expect, it } from "vite-plus/test";
import { manifoldImplementationCatalog } from "./implementation-catalog.ts";
import { manifoldImplementationNames } from "./implementation-names.ts";
it("derives the registered names from the catalog and holds the merged actor contracts", () => {
  for (const [kind, names] of [
    ["actor", manifoldImplementationNames.actors],
    ["action", manifoldImplementationNames.actions],
    ["guard", manifoldImplementationNames.guards],
    ["delay", manifoldImplementationNames.delays],
  ] as const)
    expect([...names]).toEqual(
      manifoldImplementationCatalog
        .filter((entry) => entry.kind === kind)
        .map((entry) => entry.name),
    );
  const message = manifoldImplementationCatalog.find((entry) => entry.name === "send-message");
  expect(message).toMatchObject({
    kind: "actor",
    input: { required: ["to", "text"] },
    output: { required: ["messages"] },
  });
  const move = manifoldImplementationCatalog.find((entry) => entry.name === "github-card-move");
  expect(move).toMatchObject({
    input: { properties: { status: { pattern: "^\\S(?:.*\\S)?$" } } },
    output: { maxProperties: 0 },
  });
});
