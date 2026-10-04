// ---
// relationships:
//   implements: intake-decision-model
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import { githubEventsSchema, intakeDecisionModelSchema } from "@wyrd-company/manifold-shared";
import type { PortfolioDeclaration } from "@wyrd-company/manifold-shared";
import type { LoadedBlueprint, RevisionLoad } from "../blueprint-loader/index.ts";
import type { IntakeFailure } from "./types.ts";
import { descendant, json } from "./inputs.ts";
import type { Binding } from "./inputs.ts";
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addSchema(githubEventsSchema);
ajv.addSchema(intakeDecisionModelSchema);
interface Output {
  blueprint: string;
  portfolioItem?: string;
  data?: Record<string, unknown>;
}
const validate = ajv.compile<Output>({
  $ref: intakeDecisionModelSchema.$id + "#/$defs/decision-output",
});
export const failure = (kind: IntakeFailure["kind"], detail: unknown): IntakeFailure => ({
  kind,
  message: `Intake failed: ${kind}`,
  detail: json(detail),
});
export function decide(
  result: unknown,
  binding: Binding,
  declaration: PortfolioDeclaration,
  blueprints: RevisionLoad,
): { blueprint: LoadedBlueprint; item: string; data: Record<string, unknown> } | IntakeFailure {
  if (!validate(result))
    return failure("output", {
      errors: (validate.errors ?? []).map((e) => ({
        instancePath: e.instancePath,
        message: e.message ?? "Invalid output",
      })),
    });
  const blueprint = blueprints.blueprints.get(result.blueprint);
  if (!blueprint)
    return failure("blueprint-unloaded", {
      path: result.blueprint,
      findings: blueprints.failures.get(result.blueprint) ?? [],
    });
  const id = result.portfolioItem ?? binding.item;
  const item = declaration.items.find((i) => i.id === id);
  if (!item) return failure("item-unknown", { item: id });
  if (item.archived) return failure("item-archived", { item: id });
  if (!descendant(declaration.items, id, binding.item))
    return failure("item-outside-binding", {
      item: id,
      binding: binding.name,
      bindingItem: binding.item,
    });
  return {
    blueprint,
    item: declaration.items.some((i) => i.parent === id) ? id + "/other" : id,
    data: result.data ?? {},
  };
}
const inputValidators = new WeakMap<LoadedBlueprint, ReturnType<typeof ajv.compile>>();
export function inputErrors(blueprint: LoadedBlueprint, input: unknown) {
  let validator = inputValidators.get(blueprint);
  if (!validator) {
    const schema = blueprint.document.schemas.input ?? true;
    validator = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile(
      schema,
    );
    inputValidators.set(blueprint, validator);
  }
  return validator(input)
    ? undefined
    : (validator.errors ?? []).map((e) => ({
        instancePath: e.instancePath,
        message: e.message ?? "Invalid input",
      }));
}
