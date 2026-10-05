// ---
// relationships:
//   verifies: live-github-environment
// ---
import { test, expect } from "vite-plus/test";
import { smokeSteps } from "./smoke-check.ts";
import type { SmokeBoundary } from "./smoke-check.ts";
function fixture() {
  const calls: string[] = [];
  const boundary: SmokeBoundary = {
    configuration: async () => {},
    createItem: async (name) => {
      calls.push(name);
      return name;
    },
    delivery: async () => ({ guid: "delivery", accepted: true }),
    recorded: async () => true,
    actor: async () => true,
    setHook: async (active) => {
      calls.push(String(active));
    },
    hookActive: async () => false,
    hasDelivery: async () => false,
    paths: async () => {
      calls.push("paths");
    },
    wait: async (probe) => {
      if (!(await probe())) throw new Error("not observed");
    },
  };
  return { boundary, calls };
}
test("delivery requires both GitHub accepted delivery and the durable service row", async () => {
  const { boundary } = fixture();
  boundary.recorded = async () => false;
  await expect(smokeSteps(boundary)[1]!.run()).rejects.toThrow("not observed");
});
test("sweep restores the hook after failure and independent paths still run", async () => {
  const { boundary, calls } = fixture();
  boundary.actor = async () => false;
  const steps = smokeSteps(boundary);
  await expect(steps[3]!.run()).rejects.toThrow("not observed");
  expect(calls).toEqual(["false", "sweep", "true"]);
  await steps[4]!.run();
  expect(calls.at(-1)).toBe("paths");
});
test("sweep rejects any delivery for its item", async () => {
  const { boundary, calls } = fixture();
  boundary.hasDelivery = async () => true;
  await expect(smokeSteps(boundary)[3]!.run()).rejects.toThrow("delivery");
  expect(calls.at(-1)).toBe("true");
});
test("complete smoke creates distinct delivery and sweep items", async () => {
  const { boundary, calls } = fixture();
  for (const step of smokeSteps(boundary)) await step.run();
  expect(calls).toEqual(["delivery", "false", "sweep", "true", "paths"]);
});
