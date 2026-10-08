// ---
// relationships:
//   verifies: [github-event-source, t3code-environment-source, gate-runtime]
// ---
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { githubSteps } from "../github-source/migrations.ts";
import { createMirror } from "../github-source/mirror.ts";

test("issue titles and URLs survive a mirror write and a row without a title remains readable", () => {
  const store = openStore({ path: ":memory:" });
  try {
    store.connection.migrate("github", githubSteps);
    store.connection.database
      .prepare(
        "INSERT INTO github_issue(issue_node_id,repository,number,state,state_reason,baselined,revision,present) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run("old", "example/delivery", 1, "open", null, 1, 0, 1);
    store.connection.migrate("github", githubSteps);
    const mirror = createMirror(store, () => 0),
      before = mirror.read();
    expect(before.issues.get("old")?.issue.title).toBeUndefined();
    const after = mirror.read(),
      row = after.issues.get("old")!;
    after.issues.set("old", {
      ...row,
      issue: { ...row.issue, title: "Delivery", url: "https://example.test/1" },
    });
    mirror.write(before, after);
    expect(mirror.read().issues.get("old")?.issue).toMatchObject({
      title: "Delivery",
      url: "https://example.test/1",
    });
  } finally {
    store.close();
  }
});
