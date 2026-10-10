// ---
// relationships:
//   implements: retention
// ---
import {
  pruneDeliveries,
  pruneRedeliveries,
  cardMoveActors,
  pruneCardMoves,
} from "../github-source/index.ts";
import { prunableEscalations, pruneEscalation } from "../escalations/index.ts";
import { pruneAnswer, prunableMessages, pruneMessages } from "../agent-tools/index.ts";
import { retirableCreatedProjects, retireCreatedProject } from "../t3code-source/index.ts";
import type { CreatedProjectKey } from "../t3code-source/index.ts";
import type { Store } from "../store/index.ts";
import type { PruneResult, RetentionOptions } from "./types.ts";
import { mayPruneEscalation } from "./protections.ts";
interface Batches {
  readonly store: Store;
  readonly result: { -readonly [K in keyof PruneResult]: PruneResult[K] };
  readonly stopped: () => boolean;
  readonly next: () => Promise<void>;
  readonly kept: () => { actors: ReadonlySet<string>; gates: ReadonlySet<string> };
  readonly probe: RetentionOptions["probe"];
}
export async function deliveries(b: Batches, cutoff: number) {
  for (const kind of ["deliveries", "redeliveries"] as const)
    for (;;) {
      if (b.stopped()) break;
      b.kept();
      const count =
        kind === "deliveries"
          ? pruneDeliveries(b.store.connection, { receivedBefore: cutoff, limit: 1000 })
          : pruneRedeliveries(b.store.connection, { requestedBefore: cutoff, limit: 1000 });
      b.result[kind] += count;
      if (count) b.probe?.("batch-pruned", kind);
      await b.next();
      if (count < 1000) break;
    }
}
// The sentinel rolls back an answer delete when the escalation's live guard keeps it.
const keptEscalation = Symbol("kept escalation");
export async function closedEscalations(b: Batches, cutoff: number) {
  let after: string | undefined;
  for (;;) {
    if (b.stopped()) break;
    const candidates = prunableEscalations(b.store.connection, {
      closedBefore: cutoff,
      ...(after ? { after } : {}),
      limit: 100,
    });
    const keep = b.kept();
    for (const candidate of candidates) {
      if (
        !mayPruneEscalation(
          candidate,
          candidate.actorId ? b.store.loadSnapshot(candidate.actorId) : undefined,
          keep.actors,
        )
      )
        continue;
      try {
        const outcome = b.store.connection.transaction(() => {
          const answer = pruneAnswer(b.store.connection, candidate.escalationId);
          if (answer === "kept") return undefined;
          const escalation = pruneEscalation(b.store.connection, candidate.escalationId);
          if (escalation === "kept") throw keptEscalation;
          return { answers: answer.answers, notifications: escalation.notifications };
        });
        if (outcome) {
          b.result.escalations++;
          b.result.answers += outcome.answers;
          b.result.notifications += outcome.notifications;
          b.probe?.("escalation-pruned", candidate.escalationId);
        }
      } catch (error) {
        if (error !== keptEscalation) throw error;
      }
    }
    after = candidates.at(-1)?.escalationId;
    await b.next();
    if (candidates.length < 100) break;
  }
}
export async function messages(b: Batches, cutoff: number) {
  let after: number | undefined;
  for (;;) {
    if (b.stopped()) break;
    b.kept();
    const candidates = prunableMessages(b.store.connection, {
      readBefore: cutoff,
      ...(after === undefined ? {} : { after }),
      limit: 1000,
    });
    const sequences = candidates
      .filter(
        (row) =>
          b.store.loadSnapshot(row.senderActorId)?.historyPrunedAt !== undefined &&
          b.store.loadSnapshot(row.readerActorId)?.historyPrunedAt !== undefined,
      )
      .map((row) => row.sequence);
    const count = pruneMessages(b.store.connection, sequences);
    b.result.messages += count;
    if (count) b.probe?.("batch-pruned", "messages");
    after = candidates.at(-1)?.sequence;
    await b.next();
    if (candidates.length < 1000) break;
  }
}
export async function cardMoves(b: Batches) {
  let after: string | undefined;
  for (;;) {
    if (b.stopped()) break;
    b.kept();
    const actors = cardMoveActors(b.store.connection, { ...(after ? { after } : {}), limit: 100 });
    const count = pruneCardMoves(
      b.store.connection,
      actors.filter((actorId) => b.store.loadSnapshot(actorId)?.historyPrunedAt !== undefined),
    );
    b.result.cardMoves += count;
    if (count) b.probe?.("batch-pruned", "card-moves");
    after = actors.at(-1);
    await b.next();
    if (actors.length < 100) break;
  }
}
export async function createdProjects(b: Batches, environments: readonly string[]) {
  let after: CreatedProjectKey | undefined;
  for (;;) {
    if (b.stopped()) break;
    b.kept();
    const candidates = retirableCreatedProjects(b.store.connection, {
      environments,
      ...(after ? { after } : {}),
      limit: 100,
    });
    for (const candidate of candidates) {
      if (b.store.loadSnapshot(candidate.actorId)?.historyPrunedAt === undefined) continue;
      if (retireCreatedProject(b.store.connection, candidate, { environments }) === "retired") {
        b.result.createdProjects++;
        b.probe?.("project-retired", `${candidate.environment}/${candidate.projectId}`);
      }
    }
    after = candidates.at(-1);
    await b.next();
    if (candidates.length < 100) break;
  }
}
