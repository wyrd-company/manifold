// ---
// relationships:
//   verifies: [store, github-event-source, task-metadata, retention, t3code-environment-source]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "./index.ts";
import { githubSteps } from "../github-source/migrations.ts";
import { createMirror } from "../github-source/mirror.ts";
import { taskWriteRecords } from "../github-source/body-write.ts";
import { cardMoveActors, pruneCardMoves } from "../github-source/prune.ts";
import type { ScopeConfiguration, TaskFieldWrite } from "../github-source/types.ts";
import { metadataRecords } from "../task-metadata/records.ts";
import { taskMetadataMigrationSteps } from "../task-metadata/migrations.ts";
import { createdProjects } from "../t3code-source/created-projects.ts";
import { migrations } from "../t3code-source/migrations.ts";
import { retirableCreatedProjects, retireCreatedProject } from "../t3code-source/prune.ts";
import { agentToolSteps } from "../agent-tools/migrations.ts";
import { prunableMessages, pruneMessages } from "../agent-tools/prune.ts";
import { escalationRows } from "../escalations/rows.ts";
import { escalationSteps } from "../escalations/migrations.ts";
import { prunableEscalations, pruneEscalation } from "../escalations/prune.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0).toReversed()) close();
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "text-owners-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "store.sqlite");
  let store = openStore({ path });
  cleanup.push(() => store.close());
  return {
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = openStore({ path });
      return store;
    },
  };
}
for (const text of ["inside\0tail", "\0leading"]) {
  test(`new GitHub content and scope text restore: ${JSON.stringify(text)}`, () => {
    const f = fixture();
    f.store.connection.migrate("github", githubSteps);
    const mirror = createMirror(f.store, () => 1);
    const before = mirror.read(),
      after = mirror.read();
    const content = {
      body: text,
      lastEditedAt: 1,
      labels: [{ nodeId: "L_one", name: text }],
      issueFields: [{ fieldNodeId: "F_one", name: text, value: { kind: "text" as const, text } }],
      milestone: null,
      issueType: null,
    };
    after.issues.set("I_one", {
      issue: {
        nodeId: "I_one",
        repository: "sample/repo",
        number: 1,
        state: "open",
        stateReason: null,
        title: text,
      },
      baselined: true,
      present: true,
      revision: 1,
      contentRevision: 1,
      content,
    });
    mirror.write(before, after);
    const scope = { kind: "repository" as const, repository: "sample/repo" };
    const configuration: ScopeConfiguration = {
      scope,
      status: "ready",
      readAt: 1,
      issueFields: [{ nodeId: "F_one", name: text, type: "text", options: [] }],
      issueTypes: [{ nodeId: "T_one", name: text, color: null, description: text, enabled: true }],
      labels: [{ nodeId: "L_one", name: text, color: "aabbcc", description: text }],
      milestones: [{ nodeId: "M_one", number: 1, title: text, description: text, state: "open" }],
    };
    mirror.observeScope(configuration);
    mirror.observeScope(configuration);
    const resumed = createMirror(f.reopen(), () => 2);
    expect(resumed.read().issues.get("I_one")?.content).toEqual(content);
    expect(resumed.scopeConfiguration(scope)).toEqual(configuration);
    const unavailable = { scope, status: "forbidden" as const, readAt: 2, message: text };
    resumed.observeScope(unavailable);
    expect(createMirror(f.reopen(), () => 3).scopeConfiguration(scope)).toEqual(unavailable);
  });
  test(`new metadata scope commit and declared JSON text restore: ${JSON.stringify(text)}`, () => {
    const f = fixture();
    f.store.connection.migrate("metadata", taskMetadataMigrationSteps);
    const records = metadataRecords(f.store.connection);
    const configuration: ScopeConfiguration = {
      scope: { kind: "repository", repository: "sample/repo" },
      status: "forbidden",
      readAt: 1,
      message: text,
    };
    const applied = { configuration, owned: { field: text } };
    records.recordApply(
      "binding",
      "P_one",
      text,
      { fields: [], owned: { lifecycle: undefined, fields: {} } },
      1,
      [{ key: text, applied }],
    );
    records.recordApply(
      "binding",
      "P_one",
      text,
      { fields: [], owned: { lifecycle: undefined, fields: {} } },
      1,
      [{ key: text, applied }],
    );
    expect(metadataRecords(f.reopen().connection).appliedScope(text)).toEqual({
      ...applied,
      commit: text,
      at: 1,
    });
  });
  test(`new front matter state and task field attribution restore: ${JSON.stringify(text)}`, () => {
    const f = fixture();
    f.store.connection.migrate("github", githubSteps);
    const records = taskWriteRecords(f.store.connection);
    const write: TaskFieldWrite = {
      actorId: text,
      invokeId: text,
      entryId: text,
      issueNodeId: "I_one",
      projectNodeId: "P_one",
      field: text,
      storage: { kind: "front-matter", key: "field" },
      value: text,
      labels: [],
      repositories: [],
    };
    records.sent(write, 1);
    records.sent(write, 1);
    records.attempt(write, 1, 1, text, 1, text);
    records.status(write, "confirmed");
    const resumed = taskWriteRecords(f.reopen().connection);
    expect(resumed.row(write)).toMatchObject({
      actor_id: text,
      invoke_id: text,
      entry_id: text,
      field: text,
      basis_body: text,
      repair_body: text,
      storage: JSON.stringify(write.storage),
      value: JSON.stringify(text),
    });
    expect(resumed.attribute("I_one", "P_one", text, text)).toEqual({
      actorId: text,
      confirmed: true,
    });
    expect(resumed.attribute("I_one", "P_one", text, text)).toBeNull();
  });
  test(`new created project presence and retention identities restore: ${JSON.stringify(text)}`, () => {
    const f = fixture();
    f.store.connection.migrate("tthree", migrations);
    // Persistence is populated through the owning module's source interface in source.test.ts.
    f.store.connection.database
      .prepare(
        "INSERT INTO t3_environment(environment,environment_id,origin_sequence,shell_sequence) VALUES ('station','environment',0,0)",
      )
      .run();
    const projects = createdProjects(f.store);
    const record = { environment: "station", projectId: text, actorId: text, item: text };
    projects.record(record);
    projects.record(record);
    projects.snapshot("station", [{ id: text }]);
    expect(projects.all()).toEqual([
      { ...record, presence: "listed", threads: 0, retirable: false },
    ]);
    projects.snapshot("station", []);
    const store = f.reopen();
    expect(createdProjects(store).all()).toEqual([
      { ...record, presence: "removed", threads: 0, retirable: true },
    ]);
    const candidates = retirableCreatedProjects(store.connection, {
      environments: ["station"],
      limit: 10,
    });
    expect(candidates).toEqual([{ environment: "station", projectId: text, actorId: text }]);
    expect(
      retireCreatedProject(store.connection, candidates[0]!, { environments: ["station"] }),
    ).toBe("retired");
    expect(
      retireCreatedProject(store.connection, candidates[0]!, { environments: ["station"] }),
    ).toBe("kept");
  });
  test(`new retention actor and extracted escalation subject restore: ${JSON.stringify(text)}`, () => {
    const f = fixture();
    f.store.connection.migrate("github", githubSteps);
    f.store.connection.migrate("escalation", escalationSteps);
    f.store.connection.migrate("agenttool", agentToolSteps);
    f.store.connection.database
      .prepare(
        "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to,read_at,read_turn_id,read_position) VALUES ('00000000-0000-4000-8000-000000000000','station',?,?,?,1,1,?,1,?,1)",
      )
      .run(text, text, text, text, text);
    f.store.connection.database
      .prepare("INSERT INTO github_card_move VALUES (?,?,?,'I_one','F_one','O_one','sent',1)")
      .run(text, text, text);
    const rows = escalationRows(
      f.store,
      { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
      () => 1,
      () => {},
    );
    const request = {
      kind: "held-actor" as const,
      subject: { actorId: text },
      question: text,
      title: text,
      freeText: true,
      choices: [],
    };
    const raised = rows.raise(request);
    rows.withdraw(request);
    const store = f.reopen();
    expect(cardMoveActors(store.connection, { limit: 10 })).toEqual([text]);
    expect(prunableMessages(store.connection, { readBefore: 2, limit: 10 })).toEqual([
      { sequence: 1, senderActorId: text, readerActorId: text },
    ]);
    expect(pruneMessages(store.connection, [1])).toBe(1);
    expect(pruneMessages(store.connection, [1])).toBe(0);
    expect(prunableEscalations(store.connection, { closedBefore: 2, limit: 10 })).toEqual([
      { escalationId: raised.id, actorId: text, latestOccurrence: true },
    ]);
    expect(pruneCardMoves(store.connection, [text])).toBe(1);
    expect(pruneCardMoves(store.connection, [text])).toBe(0);
    expect(pruneEscalation(store.connection, raised.id)).toEqual({ notifications: 0 });
    expect(pruneEscalation(store.connection, raised.id)).toBe("kept");
  });
}
