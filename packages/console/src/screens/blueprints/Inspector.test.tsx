// ---
// relationships:
//   verifies: operator-console
// ---
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { blueprintGraph } from "@wyrd-company/manifold-shared/blueprint-graph";
import { Inspector } from "./Inspector.tsx";
it("does not offer fields for a removed state or candidate selection", () => {
  const text =
    "schemas: { input: true, output: true, context: true, events: {} }\nmachine: { id: sample, initial: waiting, states: { waiting: {} } }\n";
  for (const selection of ["gone", "/machine/states/waiting/on/NEXT/0"])
    expect(
      renderToStaticMarkup(
        <Inspector
          text={text}
          selection={selection}
          graph={blueprintGraph(text)!}
          findings={[]}
          disabled={false}
          onEdit={() => {}}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      ),
    ).toBe('<aside class="canvas-inspector"><p>The selection is no longer present.</p></aside>');
});
