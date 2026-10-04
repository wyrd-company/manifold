// ---
// relationships:
//   implements: actor-host
// ---
import type { Actor, AnyActorLogic, AnyActorRef, AnyStateMachine } from "xstate";
import type { LoadedBlueprint, StateEntry } from "../blueprint-loader/index.ts";
import type { Invocation } from "./types.ts";
export interface StateEntryRecord {
  id: string;
  deadlines: Record<string, number>;
}
export interface EntryRecords {
  count: number;
  states: Record<string, StateEntryRecord>;
}
export interface ActorRecord {
  actorId: string;
  blueprint: LoadedBlueprint;
  root?: AnyActorRef;
  entries: EntryRecords;
  entered: { path: string; id: number }[];
  sending: boolean;
  queued: boolean;
  stopped: boolean;
}
export const records = new WeakMap<AnyActorRef["system"], ActorRecord>();
export const encode = (value: string) =>
  encodeURIComponent(value).replaceAll(".", "%2E").replaceAll("#", "%23");
export function prefixOf(actor: AnyActorRef): string {
  const ids: string[] = [];
  for (let current = actor; current._parent; current = current._parent)
    ids.unshift(encode(current.id));
  return ids.map((id) => `${id}#`).join("");
}
export function recordStateEntry({ actor, statePath }: StateEntry): void {
  const record = records.get(actor.system);
  if (!record) return;
  const id = ++record.entries.count;
  record.entries.states[`${prefixOf(actor)}${statePath}`] = { id: String(id), deadlines: {} };
  if (!actor._parent && statePath !== "") record.entered.push({ path: statePath, id });
}
export function machineOf(actor: AnyActorRef): AnyStateMachine | undefined {
  const logic = (actor as Actor<AnyActorLogic>).logic;
  return "root" in logic ? (logic as AnyStateMachine) : undefined;
}
export function invocationOf({ self }: { readonly self: AnyActorRef }): Invocation {
  const record = records.get(self.system),
    parent = self._parent;
  if (!record || !parent) throw new TypeError("Actor was not created by the actor host");
  const node = (parent.getSnapshot()._nodes as AnyStateMachine["root"][]).find((state) =>
    state.invoke.some((invoke) => invoke.id === self.id),
  );
  const entry = node && record.entries.states[`${prefixOf(parent)}${node.path.join(".")}`];
  if (!entry) throw new TypeError(`Invoke ${self.id} has no state entry`);
  return { actorId: record.actorId, invokeId: self.id, entryId: entry.id };
}

export function nodesOf(machine: AnyStateMachine): AnyStateMachine["root"][] {
  const nodes: AnyStateMachine["root"][] = [];
  function visit(node: AnyStateMachine["root"]) {
    nodes.push(node);
    for (const child of Object.values(node.states)) visit(child);
  }
  visit(machine.root);
  return nodes;
}
