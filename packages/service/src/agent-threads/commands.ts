// ---
// relationships:
//   implements: agent-threads
// ---
import { commandId, threadId, projectId, messageId } from "@wyrd-company/t3code-client";
import type {
  ClientOrchestrationCommand,
  OrchestrationThreadShell,
} from "@wyrd-company/t3code-client";
import type { CreateInput, TurnInput } from "./inputs.ts";
import type { Invocation } from "./types.ts";
import { modelSelection } from "./inputs.ts";
import { derivedId } from "./ids.ts";
type CreateCommand = Extract<ClientOrchestrationCommand, { type: "thread.create" }>;
type TurnCommand = Extract<ClientOrchestrationCommand, { type: "thread.turn.start" }>;
export function createCommand(
  input: CreateInput,
  invocation: Invocation,
  title: string,
  createdAt: string,
): CreateCommand {
  const parts = [invocation.actorId, invocation.invokeId, invocation.entryId];
  return {
    type: "thread.create",
    commandId: commandId(derivedId("thread-create/command", ...parts)),
    threadId: threadId(derivedId("thread-create/thread", ...parts)),
    projectId: projectId(input.project.trim()),
    title,
    modelSelection: modelSelection(input.model),
    runtimeMode: input.runtimeMode ?? "full-access",
    interactionMode: input.interactionMode ?? "default",
    branch: input.branch?.trim() ?? null,
    worktreePath: input.worktreePath?.trim() ?? null,
    createdAt,
  };
}
export function turnCommand(
  input: TurnInput,
  text: string,
  current: OrchestrationThreadShell | undefined,
  createdAt: string,
): TurnCommand {
  return {
    type: "thread.turn.start",
    commandId: commandId(derivedId("turn-start/command", input.messageId.trim())),
    threadId: threadId(input.threadId.trim()),
    message: { messageId: messageId(input.messageId.trim()), role: "user", text, attachments: [] },
    ...(input.model ? { modelSelection: modelSelection(input.model) } : {}),
    runtimeMode: (input.runtimeMode ?? current!.runtimeMode) as TurnCommand["runtimeMode"],
    interactionMode: (input.interactionMode ??
      current!.interactionMode) as TurnCommand["interactionMode"],
    createdAt,
  };
}
