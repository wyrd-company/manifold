// ---
// relationships:
//   implements: escalations
//   references: escalation-contract
// ---
import { createHash } from "node:crypto";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  escalationContractSchema,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import { EscalationInputError } from "./types.ts";
import type { EscalateInput, Escalation, EscalationAnswer } from "./types.ts";
const ajv = new Ajv2020({ allErrors: true, useDefaults: true });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(escalationContractSchema);
const validateInput = ajv.compile<EscalateInput>({
  $ref: escalationContractSchema.$id + "#/$defs/escalate-input",
});
const validateAnswer = ajv.compile<EscalationAnswer>({
  $ref: escalationContractSchema.$id + "#/$defs/answer",
});
export const digest = (key: string) => createHash("sha256").update(key).digest();
export const idOf = (parts: readonly unknown[]) =>
  digest(JSON.stringify(parts)).subarray(0, 16).toString("base64url");
export const subjectOf = (subject: Readonly<Record<string, string>>) =>
  JSON.stringify(
    Object.fromEntries(
      Object.keys(subject)
        .sort()
        .map((key) => [key, subject[key]]),
    ),
  );
export function inputOf(input: EscalateInput) {
  const value: unknown = structuredClone(input);
  if (!validateInput(value))
    throw new EscalationInputError(
      (validateInput.errors ?? []).map((e) => `${e.instancePath}: ${e.message}`),
    );
  if (new Set(value.choices!.map((c) => c.id)).size !== value.choices!.length)
    throw new EscalationInputError(["Choice ids must be unique"]);
  return {
    question: value.question,
    title: value.title!,
    choices: value.choices!,
    freeText: value.freeText!,
    destinations: value.destinations!,
  };
}
export function invalidAnswer(escalation: Escalation, answer: unknown): string | undefined {
  if (!validateAnswer(answer)) return "Expected one choice or text of 1 to 4096 characters";
  if ("choice" in answer && !escalation.choices.some((c) => c.id === answer.choice))
    return "Unknown choice";
  if ("text" in answer && !escalation.freeText) return "Text is not allowed";
  return undefined;
}
export function boundMessage(value: string, suffix = "…"): string {
  if (Buffer.byteLength(value) <= 4096) return value;
  let bytes = 0;
  let result = "";
  const limit = 4096 - Buffer.byteLength(suffix);
  for (const char of value) {
    bytes += Buffer.byteLength(char);
    if (bytes > limit) break;
    result += char;
  }
  return result + suffix;
}
export function askMessage(
  escalation: Escalation,
  key: string,
  publicUrl: string,
  priority: number,
) {
  const base = publicUrl.replace(/\/$/, "") + "/escalations/" + escalation.id;
  const click = base + "?key=" + key;
  const actions: Record<string, unknown>[] = escalation.choices.map((choice) => ({
    action: "http",
    label: choice.label,
    url: base + "/answer",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key, choice: choice.id }).toString(),
    clear: true,
  }));
  if (escalation.freeText && actions.length < 3)
    actions.push({ action: "view", label: "Answer…", url: click });
  return {
    title: escalation.title,
    message: boundMessage(
      escalation.question,
      "…\nOpen the notification to read the whole question and answer.",
    ),
    markdown: true,
    priority,
    tags: ["question"],
    click,
    actions,
  };
}
export function closeMessage(escalation: Escalation) {
  const answer = escalation.answer;
  const answerValue = answer?.value;
  const value =
    answerValue &&
    ("text" in answerValue
      ? answerValue.text
      : escalation.choices.find((c) => c.id === answerValue.choice)!.label);
  return {
    title: escalation.title,
    message: boundMessage(answer ? `Answered: ${value} (${answer.channel})` : "Withdrawn"),
    markdown: true,
    priority: 1,
    tags: [answer ? "white_check_mark" : "heavy_multiplication_x"],
  };
}
