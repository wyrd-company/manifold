// ---
// relationships:
//   implements: task-metadata
// ---
import type { ManifoldIdentity, TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { Invocation } from "../actor-host/index.ts";
import type { CardMove } from "../github-source/index.ts";
import type { CardMoveErrorKind, CardMoveError } from "./types.ts";
export function cardMoveError(
  kind: CardMoveErrorKind,
  message: string,
  status?: string,
): CardMoveError {
  return { type: "card-move", kind, message, ...(status === undefined ? {} : { status }) };
}
export function cardMove(
  invocation: Invocation,
  identity: ManifoldIdentity,
  binding: string | undefined,
  declaration: TaskMetadataDeclaration | undefined,
  status: string,
): CardMove {
  const lifecycle = binding === undefined ? undefined : declaration?.projects[binding]?.lifecycle;
  if (!lifecycle?.options.includes(status))
    throw cardMoveError(
      "undeclared",
      "Lifecycle option is not declared for the actor's Project",
      status,
    );
  return {
    ...invocation,
    projectNodeId: identity.project!,
    issueNodeId: identity.issue!,
    field: lifecycle.field,
    option: status,
  };
}
