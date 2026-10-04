// ---
// relationships:
//   verifies: escalations
// ---
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { loadServiceConfiguration } from "../service-configuration/index.ts";
import { mountEscalations } from "./index.ts";
import { fixture } from "./test-support.ts";
test("assembly mounts public and operator listeners and binds held recovery and the registry", async () => {
  const f = fixture();
  const mounts: string[] = [];
  const releases: string[] = [];
  const file = join(f.directory, "service.yml");
  writeFileSync(
    file,
    "processRepository:\n  url: https://example.test/recipes.git\n  directory: clone\n",
  );
  const configuration = await loadServiceConfiguration(file);
  const mounted = mountEscalations({
    store: f.store,
    configuration,
    mount: (prefix) => mounts.push("public:" + prefix),
    mountOperator: (prefix) => mounts.push("operator:" + prefix),
    log: () => {},
    invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
    release: (id) => releases.push(id),
    strandedToken: () => {},
  });
  try {
    expect(mounts).toEqual(["public:/escalations", "operator:/api/escalations"]);
    expect(mounted.implementations.actors["escalate"]).toBe(mounted.escalations.escalate);
    const escalation = mounted.onHeld({
      actorId: "parcel",
      reason: "Delivery failed",
      row: undefined,
    });
    mounted.escalations.answer(escalation.id, { choice: "retry" }, "api");
    expect(releases).toEqual(["parcel"]);
  } finally {
    await mounted.escalations.stop();
    await f.close();
  }
});
