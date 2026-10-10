// ---
// relationships:
//   verifies: [declarations-api, operator-console]
// ---
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import {
  isDeclarationSourceResponse,
  isLintDeclarationResponse,
  isTaskFieldEditResponse,
  isSaveDeclarationResponse,
  isSaveConflictResponse,
  isSaveInvalidResponse,
  isBindingsResponse,
  isDeclarationErrorResponse,
  isSaveRemoteErrorResponse,
} from "./declarations-api.ts";
const commit = "a".repeat(40);
const findings = { findings: [], warnings: [] };
const field = {
  binding: "shipping",
  name: "",
  lifecycle: false,
  location: "/projects/shipping/fields/0",
  storage: "invalid",
  type: "invalid",
  whenChanged: "invalid",
  settings: { name: "" },
  options: [""],
  onGitHub: { state: "differs", detail: "Change field." },
  range: { from: 0, to: 1, line: 1, column: 1 },
};
const source = {
  ...findings,
  path: "task-metadata.yml",
  commit,
  exists: false,
  text: "",
  fields: [field],
  storageKinds: [{ kind: "project-field", types: ["text"], settings: ["name"] }],
  impact: [{ binding: "shipping", creates: 1, changes: 0, removes: 0 }],
};
const bindings = {
  createdProjects: [{ environment: "local", project: "p1", actorId: "a1", item: "alpha" }],
  repository: { url: "https://example.invalid/process.git", branch: "main" },
  commit,
  findings: [],
  githubProjects: [
    {
      name: "shipping",
      owner: "example",
      number: 1,
      environment: "local",
      item: "shipping",
      t3codeProjects: ["project-1"],
      archived: false,
    },
  ],
  t3codeProjects: [
    {
      name: "shipping",
      environment: "local",
      project: "project-1",
      item: "shipping",
      archived: false,
    },
  ],
  items: [{ id: "shipping", title: "Shipping" }],
  environments: [
    {
      name: "local",
      projects: [
        {
          id: "project-1",
          title: "Shipping",
          workspaceRoot: "/projects/shipping",
          activeThreads: 2,
        },
      ],
    },
    { name: "offline" },
  ],
};
const spec = parse(
  readFileSync(
    new URL("../../../docs/specifications/declarations-api.openapi.yml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
ajv.addSchema({ $id: "declarations", components: spec.components });
const fixtures = [
  [
    "DeclarationSource",
    isDeclarationSourceResponse,
    source,
    [
      { ...source, commit: "bad" },
      { ...source, fields: [{ ...field, settings: { name: true } }] },
      { ...source, impact: [{ binding: "shipping", creates: 1 }] },
    ],
  ],
  [
    "LintResponse",
    isLintDeclarationResponse,
    { ...findings, fields: [field] },
    [
      { ...findings, unknown: true },
      {
        ...findings,
        findings: [{ kind: "schema", location: "", message: "Invalid", file: "other" }],
      },
    ],
  ],
  [
    "TaskFieldEditResponse",
    isTaskFieldEditResponse,
    { ...findings, text: "", location: "" },
    [{ ...findings, text: "" }],
  ],
  [
    "SaveResponse",
    isSaveDeclarationResponse,
    { outcome: "saved", commit, loaded: false },
    [{ outcome: "saved", commit }],
  ],
  [
    "SaveConflict",
    isSaveConflictResponse,
    { error: "conflict", message: "Changed", reason: "file-changed", head: commit },
    [{ error: "conflict", message: "Changed", reason: "other", head: commit }],
  ],
  [
    "SaveInvalid",
    isSaveInvalidResponse,
    {
      error: "invalid",
      message: "Check fields",
      findings: [{ kind: "schema", location: "", message: "Invalid" }],
      warnings: [],
    },
    [{ error: "invalid", message: "Check fields", findings: [], warnings: [] }],
  ],
  [
    "BindingsResponse",
    isBindingsResponse,
    bindings,
    [
      { ...bindings, githubProjects: [{ ...bindings.githubProjects[0], number: 0 }] },
      {
        ...bindings,
        environments: [
          {
            name: "local",
            projects: [
              { id: "project-1", title: "Shipping", workspaceRoot: "", activeThreads: -1 },
            ],
          },
        ],
      },
    ],
  ],
] as const;
for (const [name, guard, valid, invalid] of fixtures)
  test(`${name} guard matches OpenAPI fixtures`, () => {
    const validate = ajv.compile({ $ref: `declarations#/components/schemas/${name}` });
    expect(validate(valid)).toBe(true);
    expect(guard(valid)).toBe(true);
    for (const value of [...invalid, null, {}, { ...valid, extra: true }]) {
      expect(validate(value)).toBe(false);
      expect(guard(value)).toBe(false);
    }
  });

test("error guards match OpenAPI including the generic error's open members", () => {
  for (const [name, guard, valid, invalid] of [
    [
      "Error",
      isDeclarationErrorResponse,
      { error: "bad-request", message: "Check request", detail: "extra" },
      { error: "unknown", message: "Unknown" },
    ],
    [
      "SaveRemoteError",
      isSaveRemoteErrorResponse,
      { error: "remote", message: "Cannot push" },
      { error: "remote", message: "Cannot push", extra: true },
    ],
  ] as const) {
    const validate = ajv.compile({ $ref: `declarations#/components/schemas/${name}` });
    expect(validate(valid)).toBe(true);
    expect(guard(valid)).toBe(true);
    for (const value of [invalid, null, {}]) {
      expect(validate(value)).toBe(false);
      expect(guard(value)).toBe(false);
    }
  }
});

test("task field rows accept raw draft strings but reject a non-string optional type", () => {
  const validate = ajv.compile({ $ref: "declarations#/components/schemas/LintResponse" });
  for (const type of ["", "unrecognized", "text"]) {
    const body = { ...findings, fields: [{ ...field, type }] };
    expect(validate(body)).toBe(true);
    expect(isLintDeclarationResponse(body)).toBe(true);
  }
  const invalid = { ...findings, fields: [{ ...field, type: false }] };
  expect(validate(invalid)).toBe(false);
  expect(isLintDeclarationResponse(invalid)).toBe(false);
});

test("accounts sources carry environment names and accounts or prices findings", () => {
  const validate = ajv.compile({ $ref: "declarations#/components/schemas/DeclarationSource" });
  const value = {
    ...source,
    path: "accounts.yml",
    environments: ["env-one"],
    findings: [
      { file: "accounts", kind: "schema", location: "/accounts/acct", message: "Invalid" },
      { file: "prices", kind: "schema", location: "", message: "Invalid" },
    ],
  };
  expect(validate(value)).toBe(true);
  expect(isDeclarationSourceResponse(value)).toBe(true);
  const invalid = { ...value, environments: ["bad name"] };
  expect(validate(invalid)).toBe(false);
  expect(isDeclarationSourceResponse(invalid)).toBe(false);
});

test("storage metadata and scopes carry all declared storage kinds", () => {
  for (const kind of [
    "project-field",
    "issue-field",
    "issue-type",
    "label",
    "milestone",
    "front-matter",
  ]) {
    expect(
      isLintDeclarationResponse({
        ...findings,
        storageKinds: [
          { kind, types: ["text"], settings: ["key"], optionProperties: [], scope: "issue" },
        ],
        fields: [{ ...field, scope: { kind: "issue", names: [], sharedWith: [] } }],
      }),
    ).toBe(true);
  }
  expect(
    isLintDeclarationResponse({
      ...findings,
      fields: [{ ...field, scope: { kind: "invalid", names: [], sharedWith: [] } }],
    }),
  ).toBe(false);
});
