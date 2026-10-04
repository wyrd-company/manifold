// ---
// relationships:
//   implements: actor-host
// ---
import type { AnyActorRef, AnyStateMachine } from "xstate";
import type { DeadlineArm } from "../store/index.ts";
import type { ActorRecord, EntryRecords } from "./records.ts";
import { encode, invocationOf, nodesOf, machineOf, prefixOf } from "./records.ts";
import type { ActiveInvoke } from "./types.ts";
export function machines(root: AnyActorRef): AnyActorRef[] {
  const tree: AnyActorRef[] = [];
  function visit(actor: AnyActorRef) {
    if (!machineOf(actor)) return;
    tree.push(actor);
    for (const child of Object.values(actor.getSnapshot().children) as AnyActorRef[]) visit(child);
  }
  visit(root);
  return tree;
}
export function activeEntries(record: ActorRecord): EntryRecords {
  const states: EntryRecords["states"] = {};
  for (const actor of machines(record.root!)) {
    for (const node of actor.getSnapshot()._nodes as AnyStateMachine["root"][]) {
      const path = `${prefixOf(actor)}${node.path.join(".")}`;
      const entry = record.entries.states[path];
      if (entry) states[path] = entry;
    }
  }
  return { count: record.entries.count, states };
}
export function deadlineArms(record: ActorRecord, entries: EntryRecords): DeadlineArm[] {
  const actors = new Map(machines(record.root!).map((actor) => [prefixOf(actor), actor]));
  return Object.entries(entries.states).flatMap(([path, entry]) => {
    const separator = path.lastIndexOf("#");
    let statePath = path;
    if (separator !== -1) {
      const firstId = decodeURIComponent(path.slice(0, path.indexOf("#")));
      const node = (record.root!.getSnapshot()._nodes as AnyStateMachine["root"][]).find((node) =>
        node.invoke.some((invoke) => invoke.id === firstId),
      )!;
      statePath = node.path.join(".");
    }
    // Only an active machine's own entries produce arms.
    if (!actors.has(separator === -1 ? "" : path.slice(0, separator + 1))) return [];
    return Object.entries(entry.deadlines).map(([key, fireAt]) => ({
      statePath,
      eventName: `${path}#${encode(key)}#${entry.id}`,
      fireAt,
      entryId: entry.id,
    }));
  });
}
export function activeInvokes(record: ActorRecord): ActiveInvoke[] {
  return machines(record.root!).flatMap((actor) =>
    (Object.values(actor.getSnapshot().children) as AnyActorRef[]).map((child) => {
      const { invokeId, entryId } = invocationOf({ self: child });
      return { invokeId, entryId };
    }),
  );
}
export function deliverDeadline(record: ActorRecord, name: string): void {
  const parts = name.split("#"),
    entryId = parts.pop()!,
    key = decodeURIComponent(parts.pop()!);
  const path = parts.join("#");
  if (record.entries.states[path]?.id !== entryId) return;
  const statePath = parts.pop()!;
  let actor = record.root!;
  for (const invoke of parts) {
    actor = actor.getSnapshot().children[decodeURIComponent(invoke)];
    if (!actor) return;
  }
  const node = nodesOf(machineOf(actor)!).find((node) => node.path.join(".") === statePath)!;
  actor.send({ type: `xstate.after.${key}.${node.id}` });
}
