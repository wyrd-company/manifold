// ---
// relationships:
//   implements: operator-console
// ---
import { stringify } from "yaml";
export function starterModel() {
  const input = crypto.randomUUID(),
    table = crypto.randomUUID(),
    output = crypto.randomUUID();
  return stringify({
    nodes: [
      { id: input, type: "inputNode" },
      {
        id: table,
        name: "Decision table",
        type: "customNode",
        content: {
          kind: "jsonataDecisionTable",
          config: {
            hitPolicy: "first",
            inputs: [{ id: crypto.randomUUID(), name: "Input 1", field: "" }],
            outputs: [{ id: crypto.randomUUID(), name: "Output 1", field: "" }],
            rules: [],
          },
        },
      },
      { id: output, type: "outputNode" },
    ],
    edges: [
      { id: crypto.randomUUID(), sourceId: input, targetId: table },
      { id: crypto.randomUUID(), sourceId: table, targetId: output },
    ],
  });
}
