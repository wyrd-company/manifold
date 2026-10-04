// ---
// relationships:
//   implements: actor-host
// ---
import { createActor, createMachine } from "xstate";
import type { AnyActorRef, InspectionEvent, Snapshot } from "xstate";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { LoadedBlueprint, VersionLoad } from "../blueprint-loader/index.ts";
import type { ActorRecord as RouterActorRecord, Router } from "../router/index.ts";
import type { DeliveryTarget, PersistedSnapshot } from "../store/index.ts";
import { activeEntries, activeInvokes, deadlineArms, deliverDeadline } from "./entries.ts";
import { identityOf, identityTopics, validateInput } from "./identity.ts";
import { machineOf, nodesOf, prefixOf, records } from "./records.ts";
import type { ActorRecord, EntryRecords } from "./records.ts";
import type { ActorHost, ActorHostOptions, ActorSave } from "./types.ts";

export async function openActorHost({
  store,
  blueprints,
  saveHooks,
  log,
  now = Date.now,
}: ActorHostOptions): Promise<ActorHost> {
  const versions = new Map<string, VersionLoad>();
  const actors = new Map<string, ActorRecord>();
  const saves = new WeakMap<PersistedSnapshot, ActorSave>();
  let router: Router | undefined;
  async function load(key: string) {
    const version = parseBlueprintVersionKey(key);
    versions.set(
      key,
      version ? await blueprints.version(version) : { status: "missing", reason: "file" },
    );
  }
  for (const key of [
    ...new Set(store.activeSnapshots().map((snapshot) => snapshot.machine)),
  ].sort())
    await load(key);
  function connected() {
    if (!router) throw new TypeError("Actor host is not connected");
    return router;
  }
  function create(
    actorId: string,
    blueprint: LoadedBlueprint,
    snapshot?: Snapshot<unknown>,
    entries: EntryRecords = { count: 0, states: {} },
    input?: Record<string, unknown>,
    manifold?: ReturnType<typeof identityOf>,
  ) {
    const record: ActorRecord = {
      actorId,
      blueprint,
      entries,
      entered: [],
      sending: true,
      queued: false,
      stopped: false,
    };
    actors.set(actorId, record);
    function inspect(event: InspectionEvent) {
      const ref = event.actorRef as AnyActorRef;
      if (event.type === "@xstate.actor") {
        records.set(ref.system, record);
        if (!ref._parent) record.root = ref;
      }
      if (event.type === "@xstate.action" && event.action.type === "xstate.raise") {
        const params = event.action.params as
          | { event?: { type?: string }; delay?: number }
          | undefined;
        const type = params?.event?.type;
        const machine = machineOf(ref);
        if (machine && type?.startsWith("xstate.after.") && typeof params?.delay === "number") {
          const node = nodesOf(machine).find((node) =>
            Object.keys(node.config.after ?? {}).some(
              (key) => type === `xstate.after.${key}.${node.id}`,
            ),
          );
          if (node) {
            const entry = record.entries.states[`${prefixOf(ref)}${node.path.join(".")}`];
            const key = type.slice("xstate.after.".length, -(node.id.length + 1));
            if (entry) entry.deadlines[key] = now() + params.delay;
          }
        }
      }
      if (
        event.type === "@xstate.snapshot" &&
        machineOf(ref) &&
        !record.stopped &&
        !record.sending &&
        !record.queued
      ) {
        record.queued = true;
        queueMicrotask(() => {
          record.queued = false;
          if (record.stopped) return;
          try {
            connected().persist(actorId);
          } catch (error) {
            log({
              level: "error",
              event: "actor-save",
              message: error instanceof Error ? error.message : String(error),
              detail: { actorId },
            });
          }
        });
      }
    }
    const machine =
      manifold === undefined
        ? blueprint.machine
        : createMachine(
            {
              ...blueprint.machine.config,
              context: {
                ...(blueprint.machine.config.context as Record<string, unknown>),
                manifold,
              },
            },
            blueprint.machine.implementations as Parameters<typeof createMachine>[1],
          );
    const root = createActor(machine, {
      id: actorId,
      ...(snapshot ? { snapshot } : {}),
      ...(input ? { input } : {}),
      inspect,
      clock: { setTimeout: () => 0, clearTimeout: () => {} },
    });
    record.root = root;
    // Errors are represented by an errored snapshot, rather than an uncaught XState report.
    root.subscribe({ error: () => {} });
    root.start();
    record.sending = false;
    return target(record);
  }
  function target(record: ActorRecord): DeliveryTarget {
    return {
      actorId: record.actorId,
      stop() {
        record.stopped = true;
        record.root!.stop();
      },
      send(row) {
        record.sending = true;
        try {
          if (row.topic.startsWith("deadline."))
            deliverDeadline(record, (row.payload as { type: string }).type);
          else record.root!.send(row.payload);
        } finally {
          record.sending = false;
        }
      },
      persist() {
        const raw = record.root!.getPersistedSnapshot() as PersistedSnapshot;
        if (raw.status === "error")
          return { machine: record.blueprint.key, snapshot: raw, deadlines: [] };
        const entries = activeEntries(record);
        const snapshot: PersistedSnapshot = { ...raw, entries };
        const count =
          (store.loadSnapshot(record.actorId)?.snapshot["entries"] as EntryRecords | undefined)
            ?.count ?? 0;
        record.entered = record.entered.filter((entry) => entry.id > count);
        const active = raw.status === "active";
        const save: ActorSave = {
          actorId: record.actorId,
          machine: record.blueprint.key,
          snapshot,
          entered: [...new Set(record.entered.map((entry) => entry.path))],
          entries: active
            ? Object.fromEntries(
                Object.entries(entries.states)
                  .filter(([path]) => path !== "" && !path.includes("#"))
                  .map(([path, entry]) => [path, entry.id]),
              )
            : {},
          activeInvokes: active ? activeInvokes(record) : [],
        };
        saves.set(snapshot, save);
        return {
          machine: record.blueprint.key,
          snapshot,
          deadlines: active ? deadlineArms(record, entries) : [],
        };
      },
    };
  }
  const host: ActorHost = {
    connect(value) {
      router = value;
    },
    start({ actorId, blueprint, input }) {
      const router = connected();
      if (actors.has(actorId) || store.loadSnapshot(actorId) || store.loadErroredSnapshot(actorId))
        return;
      const validated = validateInput(actorId, blueprint, input);
      versions.set(blueprint.key, { status: "loaded", blueprint });
      const delivery = create(
        actorId,
        blueprint,
        undefined,
        undefined,
        validated.input,
        validated.manifold,
      );
      try {
        router.attach(delivery);
      } catch (error) {
        delivery.stop!();
        actors.delete(actorId);
        throw error;
      }
    },
    subscription(actor) {
      const version = versions.get(actor.machine);
      return {
        topics: identityTopics(identityOf(actor.snapshot)),
        ...(version?.status === "loaded"
          ? { events: Object.keys(version.blueprint.document.schemas.events) }
          : {}),
      };
    },
    restore(stored) {
      const version = versions.get(stored.machine);
      if (!version || version.status === "missing")
        return {
          status: "held",
          reason: `blueprint version ${stored.machine} is missing (${version?.reason ?? "file"})`,
        };
      if (version.status === "invalid")
        return {
          status: "held",
          reason: `blueprint version ${stored.machine} is invalid: ${version.findings[0]?.kind} at ${version.findings[0]?.location}`,
        };
      const { entries, ...snapshot } = stored.snapshot;
      const check = version.blueprint.checkRestore(snapshot as Snapshot<unknown>);
      if (!check.ok)
        return {
          status: "held",
          reason: check.mismatches
            .map((mismatch) => `${mismatch.kind}: ${Object.values(mismatch).slice(1).join(" ")}`)
            .join("\n"),
        };
      try {
        const previous = actors.get(stored.actorId);
        if (previous) {
          previous.stopped = true;
          previous.root?.stop();
        }
        const restored = create(
          stored.actorId,
          version.blueprint,
          snapshot as Snapshot<unknown>,
          structuredClone(entries as EntryRecords | undefined),
        );
        if (actors.get(stored.actorId)!.root!.getSnapshot().status === "error")
          return {
            status: "held",
            reason: String(actors.get(stored.actorId)!.root!.getSnapshot().error),
          };
        return { status: "restored", target: restored };
      } catch (error) {
        return { status: "held", reason: error instanceof Error ? error.message : String(error) };
      }
    },
    saving(actor: RouterActorRecord) {
      if (actor.snapshot.status === "error") return;
      const save = saves.get(actor.snapshot);
      if (!save) throw new TypeError(`Actor ${actor.actorId} save was not prepared by the host`);
      for (const hook of saveHooks) hook(save);
    },
    actorOf(actorId) {
      const record = actors.get(actorId);
      if (!record?.root) return undefined;
      return {
        manifold: identityOf(record.root.getSnapshot()),
        commit: record.blueprint.version.commit,
      };
    },
    async release(actorId) {
      const router = connected();
      const stored = store.loadSnapshot(actorId);
      if (stored) await load(stored.machine);
      // The escalation module adds release to Router; keep its structural seam until it lands.
      const releasable = router as Router & { release?(actorId: string): void };
      if (!releasable.release) throw new TypeError("Router release is not available");
      releasable.release(actorId);
    },
  };
  return host;
}
