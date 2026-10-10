// ---
// relationships:
//   verifies: [tasks-api, escalation-contract]
// ---
import { expect, test } from "vite-plus/test";
import { isTasksResponse, isTaskResponse } from "./tasks-api.ts";
import { isEscalationAnswerResponse, isEscalation } from "./escalations-api.ts";
test("API guards reject unknown prototype-named properties without throwing", () => {
  for (const key of ["__proto__", "constructor", "toString"]) {
    const body = JSON.parse(`{"projects":[],"${key}":true}`);
    expect(isTasksResponse(body)).toBe(false);
  }
});
test("guards accept the declared task and escalation response shapes and reject malformed nested fields", () => {
  const escalation = {
    id: "a".repeat(22),
    raiser: { type: "blueprint", actorId: "task:parcel", invokeId: "ask", entryId: "one" },
    title: "Delivery",
    question: "Where?",
    choices: [{ id: "door", label: "Door" }],
    freeText: true,
    destinations: [],
    status: "answered",
    raisedAt: 0,
    closedAt: 1,
    answer: { value: { text: "At the door" }, channel: "api", at: 1 },
  };
  const task = {
    actorId: "task:parcel",
    issue: { nodeId: "parcel", repository: "example/delivery", number: 1, state: "open" },
    projects: [],
    threads: [],
    usage: { settled: true, accounts: [] },
    escalations: { open: [], recent: [escalation] },
  };
  expect(isTaskResponse({ task })).toBe(true);
  expect(isEscalation(escalation)).toBe(true);
  expect(isEscalationAnswerResponse({ outcome: "closed", escalation })).toBe(true);
  for (const invalid of [
    null,
    {},
    { ...task, actorId: "other" },
    { ...task, threads: [{ threadId: "one", turn: "unknown" }] },
    {
      ...task,
      usage: {
        settled: true,
        accounts: [{ account: "one", estimate: 1, actual: 2, variance: 1, reserved: -1 }],
      },
    },
    {
      ...task,
      escalations: { open: [], recent: Array.from({ length: 21 }, () => ({ ...escalation })) },
    },
  ])
    expect(isTaskResponse({ task: invalid })).toBe(false);
  for (const invalid of [
    { ...escalation, id: "bad" },
    { ...escalation, choices: [{ id: "INVALID", label: "Door" }] },
    { ...escalation, answer: { value: { text: "" }, channel: "api", at: 1 } },
    { ...escalation, unknown: true },
  ])
    expect(isEscalation(invalid)).toBe(false);
});

test("task timestamps reject invalid calendar dates and missing timezone offsets", () => {
  const task = {
    actorId: "task:parcel",
    issue: { nodeId: "parcel", repository: "example/delivery", number: 1, state: "open" },
    projects: [],
    threads: [],
    usage: { settled: false, accounts: [] },
    escalations: { open: [], recent: [] },
  };
  const actor = {
    status: "active",
    states: ["ready"],
    machine: "delivery",
    savedAt: "2026-01-01T00:00:00.000Z",
  };
  expect(isTaskResponse({ task: { ...task, actor } })).toBe(true);
  for (const savedAt of [
    "2026-02-30T00:00:00.000Z",
    "2026-01-01T00:00:00",
    "2026-01-01T00:00:00Z junk",
  ])
    expect(isTaskResponse({ task: { ...task, actor: { ...actor, savedAt } } })).toBe(false);
  expect(
    isTaskResponse({
      task: { ...task, actor: { ...actor, savedAt: "2026-01-01T01:00:00+01:00" } },
    }),
  ).toBe(true);
});

test("escalation length limits count Unicode characters as the schema does", () => {
  const escalation = {
    id: "a".repeat(22),
    raiser: { type: "blueprint", actorId: "task:parcel", invokeId: "ask", entryId: "one" },
    title: "Delivery",
    question: "Where?",
    choices: [{ id: "door", label: "📦".repeat(40) }],
    freeText: true,
    destinations: [],
    status: "answered",
    raisedAt: 0,
    answer: { value: { text: "📦".repeat(4096) }, channel: "api", at: 1 },
  };
  expect(isEscalation(escalation)).toBe(true);
  expect(isEscalation({ ...escalation, choices: [{ id: "door", label: "📦".repeat(41) }] })).toBe(
    false,
  );
  expect(
    isEscalation({
      ...escalation,
      answer: { ...escalation.answer, value: { text: "📦".repeat(4097) } },
    }),
  ).toBe(false);
});

test("task fields accept all value states and reject malformed set values", () => {
  const task = {
    actorId: "task:parcel",
    issue: { nodeId: "parcel", repository: "example/delivery", number: 1, state: "open" },
    projects: [],
    threads: [],
    usage: { settled: false, accounts: [] },
    escalations: { open: [], recent: [] },
  };
  const project = { binding: "sample", owner: "example", number: 1, status: null };
  const field = {
    name: "Size",
    type: "number",
    storage: "front-matter",
    where: "Front matter Size",
    value: { state: "set", value: 0 },
  };
  for (const value of [
    { state: "set", value: 0 },
    { state: "set", value: "small" },
    { state: "empty" },
    { state: "invalid", detail: "Wrong type" },
    { state: "unavailable", detail: "Not read" },
  ])
    expect(
      isTaskResponse({
        task: { ...task, projects: [{ ...project, fields: [{ ...field, value }] }] },
      }),
    ).toBe(true);
  for (const value of [
    { state: "set", value: false },
    { state: "set", value: null },
    { state: "set", value: Infinity },
    { state: "invalid" },
    { state: "empty", value: 1 },
  ])
    expect(
      isTaskResponse({
        task: { ...task, projects: [{ ...project, fields: [{ ...field, value }] }] },
      }),
    ).toBe(false);
});
