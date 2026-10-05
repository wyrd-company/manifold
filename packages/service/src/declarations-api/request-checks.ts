// ---
// relationships:
//   implements: declarations-api
// ---
import type {
  BindingEdit,
  TaskFieldEdit,
  SaveFields,
} from "@wyrd-company/manifold-shared/declarations-api";
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const validPath = (
  value: unknown,
): value is "bindings.yml" | "task-metadata.yml" | "portfolio.yml" =>
  value === "bindings.yml" || value === "task-metadata.yml" || value === "portfolio.yml";
const keys = (value: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(value).every((key) => names.includes(key));
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value["every"]((item) => typeof item === "string");
const name = (value: unknown) =>
  typeof value === "string" && value["length"] <= 64 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value);
export function saveFields(
  value: Record<string, unknown>,
): value is Record<string, unknown> & SaveFields {
  return (
    typeof value["base"] === "string" &&
    /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value["base"]) &&
    typeof value["saveId"] === "string" &&
    /^[a-f0-9]{32}$/.test(value["saveId"]) &&
    typeof value["message"] === "string" &&
    value["message"].length <= 4096 &&
    value["message"].trim().length > 0
  );
}
export function bindingEdit(value: unknown): value is BindingEdit {
  if (
    !record(value) ||
    typeof value["mode"] !== "string" ||
    !["add", "replace"].includes(value["mode"]) ||
    !name(value["name"]) ||
    !name(value["environment"]) ||
    typeof value["item"] !== "string"
  )
    return false;
  if (value["kind"] === "github-project")
    return (
      keys(value, [
        "kind",
        "mode",
        "name",
        "owner",
        "number",
        "environment",
        "item",
        "t3codeProjects",
      ]) &&
      typeof value["owner"] === "string" &&
      value["owner"].length > 0 &&
      typeof value["number"] === "number" &&
      Number.isSafeInteger(value["number"]) &&
      value["number"] > 0 &&
      strings(value["t3codeProjects"]) &&
      value["t3codeProjects"].every((project) => project.length > 0)
    );
  return (
    value["kind"] === "t3code-project" &&
    keys(value, ["kind", "mode", "name", "environment", "project", "item"]) &&
    typeof value["project"] === "string" &&
    value["project"].length > 0
  );
}
export function taskFieldEdit(value: unknown): value is TaskFieldEdit {
  if (!record(value)) return false;
  if (value["kind"] === "add-field")
    return keys(value, ["kind", "binding"]) && typeof value["binding"] === "string";
  if (typeof value["location"] !== "string") return false;
  if (value["kind"] === "remove-field") return keys(value, ["kind", "location"]);
  if (
    value["kind"] !== "set-field" ||
    !keys(value, ["kind", "location", "values"]) ||
    !record(value["values"])
  )
    return false;
  const v = value["values"];
  return (
    keys(v, ["name", "type", "storage", "settings", "options", "whenChanged"]) &&
    (!("name" in v) || typeof v["name"] === "string") &&
    (!("type" in v) ||
      (typeof v["type"] === "string" &&
        ["text", "number", "date", "single-select"].includes(v["type"]))) &&
    (!("storage" in v) || v["storage"] === "project-field") &&
    (!("settings" in v) ||
      (record(v["settings"]) &&
        Object.values(v["settings"]).every((item) => typeof item === "string"))) &&
    (!("options" in v) || strings(v["options"])) &&
    (!("whenChanged" in v) || v["whenChanged"] === "revert" || v["whenChanged"] === "accept")
  );
}
export const onlyKeys = keys;
