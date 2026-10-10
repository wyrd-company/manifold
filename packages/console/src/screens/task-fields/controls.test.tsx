// ---
// relationships:
//   verifies: [operator-console, task-metadata-declaration]
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { taskFieldStorageKinds } from "@wyrd-company/manifold-shared";
import type { TaskField } from "@wyrd-company/manifold-shared/declarations-api";
import { FieldPanel } from "./FieldPanel.tsx";
import { FieldsTable } from "./FieldsTable.tsx";
import { storageLabels } from "./fields.ts";
const fixture = parse(
  readFileSync(
    new URL(
      "../../../../../docs/specifications/task-metadata-declaration.fixtures.yml",
      import.meta.url,
    ),
    "utf8",
  ),
);
const declared = parse(fixture.declarations[0].taskMetadata).projects.parcels.fields;
const fields: TaskField[] = Object.entries(declared).map(([name, raw]) => {
  const field = raw as { type: string; storage: { kind: string; key?: string; prefix?: string } };
  return {
    name,
    type: field.type,
    storage: field.storage.kind,
    binding: "parcels",
    lifecycle: false,
    location: `/projects/parcels/fields/${name}`,
    settings: field.storage.key ? { key: field.storage.key } : {},
  };
});
test("storage controls show all six kinds and preserve type/storage mismatch findings", () => {
  const html = renderToStaticMarkup(
    <FieldsTable
      fields={fields}
      storageKinds={taskFieldStorageKinds}
      projects={[]}
      findings={[
        {
          kind: "storage-type",
          location: `${fields[0]!.location}/storage`,
          message: "Cannot hold",
        },
      ]}
      selected={undefined}
      disabled={false}
      onSelect={() => {}}
      onEdit={() => {}}
    />,
  );
  for (const label of Object.values(storageLabels)) expect(html).toContain(label);
  expect(html).toContain('class="field-error"');
});
test("front matter panel uses its key setting and has no configuration drift control", () => {
  const field = fields.find((field) => field.storage === "front-matter")!;
  const html = renderToStaticMarkup(
    <FieldPanel
      field={field}
      kinds={taskFieldStorageKinds}
      project={undefined}
      disabled={false}
      onEdit={() => {}}
    />,
  );
  expect(html).toContain("Front matter key");
  expect(html).toContain('value="due"');
  expect(html).toContain("In each issue&#x27;s body");
  expect(html).not.toContain("When changed on GitHub");
});
