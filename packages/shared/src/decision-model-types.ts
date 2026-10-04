// ---
// relationships:
//   realizes: decision-models
// ---
export type DecisionModelLocation = {
  model: string;
  nodeId?: string;
  ruleId?: string;
  columnId?: string;
  statementId?: string;
  location?: string;
};
export type DecisionModelFinding = DecisionModelLocation & {
  severity: "error" | "warning";
  kind:
    | "syntax"
    | "never-boolean"
    | "structure"
    | "node-unsupported"
    | "duplicate-id"
    | "output-field-conflict"
    | "pass-through-needs-object"
    | "loop-needs-input-field"
    | "switch-handle-unknown"
    | "model-missing";
  message: string;
  expression?: string;
  code?: string;
  position?: number;
  instancePath?: string;
};
export type DecisionModelErrorDetail = DecisionModelLocation & {
  kind: "evaluation" | "result" | "engine";
  message: string;
  expression?: string;
  code?: string;
  position?: number;
};
export type DecisionModelTrace = Record<
  string,
  {
    id: string;
    name: string;
    order: number;
    input?: unknown;
    output?: unknown;
    performance?: string;
    traceData?: unknown;
  }
>;
export type DecisionModelEvaluation = {
  model: string;
  input: Record<string, unknown>;
  trace: DecisionModelTrace;
} & (
  | { outcome: "result"; result: unknown }
  | { outcome: "error"; error: DecisionModelErrorDetail }
);
export type DecisionNodeSettings = {
  inputField?: string;
  outputPath?: string;
  executionMode?: "single" | "loop";
  passThrough?: boolean;
};
export type DecisionTableConfig = DecisionNodeSettings & {
  hitPolicy: "first" | "collect";
  inputs: { id: string; name?: string; field?: string }[];
  outputs: { id: string; name?: string; field: string }[];
  rules: ({ _id: string; _description?: string } & Record<string, string | null>)[];
};
export type DecisionExpressionConfig = DecisionNodeSettings & { expression: string };
export type DecisionSwitchConfig = {
  hitPolicy: "first" | "collect";
  statements: { id: string; condition?: string | null }[];
};
export type DecisionCustomContent =
  | { kind: "jsonataDecisionTable"; config: DecisionTableConfig }
  | { kind: "jsonataExpression"; config: DecisionExpressionConfig }
  | { kind: "jsonataSwitch"; config: DecisionSwitchConfig };
export type DecisionModelNode = { id: string; name?: string } & (
  | { type: "inputNode" | "outputNode"; content?: object }
  | { type: "decisionNode"; content: { key: string } }
  | { type: "customNode"; content: DecisionCustomContent }
);
export type DecisionModel = {
  nodes: DecisionModelNode[];
  edges: { id: string; sourceId: string; targetId: string; sourceHandle?: string }[];
};
export const decisionModelLocation = (model: string, ...segments: string[]) =>
  `${model}#/${segments.map((s) => s.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
export const decisionModelBlank = (source: string | null | undefined) =>
  source == null || source.trim() === "";
