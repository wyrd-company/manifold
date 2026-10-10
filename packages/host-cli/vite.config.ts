// ---
// relationships:
//   verifies: [service-assembly, host-cli-usage]
// ---
import { defineConfig } from "vite-plus";
import { childProcessLimit } from "../../test-support/limits.ts";

// Tests that execute compiled Bun children.
const children = [
  "src/help.test.ts",
  "src/blueprint-lint/repository.test.ts",
  "src/comparator-lint/index.test.ts",
  "src/foundation.integration.test.ts",
  "src/starter.test.ts",
  "src/manifest-lint/command.test.ts",
  "src/mcp-command.test.ts",
  "src/hook-command.test.ts",
  "src/portfolio-lint/command.test.ts",
  "src/usage-lint/binary.test.ts",
  "src/usage/usage.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      { test: { name: "host-unit", include: ["src/**/*.test.ts"], exclude: children } },
      {
        test: {
          name: "host-children",
          include: children,
          testTimeout: childProcessLimit,
          hookTimeout: childProcessLimit,
          globalSetup: "../../test-support/build-children.ts",
        },
      },
    ],
  },
});
