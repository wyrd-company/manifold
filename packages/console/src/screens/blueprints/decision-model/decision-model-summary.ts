// ---
// relationships:
//   implements: operator-console
// ---
import { parse } from "yaml";
const object = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
export function modelSummary(text: string) {
  try {
    const model = object(parse(text));
    if (!Array.isArray(model["nodes"])) return;
    const tables = model["nodes"].flatMap((value) => {
      const node = object(value),
        content = object(node["content"]),
        config = object(content["config"]);
      if (node["type"] !== "customNode" || content["kind"] !== "jsonataDecisionTable") return [];
      return [
        {
          id: String(node["id"]),
          name: String(node["name"] ?? node["id"]),
          hitPolicy: String(config["hitPolicy"] ?? "first"),
          rules: Array.isArray(config["rules"]) ? config["rules"].length : 0,
          inputs: Array.isArray(config["inputs"])
            ? config["inputs"].map((c) => String(object(c)["name"] ?? object(c)["field"] ?? ""))
            : [],
        },
      ];
    });
    return { nodes: model["nodes"].length, tables };
  } catch {
    return undefined;
  }
}
