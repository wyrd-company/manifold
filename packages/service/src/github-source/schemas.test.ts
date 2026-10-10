// ---
// relationships:
//   verifies: [github-events, github-source-configuration]
// ---
import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { githubEventsSchema, githubSourceConfigurationSchema } from "@wyrd-company/manifold-shared";
test.each([
  ["github-events", githubEventsSchema],
  ["github-source-configuration", githubSourceConfigurationSchema],
])("%s schema agrees with its specification", (name, schema) => {
  expect(schema).toEqual(
    parse(
      readFileSync(
        new URL(`../../../../docs/specifications/${name}.schema.yml`, import.meta.url),
        "utf8",
      ),
    ),
  );
});
