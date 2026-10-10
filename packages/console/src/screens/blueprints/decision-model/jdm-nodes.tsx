// ---
// relationships:
//   implements: [operator-console, decision-models]
// ---
import {
  createJdmNode,
  DecisionTable,
  GraphNode,
  useDecisionGraphState,
  useDecisionGraphActions,
} from "@gorules/jdm-editor";
import type {
  DecisionTableType,
  DecisionTableProps,
  MinimalNodeProps,
  MinimalNodeSpecification,
  CustomNodeSpecification,
  NodeSpecification,
} from "@gorules/jdm-editor";
import { useRef, useState, useCallback } from "react";
import { Handle, Position } from "reactflow";
import { Button } from "../../../ui/button.tsx";
import { JsonataCell } from "./JsonataCell.tsx";
type Config = DecisionTableType & {
  expression?: string;
  statements?: { id: string; condition: string }[];
  passThrough?: boolean;
  inputField?: string;
  outputPath?: string;
  executionMode?: string;
};
function useNode(id: string) {
  const node = useDecisionGraphState((s) => s.decisionGraph.nodes.find((n) => n.id === id)!);
  const disabled = useDecisionGraphState((s) => !!s.disabled);
  const actions = useDecisionGraphActions();
  const content = node.content as { kind: string; config: Config };
  const set = (config: Partial<Config>) =>
    actions.updateNode(id, (n) => {
      n.content = { ...content, config: { ...content.config, ...config } };
      return n;
    });
  return { node, content, config: content.config, set, disabled, actions };
}
function TableTab({ id }: { id: string }) {
  const { config, set, disabled } = useNode(id);
  const epoch = useRef(0);
  const [tableEpoch, setTableEpoch] = useState(0);
  const structural = (value: Partial<Config>) => {
    epoch.current++;
    setTableEpoch(epoch.current);
    set(value);
  };
  const addColumn = (kind: "inputs" | "outputs") =>
    structural({
      [kind]: [
        ...config[kind],
        {
          id: crypto.randomUUID(),
          name: `${kind === "inputs" ? "Input" : "Output"} ${config[kind].length + 1}`,
          field: "",
        },
      ],
    });
  const cellRenderer = useCallback<NonNullable<DecisionTableProps["cellRenderer"]>>(
    ({ value, onChange, column, disabled }) =>
      column ? (
        <JsonataCell
          output={column.colType === "output"}
          rule
          label={`${column.name} JSONata`}
          value={value ?? ""}
          onChange={(value, index) => {
            onChange(value);
            if (index !== undefined)
              set({
                rules: config.rules.map((row, i) =>
                  i === index ? { ...row, [column.id]: value } : row,
                ),
              });
          }}
          disabled={!!disabled}
        />
      ) : undefined,
    [config.rules, set],
  );
  return (
    <>
      <div className="model-table-toolbar">
        <label>
          Hit policy{" "}
          <select
            disabled={!!disabled}
            value={config.hitPolicy}
            onChange={(e) => set({ hitPolicy: e.target.value as "first" | "collect" })}
          >
            <option>first</option>
            <option>collect</option>
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!!disabled}
          onClick={() =>
            structural({
              rules: [
                ...config.rules,
                {
                  _id: crypto.randomUUID(),
                  ...Object.fromEntries(
                    [...config.inputs, ...config.outputs].map((c) => [c.id, ""]),
                  ),
                },
              ],
            })
          }
        >
          Add rule
        </Button>
        <Button variant="outline" disabled={!!disabled} onClick={() => addColumn("inputs")}>
          Add input
        </Button>
        <Button variant="outline" disabled={!!disabled} onClick={() => addColumn("outputs")}>
          Add output
        </Button>
      </div>
      <DecisionTable
        key={tableEpoch}
        value={config}
        disabled={!!disabled}
        tableHeight={470}
        disableHitPolicy
        onChange={(value) => {
          if (epoch.current === tableEpoch) set(value);
        }}
        cellRenderer={cellRenderer}
      />
    </>
  );
}
function ExpressionTab({ id }: { id: string }) {
  const { config, set, disabled } = useNode(id);
  return (
    <JsonataCell
      label="JSONata expression"
      value={config.expression ?? ""}
      onChange={(expression) => set({ expression })}
      lines={8}
      disabled={!!disabled}
    />
  );
}
function CustomCard(props: MinimalNodeProps & { specification: MinimalNodeSpecification }) {
  const { config, set, disabled, content, actions } = useNode(props.id);
  if (content.kind === "jsonataSwitch") return <SwitchCard {...props} />;
  if (!["jsonataDecisionTable", "jsonataExpression"].includes(content.kind))
    return (
      <GraphNode {...props}>
        <p>Unsupported node · edit in YAML</p>
      </GraphNode>
    );
  return (
    <GraphNode
      id={props.id}
      specification={props.specification}
      name={props.data.name}
      isSelected={props.selected}
      actions={[
        <Button key="edit" variant="ghost" onClick={() => actions.openTab(props.id)}>
          {content.kind === "jsonataDecisionTable" ? "Edit table" : "Edit expression"}
        </Button>,
      ]}
    >
      <div className="model-settings nodrag">
        <label>
          <input
            type="checkbox"
            disabled={!!disabled}
            checked={config.passThrough ?? false}
            onChange={(e) => set({ passThrough: e.target.checked })}
          />
          Pass through
        </label>
        <label>
          Input field
          <JsonataCell
            label="Input field"
            value={config.inputField ?? ""}
            onChange={(inputField) => set({ inputField })}
            disabled={!!disabled}
          />
        </label>
        <label>
          Output path
          <JsonataCell
            label="Output path"
            value={config.outputPath ?? ""}
            onChange={(outputPath) => set({ outputPath })}
            disabled={!!disabled}
          />
        </label>
        <label>
          <input
            type="checkbox"
            disabled={!!disabled}
            checked={config.executionMode === "loop"}
            onChange={(e) => set({ executionMode: e.target.checked ? "loop" : "single" })}
          />
          Loop
        </label>
      </div>
    </GraphNode>
  );
}
function SwitchCard(props: MinimalNodeProps & { specification: MinimalNodeSpecification }) {
  const { config, set, disabled, actions } = useNode(props.id);
  const edges = useDecisionGraphState((state) => state.decisionGraph.edges);
  const statements = config.statements ?? [];
  return (
    <GraphNode
      id={props.id}
      specification={props.specification}
      name={props.data.name}
      isSelected={props.selected}
      handleRight={false}
    >
      <div className="model-switch nodrag">
        <select
          aria-label="Switch hit policy"
          disabled={!!disabled}
          value={config.hitPolicy}
          onChange={(e) => set({ hitPolicy: e.target.value as "first" | "collect" })}
        >
          <option>first</option>
          <option>collect</option>
        </select>
        {statements.map((s, index) => (
          <div className="model-switch-row" key={s.id}>
            {!s.condition ? <span className="muted">Default</span> : null}
            <JsonataCell
              label={s.condition ? `Condition ${index + 1}` : "Default"}
              disabled={!!disabled}
              value={s.condition}
              onChange={(condition) =>
                set({
                  statements: statements.map((row) =>
                    row.id === s.id ? { ...row, condition } : row,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              disabled={!!disabled}
              aria-label={`Remove statement ${index + 1}`}
              onClick={() => {
                set({
                  statements: statements.filter((row) => row.id !== s.id),
                });
                actions.removeEdges(
                  edges
                    .filter((edge) => edge.sourceId === props.id && edge.sourceHandle === s.id)
                    .map((edge) => edge.id),
                );
              }}
            >
              ×
            </Button>
            <Handle type="source" position={Position.Right} id={s.id} isConnectable={!disabled} />
          </div>
        ))}
        <Button
          variant="outline"
          disabled={!!disabled}
          onClick={() =>
            set({
              statements: [...statements, { id: crypto.randomUUID(), condition: "" }],
            })
          }
        >
          Add statement
        </Button>
      </div>
    </GraphNode>
  );
}
export const customNodes: CustomNodeSpecification<object, string>[] = [
  "jsonataDecisionTable",
  "jsonataExpression",
  "jsonataSwitch",
].map((kind) => ({
  ...createJdmNode({
    kind,
    displayName:
      kind === "jsonataDecisionTable"
        ? "JSONata decision table"
        : kind === "jsonataExpression"
          ? "JSONata expression"
          : "JSONata switch",
    color: "var(--primary)",
  }),
  renderNode: CustomCard,
  renderTab:
    kind === "jsonataDecisionTable"
      ? (props) => <TableTab {...props} />
      : kind === "jsonataExpression"
        ? (props) => <ExpressionTab {...props} />
        : () => null,
}));
function CustomTab({ id }: { id: string }) {
  const kind = useDecisionGraphState(
    (s) =>
      (
        s.decisionGraph.nodes.find((n) => n.id === id)?.content as {
          kind?: string;
        }
      )?.kind,
  );
  return kind === "jsonataDecisionTable" ? (
    <TableTab id={id} />
  ) : kind === "jsonataExpression" ? (
    <ExpressionTab id={id} />
  ) : null;
}
// The editor resolves tabs through components; customNodes supplies its palette and cards.
export const components: NodeSpecification[] = [
  {
    type: "customNode",
    displayName: "JSONata",
    generateNode: () => ({ name: "JSONata", content: {} }),
    renderNode: CustomCard,
    renderTab: (props) => <CustomTab {...props} />,
  },
];
