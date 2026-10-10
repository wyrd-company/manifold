// ---
// relationships:
//   implements: [operator-console, blueprint-loader]
// ---
import { implementationContracts } from "./implementation-contracts.ts";
export type ImplementationKind = "actor" | "action" | "guard" | "delay";
export interface ImplementationEntry {
  readonly name: string;
  readonly kind: ImplementationKind;
  readonly group: string;
  readonly description: string;
  readonly raises?: readonly string[];
  readonly input?: object | boolean;
  readonly output?: object | boolean;
  readonly params?: object;
}
export const manifoldImplementationCatalog: readonly ImplementationEntry[] = [
  {
    name: "github-card-move",
    kind: "actor",
    group: "GitHub",
    description: "Move the task card to a declared lifecycle option.",
    ...implementationContracts["github-card-move"],
  },
  {
    name: "github-task-field-set",
    kind: "actor",
    group: "GitHub",
    description: "Set or clear a declared task field value.",
    ...implementationContracts["github-task-field-set"],
  },
  {
    name: "escalate",
    kind: "actor",
    group: "People",
    description: "Ask a person a question and wait for the first answer.",
    ...implementationContracts["escalate"],
  },
  {
    name: "t3code-project-create",
    ...implementationContracts["t3code-project-create"],
    kind: "actor",
    group: "Thread",
    description: "Create or recover a project on the selected environment.",
  },
  {
    name: "thread-create",
    ...implementationContracts["thread-create"],
    kind: "actor",
    group: "Thread",
    description: "Create or recover a durable thread for the task.",
  },
  {
    name: "turn-prepare",
    ...implementationContracts["turn-prepare"],
    kind: "actor",
    group: "Thread",
    description: "Prepare the next turn and its prompt.",
  },
  {
    name: "turn-start",
    ...implementationContracts["turn-start"],
    kind: "actor",
    group: "Thread",
    description: "Start the prepared turn on its environment.",
  },
  {
    name: "send-message",
    kind: "actor",
    group: "Task",
    description: "Send a durable message to another task or thread.",
    ...implementationContracts["send-message"],
  },
  {
    name: "follow-thread",
    kind: "action",
    group: "Thread",
    description: "Follow the thread and route its events to this actor.",
  },
  {
    name: "expression.assign",
    kind: "action",
    group: "Expressions",
    description: "Assign a JSONata expression result to context.",
  },
  {
    name: "expression.guard",
    kind: "guard",
    group: "Expressions",
    description: "Take a transition when its JSONata expression is true.",
  },
];
