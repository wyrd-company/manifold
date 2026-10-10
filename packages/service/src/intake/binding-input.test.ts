// ---
// relationships:
//   verifies: intake-decision-model
// ---
import { expect, it } from "vite-plus/test";
import { decisionInput, taskInput, json } from "./inputs.ts";
import { issue } from "./test-fixtures/fixture.ts";
const binding = {
  name: "work-board",
  item: "work",
  environment: "workstation",
  t3codeProjects: ["project-1"],
  owner: "example-org",
  number: 1,
  archived: false,
};
it("pins binding facts in the decision and uses that binding in task input", () => {
  const input = decisionInput(
    issue(),
    binding,
    { items: [], ledger: { items: [], allocations: [] }, githubProjects: [], t3codeProjects: [] },
    "P1",
    { Urgency: { state: "set", value: "Normal" } },
  );
  expect(input.task.values).toEqual({ Urgency: { state: "set", value: "Normal" } });
  expect(input.binding).toEqual({
    name: binding.name,
    item: binding.item,
    environment: binding.environment,
    t3codeProjects: ["project-1"],
  });
  expect(
    taskInput(
      issue(),
      {
        project: { nodeId: "P1", owner: "example-org", number: 1 },
        environment: "workstation",
        portfolioItem: "work",
        blueprintPath: "blueprints/task.yml",
        evaluation: json({ input }),
      },
      {},
    ),
  ).toHaveProperty("binding", input.binding);
});
