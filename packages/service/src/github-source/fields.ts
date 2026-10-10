// ---
// relationships:
//   implements: github-event-source
//   references: github-source-database-schema
// ---
import type {
  ProjectField,
  ProjectFieldOption,
  ProjectFieldOptionColor,
  ProjectFieldOptionWrite,
  ProjectFieldWrite,
} from "./types.ts";

export const fieldOptionColors: readonly ProjectFieldOptionColor[] = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
];

/** A `github_project_field` row as the mirror holds it. */
export interface ProjectFieldRow {
  readonly projectNodeId: string;
  readonly fieldNodeId: string;
  readonly position: number;
  readonly name: string;
  readonly type: ProjectField["type"];
  readonly options: readonly ProjectFieldOption[];
}

/** The rows to write and the field node ids to delete, from an observed field list and the mirror's rows. */
export function fieldChanges(
  projectNodeId: string,
  observed: readonly ProjectField[],
  existing: readonly ProjectFieldRow[],
): { readonly rows: readonly ProjectFieldRow[]; readonly deletes: readonly string[] } {
  const rows = observed.map((field, position): ProjectFieldRow => ({
    projectNodeId,
    fieldNodeId: field.nodeId,
    position,
    name: field.name,
    type: field.type,
    options: field.options,
  }));
  const kept = new Set(observed.map((field) => field.nodeId));
  const deletes = existing
    .filter((row) => !kept.has(row.fieldNodeId))
    .map((row) => row.fieldNodeId);
  return { rows, deletes };
}

/** A mirror row as the public `ProjectField`, in the order the rows list them. */
export function rowsToFields(rows: readonly ProjectFieldRow[]): ProjectField[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      nodeId: row.fieldNodeId,
      name: row.name,
      type: row.type,
      options: row.options,
    }));
}

function optionInput(option: ProjectFieldOptionWrite) {
  return {
    ...(option.id === undefined ? {} : { id: option.id }),
    name: option.name,
    color: option.color.toUpperCase(),
    description: option.description,
  };
}

/** The named mutation and its variables for a field write. */
export function fieldWriteMutation(write: ProjectFieldWrite): {
  readonly operation: "create" | "update" | "delete";
  readonly variables: Record<string, unknown>;
} {
  if (write.kind === "create")
    return {
      operation: "create",
      variables: {
        project: write.projectNodeId,
        type: write.type.toUpperCase().replace("-", "_"),
        name: write.name,
        options: write.options ? write.options.map(optionInput) : null,
      },
    };
  if (write.kind === "update")
    return {
      operation: "update",
      variables: {
        field: write.fieldNodeId,
        name: write.name ?? null,
        options: write.options ? write.options.map(optionInput) : null,
      },
    };
  return { operation: "delete", variables: { field: write.fieldNodeId } };
}
