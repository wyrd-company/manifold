// ---
// relationships:
//   realizes: agent-threads
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ModelSelection } from "@wyrd-company/t3code-client";
import { agentThreadsSchema } from "./input-schema.ts";
import { failure } from "./types.ts";
type RuntimeMode = "approval-required" | "auto-accept-edits" | "auto" | "full-access";
type ProviderInteractionMode = "default" | "plan";
interface Model {
  instanceId: string;
  model: string;
  options?: Readonly<Record<string, string | boolean>>;
}
export interface CreateInput {
  project: string;
  title: string;
  values?: Record<string, unknown>;
  model: Model;
  runtimeMode: RuntimeMode;
  interactionMode?: ProviderInteractionMode;
  branch?: string | null;
  worktreePath?: string | null;
}
export interface TurnInput {
  threadId: string;
  messageId: string;
  prompt: string;
  values?: Record<string, unknown>;
  model?: Model;
  runtimeMode?: RuntimeMode;
  interactionMode?: ProviderInteractionMode;
}
const ajv = new Ajv2020({ strict: false }).addSchema(agentThreadsSchema);
const create = ajv.compile<CreateInput>({
  $ref: `${agentThreadsSchema.$id}#/$defs/thread-create-input`,
});
const turn = ajv.compile<TurnInput>({ $ref: `${agentThreadsSchema.$id}#/$defs/turn-start-input` });
export function createInput(input: unknown) {
  if (!create(input)) throw failure("input", ajv.errorsText(create.errors));
  return input;
}
export function turnInput(input: unknown) {
  if (!turn(input)) throw failure("input", ajv.errorsText(turn.errors));
  return input;
}
export function modelSelection(model: Model): ModelSelection {
  return {
    instanceId: model.instanceId.trim() as ModelSelection["instanceId"],
    model: model.model.trim(),
    ...(model.options
      ? {
          options: Object.entries(model.options).map(([key, value]) => ({
            id: key.trim(),
            value: typeof value === "string" ? value.trim() : value,
          })),
        }
      : {}),
  };
}
