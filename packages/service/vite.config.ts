// ---
// relationships:
//   verifies: [service-assembly, host-cli-usage]
// ---
import { defineConfig } from "vite-plus";
import { childProcessLimit } from "../../test-support/limits.ts";

// Includes direct children and tests whose Git remote fixture starts git http-backend.
const children = [
  "src/actor-host/crash.test.ts",
  "src/agent-threads/recovery.test.ts",
  "src/agent-threads/service-wiring.test.ts",
  "src/agent-tools/recovery.test.ts",
  "src/capacity/recovery.test.ts",
  "src/console/board.browser.test.ts",
  "src/escalations/recovery.test.ts",
  "src/foundation.integration.test.ts",
  "src/gates/crash.test.ts",
  "src/github-source/recovery.test.ts",
  "src/intake/crash.test.ts",
  "src/intake/service-recovery.test.ts",
  "src/process-repository/authentication.test.ts",
  "src/process-repository/crash.test.ts",
  "src/process-repository/index.test.ts",
  "src/process-repository/remote.test.ts",
  "src/router/router.test.ts",
  "src/service/process.test.ts",
  "src/service/start.test.ts",
  "src/service/usage.test.ts",
  "src/store/store.test.ts",
  "src/t3code-source/source.test.ts",
  "src/task-metadata/card-move-recovery.test.ts",
  "src/tasks/service-wiring.test.ts",
  "src/usage/declaration-cli.test.ts",
  "src/usage/recovery.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: "service-unit", include: ["src/**/*.test.ts"], exclude: children } },
      {
        test: {
          name: "service-children",
          include: children,
          testTimeout: childProcessLimit,
          hookTimeout: childProcessLimit,
          globalSetup: "../../test-support/build-children.ts",
        },
      },
    ],
  },
});
