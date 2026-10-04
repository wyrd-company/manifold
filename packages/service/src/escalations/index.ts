// ---
// relationships:
//   implements: escalations
// ---
export { openEscalations, heldActorHandler } from "./escalations.ts";
export { EscalationInputError } from "./types.ts";
export type {
  Escalations,
  EscalationsOptions,
  EscalationSave,
  EscalateInput,
  Escalation,
  EscalationAnswer,
  EscalationChannel,
  EscalationChoice,
  EscalationStatus,
  EscalationSubject,
  ServiceEscalationKind,
  ServiceEscalationRequest,
  ServiceEscalationHandler,
  AnswerOutcome,
  Invocation,
} from "./types.ts";
export { mountEscalations, escalationImplementations } from "./assembly.ts";
