// ---
// relationships:
//   verifies: github-event-source
// ---
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { createHmac } from "node:crypto";
export function signedDelivery(
  event: string,
  payload: unknown,
  id = "delivery-one",
  hook = "1",
  secret = "synthetic-secret",
) {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    body,
    headers: {
      "X-GitHub-Delivery": id,
      "X-GitHub-Event": event,
      "X-GitHub-Hook-ID": hook,
      "X-Hub-Signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    },
  };
}
export class FakeClock {
  time = Date.parse("2026-01-01T00:00:00Z");
  timers = new Set<{ at: number; wake: () => void }>();
  now = () => this.time;
  setTimer = (delay: number, wake: () => void) => {
    const timer = { at: this.time + delay, wake };
    this.timers.add(timer);
    return () => this.timers.delete(timer);
  };
  advance(ms: number) {
    this.time += ms;
    for (const timer of this.timers)
      if (timer.at <= this.time) {
        this.timers.delete(timer);
        timer.wake();
      }
  }
}
const connection = <T>(nodes: T[]) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null as string | null },
});
export interface ModelIssue {
  title?: string;
  url?: string;
  id: string;
  number: number;
  state: string;
  stateReason: string | null;
  repository: { nameWithOwner: string };
}
export interface ModelItem {
  id: string;
  type: string;
  isArchived: boolean;
  project: { id: string };
  content: { id: string } | ModelIssue;
  fieldValues: ReturnType<typeof connection<Record<string, unknown>>>;
}
export async function githubFake() {
  const issues = new Map<string, ModelIssue>();
  for (const [id, number] of ["I_A", "I_B", "I_C", "I_X", "I_D"].map(
    (id, index) => [id, index + 1] as const,
  ))
    issues.set(id, {
      id,
      number,
      state: "OPEN",
      stateReason: null,
      repository: { nameWithOwner: id === "I_X" ? "external/records" : "sample/records" },
    });
  const items = new Map<string, ModelItem>();
  const dependencies: [string, string][] = [];
  const subIssues: [string, string][] = [];
  const project = { id: "P_one", number: 1, owner: { login: "sample" }, closed: false };
  const authorizations: (string | undefined)[] = [];
  const log: { operation: string; variables: Record<string, unknown> }[] = [];
  const queryLog: string[] = [];
  const deliveries: {
    id: number;
    guid: string;
    delivered_at: string;
    status_code: number;
    event: string;
    payload: unknown;
  }[] = [];
  const redeliveries: number[] = [];
  const deliveryRequests: URL[] = [];
  let deliveryPagination: "normal" | "repeated" = "normal";
  let target: string | undefined;
  let failure = 0;
  let writeFailure: { type: string; status?: number } | undefined;
  let queryFailure: { operation: string; type: string } | undefined;
  const laggingItems = new Map<string, ModelItem>();
  const fields = [
    {
      id: "F_stage",
      name: "Stage",
      options: [
        { id: "O_sorting", name: "Sorting" },
        { id: "O_packed", name: "Packed" },
        { id: "O_shipped", name: "Shipped" },
      ],
    },
  ];
  let paginateItem: string | undefined;
  let held: { operation: string; entered: () => void; released: Promise<void> } | undefined;
  let paginate: string | undefined;
  const rawIssue = (id: string) => {
    const ref = issues.get(id);
    if (!ref) return null;
    return {
      ...ref,
      parent: issues.get(subIssues.find(([, child]) => child === id)?.[0] ?? "") ?? null,
      blockedBy: connection(
        dependencies
          .filter(([blocked]) => blocked === id)
          .map(([, blocking]) => issues.get(blocking)!),
      ),
      blocking: connection(
        dependencies
          .filter(([, blocking]) => blocking === id)
          .map(([blocked]) => issues.get(blocked)!),
      ),
      subIssues: connection(
        subIssues.filter(([parent]) => parent === id).map(([, child]) => issues.get(child)!),
      ),
    };
  };
  const rawItem = (id: string) => {
    const value = laggingItems.get(id) ?? items.get(id);
    if (!value) return null;
    const raw = {
      ...value,
      content: value.type === "ISSUE" ? issues.get(value.content.id) : value.content,
    };
    if (paginateItem === id)
      raw.fieldValues = {
        nodes: raw.fieldValues.nodes.slice(0, 1),
        pageInfo: { hasNextPage: true, endCursor: "next" },
      };
    return raw;
  };
  const server = createServer(async (req, res) => {
    authorizations.push(req.headers.authorization);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname === "/graphql") {
      const input = JSON.parse(body) as { query: string; variables: Record<string, unknown> };
      if (/since|updatedAt|updated_at/.test(input.query)) {
        res.writeHead(400).end();
        return;
      }
      queryLog.push(input.query);
      const operation = /(?:query|mutation)\s+(\w+)/.exec(input.query)![1]!;
      log.push({ operation, variables: input.variables });
      if (held?.operation === operation) {
        const current = held;
        held = undefined;
        current.entered();
        await current.released;
      }
      if (failure) {
        res
          .writeHead(failure, { "content-type": "application/json" })
          .end(JSON.stringify({ message: "synthetic failure" }));
        failure = 0;
        return;
      }
      if (queryFailure?.operation === operation) {
        const fault = queryFailure;
        queryFailure = undefined;
        res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            data: { node: null },
            errors: [{ type: fault.type, path: ["node"], message: "synthetic missing node" }],
          }),
        );
        return;
      }
      let data: unknown;
      switch (operation) {
        case "GitHubProjectField":
          data = {
            node: { field: fields.find((f) => f.name === input.variables["name"]) ?? null },
          };
          break;
        case "GitHubCardMove": {
          if (writeFailure) {
            const failure = writeFailure;
            writeFailure = undefined;
            if (failure.status)
              res
                .writeHead(failure.status, { "content-type": "application/json" })
                .end(JSON.stringify({ message: "synthetic refusal" }));
            else
              res.writeHead(200, { "content-type": "application/json" }).end(
                JSON.stringify({
                  data: { updateProjectV2ItemFieldValue: null },
                  errors: [
                    {
                      type: failure.type,
                      path: ["updateProjectV2ItemFieldValue"],
                      message: "synthetic refusal",
                    },
                  ],
                }),
              );
            return;
          }
          const item = items.get(input.variables["item"] as string);
          const field = fields.find((f) => f.id === input.variables["field"])!;
          const option = field.options.find((o) => o.id === input.variables["option"])!;
          if (!item) {
            res.writeHead(200, { "content-type": "application/json" }).end(
              JSON.stringify({
                errors: [
                  {
                    type: "NOT_FOUND",
                    message: "synthetic missing item",
                    path: ["updateProjectV2ItemFieldValue"],
                  },
                ],
              }),
            );
            return;
          }
          const value = {
            field: { id: field.id, name: field.name, dataType: "SINGLE_SELECT" },
            optionId: option.id,
            name: option.name,
          };
          item.fieldValues.nodes = [
            ...item.fieldValues.nodes.filter((v) => (v["field"] as { id: string }).id !== field.id),
            value,
          ];
          data = { updateProjectV2ItemFieldValue: { projectV2Item: { id: item.id } } };
          break;
        }
        case "GitHubProjectByNumber":
          data = { repositoryOwner: { projectV2: project } };
          break;
        case "GitHubProject":
          data = {
            node: {
              ...project,
              items: connection(
                [...items.values()]
                  .filter((item) => !item.isArchived)
                  .map((item) => rawItem(item.id)),
              ),
            },
          };
          break;
        case "GitHubItems":
          data = { nodes: (input.variables["ids"] as string[]).map(rawItem) };
          break;
        case "GitHubIssues":
          data = {
            nodes: (input.variables["ids"] as string[]).map((id) => {
              const node = rawIssue(id);
              if (node && paginate === id) {
                node.blockedBy = {
                  nodes: node.blockedBy.nodes.slice(0, 1),
                  pageInfo: { hasNextPage: true, endCursor: "next" },
                };
              }
              return node;
            }),
          };
          break;
        case "GitHubConnection":
          data = {
            node: input.query.includes("fieldValues")
              ? {
                  fieldValues: connection(
                    items.get(input.variables["id"] as string)!.fieldValues.nodes.slice(1),
                  ),
                }
              : {
                  blockedBy: connection(
                    rawIssue(input.variables["id"] as string)!.blockedBy.nodes.slice(1),
                  ),
                },
          };
          break;
        default:
          res.writeHead(400).end();
          return;
      }
      const errors =
        operation === "GitHubIssues"
          ? (input.variables["ids"] as string[]).flatMap((id, index) =>
              issues.has(id)
                ? []
                : [
                    {
                      type: "NOT_FOUND",
                      path: ["nodes", index],
                      message: "synthetic missing issue",
                    },
                  ],
            )
          : [];
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ data, ...(errors.length ? { errors } : {}) }));
    } else if (
      /^\/app\/installations\/\d+\/access_tokens$/.test(url.pathname) &&
      req.method === "POST"
    ) {
      req.resume();
      res.writeHead(201, { "content-type": "application/json" }).end(
        JSON.stringify({
          token: "synthetic-token",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          permissions: { contents: "read" },
          repositories: [],
        }),
      );
    } else if (url.pathname.endsWith("/deliveries") && req.method === "GET") {
      log.push({ operation: "GitHubDeliveries", variables: {} });
      if (held?.operation === "GitHubDeliveries") {
        const current = held;
        held = undefined;
        current.entered();
        await current.released;
      }
      deliveryRequests.push(url);
      const cursor = url.searchParams.get("cursor");
      const offset = cursor === "second" ? 100 : 0;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (deliveries.length > offset + 100 || (deliveryPagination === "repeated" && cursor))
        headers["link"] =
          `<http://127.0.0.1:${(server.address() as AddressInfo).port}${url.pathname}?per_page=100&cursor=second>; rel="next"`;
      res.writeHead(200, headers).end(JSON.stringify(deliveries.slice(offset, offset + 100)));
    } else if (url.pathname.endsWith("/attempts") && req.method === "POST") {
      const id = Number(url.pathname.split("/").at(-2));
      log.push({ operation: "GitHubRedeliver", variables: { id } });
      if (held?.operation === "GitHubRedeliver") {
        const current = held;
        held = undefined;
        current.entered();
        await current.released;
      }
      redeliveries.push(id);
      const value = deliveries.find((d) => d.id === id)!;
      if (target) {
        const delivery = signedDelivery(value.event, value.payload, value.guid);
        await fetch(target, { method: "POST", headers: delivery.headers, body: delivery.body });
      }
      res.writeHead(202, { "content-type": "application/json" }).end("{}");
    } else res.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    fields,
    failQuery(operation: string, type: string) {
      queryFailure = { operation, type };
    },
    lagItem(id: string) {
      laggingItems.set(id, structuredClone(items.get(id)!));
    },
    resumeItem(id: string) {
      laggingItems.delete(id);
    },
    failWrite(type: string, status?: number) {
      writeFailure = { type, ...(status === undefined ? {} : { status }) };
    },
    paginateItem(id: string) {
      paginateItem = id;
    },
    issues,
    items,
    dependencies,
    subIssues,
    project,
    log,
    authorizations,
    deliveries,
    redeliveries,
    deliveryRequests,
    repeatDeliveryCursor() {
      deliveryPagination = "repeated";
    },
    queryLog,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    addItem(id: string, issueId: string) {
      items.set(id, {
        id,
        type: "ISSUE",
        isArchived: false,
        project: { id: project.id },
        content: issues.get(issueId)!,
        fieldValues: connection([]),
      });
    },
    setTarget(url: string | undefined) {
      target = url;
    },
    fail(status: number) {
      failure = status;
    },
    paginateIssue(id: string) {
      paginate = id;
    },
    hold(operation: string) {
      let release!: () => void;
      let entered!: () => void;
      const reached = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      held = { operation, entered, released };
      return { reached, release };
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
