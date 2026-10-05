// ---
// relationships:
//   implements: service-assembly
// ---
import { createMirror } from "./mirror.ts";
import { githubSteps } from "./migrations.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import { startGitHubSource } from "./index.ts";
import { githubWebhookPath } from "../service/types.ts";
import type { HttpHost } from "../http-host/index.ts";
import type { GitHubSource } from "./index.ts";
import { intake as intakePart } from "../intake/wiring.ts";
export const githubMirror = wiringPart({
  name: "github-mirror",
  start: (
    members: Required<Pick<Service, "store">>,
  ): { githubMirror: ReturnType<typeof createMirror> } => {
    const { store } = members;
    store.connection.migrate("github", githubSteps);
    const githubMirror = createMirror(store, Date.now);
    return { githubMirror };
  },
});

export const githubSource = wiringPart({
  name: "github-source",
  start: (
    members: Required<
      Pick<
        Service,
        "configuration" | "store" | "router" | "portfolio" | "revisions" | "gates" | "log"
      >
    > & { http: HttpHost },
    context,
  ): { github: GitHubSource } => {
    const { configuration, store, router, portfolio, revisions, gates, http, log } = members;
    const { options } = context;
    const intake = context.later(intakePart);
    const github = startGitHubSource({
      configuration: configuration.github,
      credentials: configuration.credentials,
      store,
      router,
      boundProjects: () =>
        portfolio
          .current()
          .declaration.githubProjects.map(({ owner, number }) => ({ owner, number })),
      processRepository: {
        url: configuration.processRepository.url,
        branch: configuration.processRepository.branch,
        pull: revisions.pull,
      },
      ...(options.probes?.cardMove ? { probeMove: options.probes.cardMove } : {}),
      onTracked: (ids) => intake.current()?.intake.discovered(ids),
      onMirrorChanged: () => {
        gates?.inputChanged();
        intake.current()?.intake.mirrorChanged();
      },
      onError: (error) =>
        log({
          level: "error",
          event: "github-error",
          message: error.message,
          detail: { kind: error.kind },
        }),
    });
    context.onStop("sources", () => github.stop());
    http.mount(githubWebhookPath, github.requestListener);
    return { github };
  },
});
