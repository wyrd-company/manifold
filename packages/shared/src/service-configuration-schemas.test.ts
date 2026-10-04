// ---
// relationships:
//   verifies: service-configuration
// ---
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import { serviceConfigurationSchemas } from "./index.ts";

test.each(serviceConfigurationSchemas)(
  "bundled schema equals its YAML asset: $id",
  async (schema) => {
    const name = schema.$id.split("/").at(-1);
    const file = new URL(`../../../docs/specifications/${name}.schema.yml`, import.meta.url);
    expect(schema).toEqual(parse(await readFile(file, "utf8")));
  },
);
