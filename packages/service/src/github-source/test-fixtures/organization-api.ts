// ---
// relationships:
//   verifies: [github-event-source, task-metadata]
// ---
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { githubFake } from "./api.ts";
export async function organizationFake(base: Awaited<ReturnType<typeof githubFake>>) {
  type Option = {
    id: string;
    fullDatabaseId: number;
    name: string;
    color: string;
    description: string;
    priority: number;
  };
  type Field = {
    id: string;
    fullDatabaseId: number;
    name: string;
    dataType: string;
    options: Option[];
  };
  type Type = { id: string; name: string; color: string; description: string; isEnabled: boolean };
  const fields: Field[] = [];
  const types: Type[] = [];
  const values = new Map<string, Map<string, string | number>>();
  const issueTypes = new Map<string, string | null>();
  const log: {
    operation: string;
    input: Record<string, unknown>;
    authorization: string | undefined;
  }[] = [];
  let sequence = 100;
  let held: { reached: () => void; wait: Promise<void> } | undefined;
  let ownerType = "Organization";
  let failure: { operation: string; status: number } | undefined;
  let pageSize = 100;
  let loop = false;
  const page = <T>(items: T[], after?: string) => {
    const offset = after ? Number(after) : 0;
    return {
      nodes: items.slice(offset, offset + pageSize),
      pageInfo: {
        hasNextPage: offset + pageSize < items.length,
        endCursor: loop ? "1" : String(offset + pageSize),
      },
    };
  };
  const server = createServer(async (req, res) => {
    try {
      let body = "";
      for await (const chunk of req) body += String(chunk);
      const raw = body ? JSON.parse(body) : {};
      const operation =
        req.method === "PATCH"
          ? "RESTIssueFieldUpdate"
          : (/(?:query|mutation)\s+(\w+)/.exec(raw.query ?? "")?.[1] ?? "forward");
      const variables = raw.variables ?? raw;
      const input = variables.input ?? variables;
      if (
        operation.startsWith("GitHubOrganization") ||
        operation === "GitHubIssueFieldIds" ||
        operation === "GitHubDeleteIssueField" ||
        operation === "RESTIssueFieldUpdate"
      ) {
        log.push({ operation, input, authorization: req.headers.authorization });
        if (failure?.operation === operation) {
          res.writeHead(failure.status, { "content-type": "application/json" });
          res.end(JSON.stringify({ message: "Synthetic refusal" }));
          return;
        }
        let data: unknown;
        if (operation === "GitHubOrganizationFields")
          data = {
            repositoryOwner:
              ownerType === "Missing"
                ? null
                : {
                    __typename: variables.login === "visitor" ? "User" : ownerType,
                    id: "ORG_one",
                    issueFields: page(fields),
                    issueTypes: page(types),
                  },
          };
        else if (operation === "GitHubOrganizationPage")
          data = {
            organization: raw.query.includes("issueFields(")
              ? { issueFields: page(fields, variables.after) }
              : { issueTypes: page(types, variables.after) },
          };
        else if (operation === "GitHubOrganizationId") data = { organization: { id: "ORG_one" } };
        else if (operation === "GitHubIssueFieldIds")
          data = { node: fields.find((f) => f.id === input.id) ?? null };
        else if (operation === "RESTIssueFieldUpdate") {
          const f = fields.find((f) => f.fullDatabaseId === Number(req.url!.split("/").at(-1)))!;
          if (input.name !== undefined) f.name = input.name;
          if (input.options) {
            const next = (
              input.options as {
                id?: number;
                name: string;
                color: string;
                description: string;
                priority: number;
              }[]
            ).map((o) => {
              const existing = f.options.find((old) => old.fullDatabaseId === o.id);
              const number = existing?.fullDatabaseId ?? ++sequence;
              return {
                ...o,
                id: existing?.id ?? `O_${number}`,
                fullDatabaseId: number,
                color: o.color.toUpperCase(),
              };
            });
            f.options = next;
          }
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(f));
          return;
        } else if (operation === "GitHubOrganizationWrite") {
          if (raw.query.includes("createIssueField(")) {
            const number = ++sequence;
            const f = {
              id: `F_${number}`,
              fullDatabaseId: number,
              name: input.name,
              dataType: input.dataType,
              options: (input.options ?? []).map((o: Omit<Option, "id" | "fullDatabaseId">) => {
                const n = ++sequence;
                return { ...o, id: `O_${n}`, fullDatabaseId: n };
              }),
            };
            fields.push(f);
            data = { createIssueField: { issueField: f } };
          } else if (raw.query.includes("createIssueType(")) {
            const t = {
              id: `T_${++sequence}`,
              name: input.name,
              color: input.color,
              description: input.description,
              isEnabled: input.isEnabled,
            };
            types.push(t);
            data = { createIssueType: { issueType: t } };
          } else {
            const t = types.find((t) => t.id === input.issueTypeId)!;
            for (const key of ["name", "color", "description", "isEnabled"] as const)
              if (input[key] !== undefined) Object.assign(t, { [key]: input[key] });
            data = { updateIssueType: { issueType: t } };
          }
        } else if (operation === "GitHubDeleteIssueField") {
          fields.splice(
            fields.findIndex((f) => f.id === input.fieldId),
            1,
          );
          data = { deleteIssueField: { clientMutationId: null } };
        } else if (operation === "GitHubOrganizationValue") {
          const stored = values.get(input.issueId) ?? new Map<string, string | number>();
          values.set(input.issueId, stored);
          if (raw.query.includes("updateIssueIssueType("))
            issueTypes.set(input.issueId, input.issueTypeId);
          else if (raw.query.includes("deleteIssueFieldValue(")) stored.delete(input.fieldId);
          else
            for (const f of input.issueFields)
              stored.set(
                f.fieldId,
                f.textValue ?? f.numberValue ?? f.dateValue ?? f.singleSelectOptionId,
              );
          data = {
            setIssueFieldValue: { clientMutationId: null },
            deleteIssueFieldValue: { clientMutationId: null },
            updateIssueIssueType: { clientMutationId: null },
          };
        }
        if (operation === "GitHubOrganizationWrite" && held) {
          const active = held;
          held = undefined;
          active.reached();
          await active.wait;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data }));
        return;
      }
      const upstream = await fetch(base.url + req.url, {
        method: req.method ?? "GET",
        headers: {
          "content-type": "application/json",
          authorization: req.headers.authorization ?? "",
        },
        ...(req.method !== "GET" ? { body } : {}),
      });
      const response = await upstream.json();
      if (operation === "GitHubProjectByNumber")
        response.data.repositoryOwner.projectV2.owner.login = variables.login;
      if (operation === "GitHubProjectByNumber" && variables.number === 2)
        response.data.repositoryOwner.projectV2 = {
          ...response.data.repositoryOwner.projectV2,
          id: "P_two",
          number: 2,
        };
      if (operation === "GitHubProject" && variables.id === "P_two")
        response.data.node = {
          ...response.data.node,
          id: "P_two",
          number: 2,
          items: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        };
      if (operation === "GitHubProjectFields" && variables.id === "P_two")
        response.data.node = { ...response.data.node, id: "P_two" };
      if (operation === "GitHubIssues")
        for (const node of response.data.nodes) {
          if (!node) continue;
          node.issueType = types.find((t) => t.id === issueTypes.get(node.id)) ?? null;
          node.issueFieldValues = {
            nodes: [...(values.get(node.id) ?? [])].flatMap(([key, value]) => {
              const f = fields.find((f) => f.id === key);
              if (!f) return [];
              const option = f.options.find((o) => o.id === value);
              return [
                {
                  field: f,
                  ...(f.dataType === "TEXT"
                    ? { text: value }
                    : f.dataType === "NUMBER"
                      ? { number: value }
                      : f.dataType === "DATE"
                        ? { date: value }
                        : { optionId: option?.id, name: option?.name }),
                },
              ];
            }),
            pageInfo: { hasNextPage: false, endCursor: null },
          };
        }
      res.writeHead(upstream.status, { "content-type": "application/json" });
      res.end(JSON.stringify(response));
    } catch {
      res.writeHead(500);
      res.end("fixture failure");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    fields,
    types,
    values,
    issueTypes,
    log,
    holdWrite() {
      let reached!: () => void;
      let release!: () => void;
      const entered = new Promise<void>((r) => {
        reached = r;
      });
      const wait = new Promise<void>((r) => {
        release = r;
      });
      held = { reached, wait };
      return { reached: entered, release };
    },
    owner(value: string) {
      ownerType = value;
    },
    fail(operation: string, status: number) {
      failure = { operation, status };
    },
    clearFailure() {
      failure = undefined;
    },
    paginate(size: number, repeated = false) {
      pageSize = size;
      loop = repeated;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
