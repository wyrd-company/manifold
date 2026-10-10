// ---
// relationships:
//   implements: usage-intake
// ---
export function attribute(input: {
  environment: string;
  provider: string;
  session: string;
  thread?: string;
  actor?: string;
  actorItem?: string;
  projectItem?: string;
  visit?: number;
}): { actor: string; item: string; visit: number | null } {
  return {
    actor:
      input.actor ??
      (input.thread
        ? `thread:${input.environment}:${input.thread}`
        : `session:${input.environment}:${input.provider}:${input.session}`),
    item: input.actorItem ?? input.projectItem ?? "other",
    visit: input.visit ?? null,
  };
}
