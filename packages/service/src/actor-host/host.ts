// ---
// relationships:
//   implements: actor-host
// ---
import { prepareMigration } from "./migration.ts";
import { createActor, createMachine } from "xstate";
import type { AnyActorRef, InspectionEvent, Snapshot } from "xstate";
import { createSchemaCompiler, parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { LoadedBlueprint, VersionLoad } from "../blueprint-loader/index.ts";
import { ActorNotLoadedError } from "../router/index.ts";
import type { ActorRecord as RouterActorRecord, Router } from "../router/index.ts";
import type { DeliveryTarget, PersistedSnapshot } from "../store/index.ts";
import { isDeepStrictEqual } from "node:util";
import {
  activeEntries,
  activeInvokes,
  deadlineArms,
  deliverDeadline,
  machines,
} from "./entries.ts";
import { identityIndex } from "./identities.ts";
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
  heldTokens = () => [],
  probe,
}: ActorHostOptions): Promise<ActorHost> {
  const versions = new Map<string, VersionLoad>();
  const actors = new Map<string, ActorRecord>();
  const identities = identityIndex();
  const storedActors = store.activeSnapshots();
  for (const stored of storedActors) identities.saved(stored);
  const eventSchemas = new Map<string, Map<string, ReturnType<ActorHost["eventSchema"]>>>();
  const saves = new WeakMap<PersistedSnapshot, ActorSave>();
  let router: Router | undefined;
  let saving = false;
  let migrating: string | undefined;
  const listeners = new Set<(actorId: string) => void>();
  async function load(key: string) {
    const version = parseBlueprintVersionKey(key);
    versions.set(
      key,
      version ? await blueprints.version(version) : { status: "missing", reason: "file" },
    );
  }
  for (const key of [...new Set(storedActors.map((snapshot) => snapshot.machine))].sort())
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
    start = true,
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
      if (event.type === "@xstate.snapshot" && ref === record.root && "value" in event.snapshot) {
        const value = event.snapshot.value;
        if (record.stateValue !== undefined && !isDeepStrictEqual(record.stateValue, value))
          record.changedBy = {
            type: event.event.type,
            ...(record.deliveringEventId ? { eventId: record.deliveringEventId } : {}),
          };
        record.stateValue = value;
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
            // A completed or held actor can leave the router before this queued save.
            if (error instanceof ActorNotLoadedError) return;
            log({
              level: "error",
              event: "actor-save",
              message: error instanceof Error ? error.message : String(error),
              detail: { actorId },
            });
            throw error;
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
    if (start) root.start();
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
        record.eventId = row.eventId;
        record.deliveringEventId = row.eventId;
        try {
          if (row.topic.startsWith("deadline."))
            deliverDeadline(record, (row.payload as { type: string }).type);
          else record.root!.send(row.payload);
        } finally {
          delete record.deliveringEventId;
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
          ...(record.changedBy ? { changedBy: record.changedBy } : {}),
          ...(record.eventId ? { eventId: record.eventId } : {}),
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
        delete record.eventId;
        saves.set(snapshot, save);
        return {
          machine: record.blueprint.key,
          snapshot,
          deadlines: active ? deadlineArms(record, entries) : [],
        };
      },
    };
  }
  const compileSchema = createSchemaCompiler();
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
      identities.saved(stored);
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
      saving = true;
      try {
        for (const hook of saveHooks) hook(save);
      } finally {
        saving = false;
      }
    },
    actorOf(actorId) {
      const record = actors.get(actorId);
      if (!record?.root) return undefined;
      return {
        manifold: identityOf(record.root.getSnapshot()),
        commit: record.blueprint.version.commit,
      };
    },
    saved(actor) {
      identities.saved(actor);
      if (migrating === actor.actorId) probe?.("migrated", actor.actorId);
      if (actor.snapshot.status === "active")
        for (const listener of listeners) listener(actor.actorId);
    },
    onSaved(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async migrate(actorId, to) {
      const router = connected();
      if (saving || actors.get(actorId)?.sending)
        throw new TypeError("Migration inside a delivery or save");
      let stored = store.loadSnapshot(actorId);
      if (!stored || stored.snapshot.status !== "active") return { status: "ended" };
      const fromVersion = parseBlueprintVersionKey(stored.machine);
      if (fromVersion?.path !== to.version.path)
        throw new TypeError("Migration target must have the same path");
      if (stored.machine === to.key) return { status: "current" };
      const children = new Map<string, LoadedBlueprint>();
      let invalid: string | undefined;
      async function loadChildren(snapshot: Record<string, unknown>, prefix: string) {
        for (const [id, child] of Object.entries(
          (snapshot["children"] ?? {}) as Record<
            string,
            { src: string; snapshot: Record<string, unknown> }
          >,
        )) {
          if (!child.src.startsWith("blueprints/")) continue;
          const version = await blueprints.version({ ...to.version, path: child.src });
          if (version.status !== "loaded") {
            invalid = JSON.stringify(version);
            continue;
          }
          const key = `${prefix}${encodeURIComponent(id).replaceAll(".", "%2E").replaceAll("#", "%23")}#`;
          children.set(key, version.blueprint);
          await loadChildren(child.snapshot, key);
        }
      }
      const basis = JSON.stringify(stored);
      await loadChildren(stored.snapshot, "");
      // Re-read after the asynchronous version loads; all following work is synchronous.
      stored = store.loadSnapshot(actorId);
      if (!stored || stored.snapshot.status !== "active") return { status: "ended" };
      if (stored.machine === to.key) return { status: "current" };
      if (JSON.stringify(stored) !== basis) return { status: "deferred", reason: "unsaved-change" };
      const from = stored.machine;
      const failed = (
        kind: import("./types.ts").MigrationFailure["kind"],
        message: string,
        detail: import("./types.ts").MigrationFailure["detail"] = {},
      ) => ({ status: "failed" as const, failure: { kind, from, to: to.key, message, detail } });
      if (invalid)
        return failed("version-invalid", "Child blueprint cannot load", { cause: invalid });
      const previous = actors.get(actorId);
      if (!previous || router.held(actorId)) return { status: "deferred", reason: "held" };
      if (store.pendingInbox(actorId).length)
        return { status: "deferred", reason: "pending-events" };
      if (previous.queued) return { status: "deferred", reason: "unsaved-change" };
      for (const machine of machines(previous.root!)) {
        const blueprint = prefixOf(machine) ? children.get(prefixOf(machine))! : previous.blueprint;
        for (const child of Object.values(machine.getSnapshot().children) as AnyActorRef[]) {
          if (machineOf(child) || child.getSnapshot().status !== "active") continue;
          const node = nodesOf(machineOf(machine)!).find((node) =>
            node.invoke.some((invoke) => invoke.id === child.id),
          )!;
          const source = node.invoke.find((invoke) => invoke.id === child.id)!.src;
          if (typeof source !== "string" || blueprint.actorKinds[source] !== "callback")
            return { status: "deferred", reason: "promise-running" };
        }
      }
      const prepared = prepareMigration(stored.snapshot, to, children, heldTokens(actorId), now());
      if (!prepared.ok) return failed(prepared.kind, prepared.message, prepared.detail);
      const { entries, ...snapshot } = prepared.snapshot;
      const delivery = create(
        actorId,
        to,
        snapshot as Snapshot<unknown>,
        entries as EntryRecords,
        undefined,
        undefined,
        false,
      );
      try {
        migrating = actorId;
        versions.set(to.key, { status: "loaded", blueprint: to });
        router.attach(delivery);
      } catch (error) {
        delivery.stop?.();
        actors.set(actorId, previous);
        return failed("store", error instanceof Error ? error.message : String(error));
      } finally {
        migrating = undefined;
      }
      previous.stopped = true;
      previous.root!.stop();
      actors.get(actorId)!.root!.start();
      return {
        status: "migrated",
        from,
        to: to.key,
        ...(prepared.path === undefined ? {} : { path: prepared.path }),
      };
    },
    followers: identities.followers,
    followedThreads: identities.followedThreads,
    issueThreads: identities.issueThreads,
    eventSchema(actorId, eventType) {
      const key = actors.get(actorId)?.blueprint.key ?? store.loadSnapshot(actorId)?.machine;
      const version = key ? versions.get(key) : undefined;
      if (version?.status !== "loaded") return { status: "unavailable" };
      const cached =
        eventSchemas.get(key!) ?? new Map<string, ReturnType<ActorHost["eventSchema"]>>();
      eventSchemas.set(key!, cached);
      let answer = cached.get(eventType);
      if (!answer) {
        const schema = version.blueprint.document.schemas.events[eventType];
        answer =
          schema === undefined
            ? { status: "undeclared" }
            : { status: "declared", validate: compileSchema([schema])[0]! };
        cached.set(eventType, answer);
      }
      return answer;
    },
    async release(actorId) {
      const router = connected();
      const stored = store.loadSnapshot(actorId);
      if (stored) await load(stored.machine);
      router.release(actorId);
    },
  };
  return host;
}
