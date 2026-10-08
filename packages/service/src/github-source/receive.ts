// ---
// relationships:
//   implements: github-event-source
// ---
import type { GitHubSourceOptions, GitHubSource, DeliveryOutcome } from "./types.ts";
import { GitHubDeliveryError, GitHubSourceError } from "./types.ts";
import { githubSteps } from "./migrations.ts";
import { verify, namedEntities, pushCommit } from "./verify.ts";
import { createMirror } from "./mirror.ts";
import { createRunner, systemClock } from "./runner.ts";
export function startGitHubSource(options: GitHubSourceOptions): GitHubSource {
  const clock = options.clock ?? systemClock;
  options.store.connection.migrate("github", githubSteps);
  const mirror = createMirror(options.store, clock.now.bind(clock));
  const runner = createRunner(options, mirror, clock);
  const source: GitHubSource = {
    receive(delivery): DeliveryOutcome {
      if (runner.isStopped()) throw new TypeError("GitHub source is stopped");
      const verified = verify(delivery, options.configuration);
      if (verified instanceof GitHubDeliveryError) return { status: "rejected", error: verified };
      const duplicate = options.store.connection.transaction(() => {
        if (!mirror.accept(verified.id, verified.hookId, verified.event)) return true;
        const entities = namedEntities(verified);
        for (const id of entities.issues) mirror.enqueueIssue(id, runner.bound);
        if (entities.project && runner.bound.has(entities.project)) {
          if (entities.item) {
            mirror.enqueue("item", entities.item, entities.project);
          } else mirror.enqueue("project", entities.project);
        }
        return false;
      });
      if (!duplicate) {
        const commit = pushCommit(verified, options.processRepository);
        if (commit) runner.pull(commit);
        runner.wake();
      }
      return { status: "accepted", deliveryId: verified.id, duplicate };
    },
    requestListener(request, response) {
      if (request.method !== "POST") {
        response.writeHead(405).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let oversized = false;
      request.on("data", (chunk: Buffer) => {
        if (oversized) return;
        size += chunk.length;
        if (size > 26214400) {
          oversized = true;
          chunks.length = 0;
          request.pause();
          response.once("finish", () => request.destroy());
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      });
      request.on("end", () => {
        if (oversized) return;
        try {
          const outcome = source.receive({ headers: request.headers, body: Buffer.concat(chunks) });
          response
            .writeHead(
              outcome.status === "accepted"
                ? outcome.duplicate
                  ? 200
                  : 202
                : { malformed: 400, "unknown-hook": 404, signature: 401 }[outcome.error.kind],
            )
            .end();
        } catch (error) {
          response.writeHead(500).end();
          options.onError?.(
            error instanceof Error && "kind" in error
              ? (error as import("./types.ts").GitHubSourceError)
              : new GitHubSourceError("api", "GitHub request listener failed", undefined, error),
          );
        }
      });
      request.on("error", (error) => {
        if (!response.headersSent) response.writeHead(500).end();
        options.onError?.(
          new GitHubSourceError("api", "GitHub request body failed", undefined, error),
        );
      });
    },
    project: (id) => mirror.read().projects.get(id)?.project,
    projectByNumber: (owner, number) => mirror.projectByNumber(owner, number),
    moveCard: runner.moveCard,
    projectFields: (id) => mirror.projectFields(id),
    observeProjectFields: runner.observeProjectFields,
    writeProjectField: runner.writeProjectField,
    requestSweep: runner.requestSweep,
    trackedIssue: (id) => mirror.trackedIssue(id, runner.bound),
    trackedIssueIds: () => mirror.trackedIssueIds(runner.bound),
    trackedIssues: () => mirror.trackedIssues(runner.bound),
    stop: runner.stop,
  };
  return source;
}
