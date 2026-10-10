// ---
// relationships:
//   verifies: github-event-source
// ---
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { githubSteps } from "./migrations.ts";
import { taskWriteRecords } from "./body-write.ts";
import type { TaskFieldWrite } from "./types.ts";
test("attribution selects the latest matching write and preserves newer writes even at one timestamp", () => {
  const store = openStore({ path: ":memory:" });
  try {
    store.connection.migrate("github", githubSteps);
    const records = taskWriteRecords(store.connection);
    const write: TaskFieldWrite = {
      actorId: "parcel",
      invokeId: "due",
      entryId: "first",
      issueNodeId: "I_A",
      projectNodeId: "P_one",
      field: "Due",
      storage: { kind: "front-matter", key: "due" },
      value: "first",
      labels: [],
      repositories: [],
    };
    records.sent(write, 1);
    records.status(write, "confirmed");
    const middle = { ...write, entryId: "middle", value: "middle" };
    records.sent(middle, 1);
    const latest = { ...write, entryId: "latest", value: "latest" };
    records.sent(latest, 1);
    records.status(latest, "confirmed");
    expect(records.attribute("I_A", "P_one", "Due", "external")).toBeNull();
    expect(records.attribute("I_A", "P_one", "Due", "middle")).toEqual({
      actorId: "parcel",
      confirmed: false,
    });
    expect(records.attribute("I_A", "P_one", "Due", "first")).toBeNull();
    expect(records.attribute("I_A", "P_one", "Due", "latest")).toEqual({
      actorId: "parcel",
      confirmed: true,
    });
    expect(records.attribute("I_A", "P_one", "Due", "latest")).toBeNull();
  } finally {
    store.close();
  }
});
