// ---
// relationships:
//   implements: live-github-environment
// ---
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { loadSettings, stateDirectory, readCredential } from "./settings.ts";
import { credentialValues, generatedFiles, runReportedSteps } from "./secrets.ts";
import { hasTaskActor, deliveryIssue } from "./smoke-http.ts";
import { smokeSteps } from "./smoke-check.ts";
import { GitHub, installationAccess } from "./github.ts";
import { controlRequest, processStartTime } from "./supervisor.ts";
import type { Resources } from "./provisioning.ts";
type DeliverySummary = { id: number; guid: string; event: string; status_code: number };
type DeliveryDetail = { request: { payload: unknown } };
async function main() {
  const settings = await loadSettings(),
    directory = stateDirectory();
  const github = new GitHub(
    settings.organization,
    await readCredential(settings.credentials.patFile),
  );
  await github.preflight();
  await installationAccess(settings);
  const status = await controlRequest(directory, "status");
  if (
    !status ||
    !("instanceId" in status) ||
    status.stopping ||
    !status.serviceAddress ||
    !status.service
  )
    throw new Error("Live supervisor is not ready");
  const resources = JSON.parse(
    await readFile(resolve(directory, "resources.json"), "utf8"),
  ) as Resources;
  const secrets = await credentialValues(settings, directory);
  const runId = randomUUID();
  const hook = resources.hook.id;
  async function deliveries(issue: string) {
    const summaries: DeliverySummary[] = [];
    for (let page = 1; ; page++) {
      const rows = await github.rest<DeliverySummary[]>(
        "read hook deliveries",
        "GET /orgs/{org}/hooks/{hook_id}/deliveries",
        { org: settings.organization, hook_id: hook, per_page: 100, page },
      );
      summaries.push(...rows);
      if (rows.length < 100) break;
    }
    for (const summary of summaries.filter((row) => row.event === "projects_v2_item")) {
      const detail = await github.rest<DeliveryDetail>(
        "read hook delivery",
        "GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}",
        { org: settings.organization, hook_id: hook, delivery_id: summary.id },
      );
      if (deliveryIssue(detail.request.payload) === issue) return summary;
    }
  }
  const steps = smokeSteps(
    {
      configuration: async () => {
        const config = await readFile(resolve(directory, "service.yml"), "utf8");
        const pat = secrets.find((secret) => secret.name === "PAT")!.value;
        if (config.includes(settings.credentials.patFile) || config.includes(pat))
          throw new Error("Service configuration contains PAT reference");
        if ((await processStartTime(status.service!.pid)) !== status.service!.startTime)
          throw new Error("Service process identity changed");
        const environment = await readFile(`/proc/${status.service!.pid}/environ`);
        if (environment.includes(Buffer.from(pat)))
          throw new Error("Service environment contains PAT");
      },
      createItem: async (step) => {
        const issue = await github.rest<{ node_id: string }>(
          "create smoke issue",
          "POST /repos/{owner}/{repo}/issues",
          {
            owner: settings.organization,
            repo: settings.repository,
            title: `Sample item ${runId} ${step}`,
            body: `<!-- ${settings.marker} -->`,
          },
        );
        await github.graph(
          "add smoke Project item",
          "mutation($project:ID!,$content:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$content}){item{id}}}",
          { project: resources.project.nodeId, content: issue.node_id },
        );
        return issue.node_id;
      },
      delivery: async (issue) => {
        const delivery = await deliveries(issue);
        return delivery
          ? { guid: delivery.guid, accepted: delivery.status_code === 202 }
          : undefined;
      },
      recorded: async (guid) => {
        const db = new DatabaseSync(resolve(directory, "service/manifold.sqlite"), {
          readOnly: true,
        });
        try {
          return !!db
            .prepare("SELECT delivery_id FROM github_delivery WHERE delivery_id = ?")
            .get(guid);
        } finally {
          db.close();
        }
      },
      actor: (issue) => hasTaskActor(status.serviceAddress!, issue),
      setHook: async (active) => {
        await github.rest("set smoke hook active", "PATCH /orgs/{org}/hooks/{hook_id}", {
          org: settings.organization,
          hook_id: hook,
          active,
        });
      },
      hookActive: async () => {
        const value = await github.rest<{ active: boolean }>(
          "read smoke hook",
          "GET /orgs/{org}/hooks/{hook_id}",
          { org: settings.organization, hook_id: hook },
        );
        return value.active;
      },
      hasDelivery: async (issue) => !!(await deliveries(issue)),
      paths: async () => {
        if (!status.tunnelUrl) throw new Error("Tunnel URL unavailable");
        const id = "A".repeat(22);
        const cases: [string, string, boolean][] = [
          ["POST", "/webhooks/github", true],
          ["GET", "/webhooks/github", false],
          ["POST", "/webhooks/github/x", false],
          ["GET", "/api/actors", false],
          ["GET", "/escalations", false],
          ["GET", `/escalations/${id}/answer`, false],
          ["GET", "/", false],
          ["GET", `/escalations/${id}?key=${randomUUID()}`, status.answers],
          ["POST", `/escalations/${id}/answer`, status.answers],
        ];
        for (const [method, path, passed] of cases) {
          const response = await fetch(status.tunnelUrl + path, {
            method,
            ...(method === "POST"
              ? {
                  body: "key=unknown&choice=1",
                  headers: { "content-type": "application/x-www-form-urlencoded" },
                }
              : {}),
            redirect: "manual",
          });
          const refused = response.headers.get("x-live-forwarder") === "refused";
          if (
            passed
              ? refused ||
                !(path === "/webhooks/github" ? [400, 401, 404] : [404]).includes(response.status)
              : !refused || response.status !== 404
          )
            throw new Error(
              `Unexpected tunnel response: ${method} ${path.split("?")[0]} (${response.status})`,
            );
          await response.arrayBuffer();
        }
      },
      wait: async (probe, limit) => {
        const until = Date.now() + limit;
        while (true) {
          if (interrupted) throw new Error("Smoke interrupted");
          if (await probe()) return;
          if (Date.now() >= until)
            throw new Error("Observation did not arrive within approved wait");
          await delay(2000);
        }
      },
    },
    settings.sweepIntervalMs,
  );
  let interrupted = false;
  const restore = () => {
    interrupted = true;
    void github
      .rest("restore smoke hook", "PATCH /orgs/{org}/hooks/{hook_id}", {
        org: settings.organization,
        hook_id: hook,
        active: true,
      })
      .then(
        () => {
          process.exitCode = 1;
        },
        () => {
          process.exitCode = 1;
        },
      );
  };
  process.once("SIGINT", restore);
  process.once("SIGTERM", restore);
  try {
    if (
      !(await runReportedSteps(resolve(directory, `smoke/${runId}.log`), steps, secrets, () =>
        generatedFiles(directory),
      ))
    )
      process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", restore);
    process.removeListener("SIGTERM", restore);
  }
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Live smoke failed");
  process.exitCode = 1;
}
