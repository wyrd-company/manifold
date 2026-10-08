// ---
// relationships:
//   verifies: task-metadata
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createActor, toPromise } from "xstate";
import { expect, test } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openStore } from "../store/index.ts";
import { openTaskMetadata, taskMetadataMigrationSteps } from "./index.ts";
const files = {
  "bindings.yml":
    "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: shipments } }",
  "task-metadata.yml": "projects: { parcels: { lifecycle: { field: Stage, options: [Packed] } } }",
};
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "task-metadata-"));
  const store = openStore({ path: join(directory, "store.sqlite") });
  store.connection.migrate("metadata", taskMetadataMigrationSteps);
  const moves: unknown[] = [];
  const options = {
    connection: store.connection,
    actorOf: () => ({ manifold: { project: "P_one", issue: "I_A" }, commit: "a".repeat(40) }),
    invocationOf: () => ({ actorId: "parcel", invokeId: "stage", entryId: "entry" }),
    source: async () => ({
      project: () => ({ nodeId: "P_one", owner: "sample", number: 1 }),
      moveCard: async (move: unknown) => {
        moves.push(move);
      },
    }),
    bindingOf: () => "parcels",
  };
  return {
    store,
    moves,
    options,
    close: () => {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
test("last clean declaration survives rejection and reopening; repeated apply writes one row", async () => {
  const { store, options, close, moves } = setup();
  try {
    const metadata = openTaskMetadata(options);
    const a = memoryRevision("a".repeat(40), files);
    expect(await metadata.apply(a)).toEqual({ status: "applied", commit: a.commit });
    await metadata.apply(a);
    expect(
      store.connection.database.prepare("SELECT count(*) AS n FROM metadata_declarations").get()?.[
        "n"
      ],
    ).toBe(1);
    expect(
      (
        await metadata.apply(
          memoryRevision("b".repeat(40), { ...files, "task-metadata.yml": "projects: []" }),
        )
      ).status,
    ).toBe("rejected");
    const reopened = openTaskMetadata(options);
    expect(reopened.implementations.actorKinds).toMatchObject({ "github-card-move": "promise" });
    expect(reopened.current()).toEqual(metadata.current());
    expect(
      store.connection.database.prepare("SELECT count(*) AS n FROM metadata_rejections").get()?.[
        "n"
      ],
    ).toBe(1);
    const actor = createActor(reopened.implementations.actors["github-card-move"]!, {
      input: { status: "Packed" },
    });
    actor.start();
    expect(await toPromise(actor)).toEqual({});
    expect(moves).toEqual([
      {
        actorId: "parcel",
        invokeId: "stage",
        entryId: "entry",
        projectNodeId: "P_one",
        issueNodeId: "I_A",
        field: "Stage",
        option: "Packed",
      },
    ]);
  } finally {
    close();
  }
});
test.each([
  [{}, "input"],
  [{ status: 7 }, "input"],
  [{ status: " Packed" }, "input"],
  [{ status: "Packed", extra: true }, "input"],
  [{ status: "Shipped" }, "undeclared"],
])("move rejects %j with a serializable typed error", async (input, kind) => {
  const { options, close } = setup();
  try {
    const metadata = openTaskMetadata(options);
    await metadata.apply(memoryRevision("a".repeat(40), files));
    const actor = createActor(metadata.implementations.actors["github-card-move"]!, { input });
    actor.start();
    await expect(toPromise(actor)).rejects.toMatchObject({ type: "card-move", kind });
  } finally {
    close();
  }
});
test("no clean apply, no binding, and absent root identity each fail at their boundary", async () => {
  const { options, close } = setup();
  try {
    for (const [changed, apply, kind] of [
      [{}, false, "undeclared"],
      [{ bindingOf: () => undefined }, true, "undeclared"],
      [{ actorOf: () => undefined }, true, "identity"],
    ] as const) {
      const metadata = openTaskMetadata({ ...options, ...changed });
      if (apply) await metadata.apply(memoryRevision("a".repeat(40), files));
      const actor = createActor(metadata.implementations.actors["github-card-move"]!, {
        input: { status: "Packed" },
      });
      actor.start();
      await expect(toPromise(actor)).rejects.toMatchObject({ type: "card-move", kind });
    }
  } finally {
    close();
  }
});

test("rejection of the same revision preserves the first record without another write", async () => {
  const { store, options, close } = setup();
  try {
    const metadata = openTaskMetadata(options);
    const revision = memoryRevision("b".repeat(40), {
      ...files,
      "task-metadata.yml": "projects: []",
    });
    await metadata.apply(revision);
    const first = store.connection.database.prepare("SELECT * FROM metadata_rejections").get();
    store.connection.database.exec(
      "CREATE TRIGGER forbid_rejection_update BEFORE UPDATE ON metadata_rejections BEGIN SELECT RAISE(ABORT, 'repeated rejection wrote'); END",
    );
    expect((await metadata.apply(revision)).status).toBe("rejected");
    expect(store.connection.database.prepare("SELECT * FROM metadata_rejections").get()).toEqual(
      first,
    );
  } finally {
    close();
  }
});
