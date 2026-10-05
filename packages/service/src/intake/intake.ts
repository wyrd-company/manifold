// ---
// relationships:
//   implements: intake
// ---
import type { GitHubIssue } from "../github-source/index.ts";
import { ActorStartError } from "../actor-host/index.ts";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import { IntakeError } from "./types.ts";
import type {
  Intake,
  IntakeOptions,
  IntakeRecord,
  IntakeFailure,
  IntakeStartFailure,
} from "./types.ts";
import { records } from "./records.ts";
import { modelCache } from "./models.ts";
import { decide, failure, inputErrors, inputIssues } from "./decide.ts";
import { intakeFailureQuestion } from "./escalation.ts";
import { decisionInput, taskInput, json, issueDigest } from "./inputs.ts";
export function startIntake(options: IntakeOptions): Intake {
  const rows = records(options.store),
    models = modelCache(options.createModels);
  const queued = new Set<string>();
  let stopped = false;
  let running: Promise<void> | undefined;
  let wakeRequested = false;
  const notifyFailure = (step: "failed" | "start-failed", id: string) => {
    options.probe?.(step, id);
    options.onFailed?.(rows.get(id)!);
  };
  function withdraw(id: string) {
    options.escalations.withdraw({ kind: "intake-failed", subject: { issue: id } });
  }
  function raise(
    record: IntakeRecord,
    previous: IntakeRecord | undefined,
    issue: GitHubIssue | undefined,
  ) {
    const before = previous?.failure ?? previous?.startFailure;
    const after = record.failure ?? record.startFailure!;
    if (before && before.kind !== after.kind) withdraw(record.issueNodeId);
    options.escalations.raise(intakeFailureQuestion(record, issue));
  }
  function started(id: string) {
    options.store.connection.transaction(() => {
      rows.started(id);
      withdraw(id);
    });
  }
  function startFailure(id: string, value: IntakeStartFailure) {
    options.store.connection.transaction(() => {
      const previous = rows.get(id);
      rows.failedStart(id, value);
      raise(rows.get(id)!, previous, options.tracked.trackedIssue(id)?.issue);
    });
    notifyFailure("start-failed", id);
  }
  async function start(record: IntakeRecord) {
    const id = record.issueNodeId;
    if (options.store.loadSnapshot(record.actorId)) {
      started(id);
      options.probe?.("started", id);
      return;
    }
    let loaded;
    try {
      loaded = await options.blueprints.version(
        parseBlueprintVersionKey(record.blueprintVersion!)!,
      );
    } catch (error) {
      throw new IntakeError("read", id, error);
    }
    if (loaded.status !== "loaded") {
      startFailure(id, {
        kind: "version-unavailable",
        message: "Recorded blueprint is unavailable.",
        detail: json({
          version: record.blueprintVersion,
          reason: loaded.status === "missing" ? loaded.reason : loaded.findings,
        }),
      });
      return;
    }
    if (options.store.loadSnapshot(record.actorId)) {
      started(id);
      options.probe?.("started", id);
      return;
    }
    const issue = options.tracked.trackedIssue(id);
    if (!issue || !issue.items.some((i) => i.project.nodeId === record.project!.nodeId)) return;
    const evaluation = record.evaluation as { result?: { data?: unknown } };
    const input = taskInput(issue, record, evaluation.result?.data);
    const errors = inputErrors(loaded.blueprint, input, record.actorId);
    if (errors) {
      startFailure(id, {
        kind: "input-invalid",
        message: "Recorded blueprint refuses task input.",
        detail: json({ errors }),
      });
      return;
    }
    try {
      options.actors.start({ actorId: record.actorId, blueprint: loaded.blueprint, input });
    } catch (error) {
      if (error instanceof ActorStartError) {
        startFailure(id, {
          kind: "input-invalid",
          message: "Recorded blueprint refuses task input.",
          detail: json({ errors: inputIssues(error) }),
        });
        return;
      }
      throw new IntakeError("start", id, error);
    }
    started(id);
    options.probe?.("started", id);
  }
  async function take(id: string) {
    const previous = rows.get(id);
    if (previous?.status === "started") return;
    if (previous?.status === "recorded") {
      await start(previous);
      return;
    }
    const basis = options.current();
    if (!basis) return;
    const issue = options.tracked.trackedIssue(id);
    if (!issue) return;
    const digest = issueDigest(issue);
    if (previous?.commit === basis.revision.commit && previous.issueDigest === digest) return;
    const declaration = basis.portfolio.declaration;
    const bindings = declaration.githubProjects
      .flatMap((binding) => {
        const item = issue.items.find(
          (i) =>
            i.project.owner.toLowerCase() === binding.owner.toLowerCase() &&
            i.project.number === binding.number,
        );
        return item ? [{ binding, project: item.project }] : [];
      })
      .sort((a, b) => {
        const left = Array.from(a.binding.name, (c) => c.codePointAt(0)!),
          right = Array.from(b.binding.name, (c) => c.codePointAt(0)!);
        for (let i = 0; i < Math.min(left.length, right.length); i++)
          if (left[i] !== right[i]) return left[i]! - right[i]!;
        return left.length - right.length;
      });
    const chosen = bindings.find((b) => !b.binding.archived);
    const now = Date.now();
    let record: IntakeRecord = {
      issueNodeId: id,
      status: "failed",
      commit: basis.revision.commit,
      binding: chosen?.binding.name ?? null,
      project: chosen?.project ?? null,
      environment: chosen?.binding.environment ?? null,
      blueprintPath: null,
      blueprintVersion: null,
      portfolioItem: null,
      portfolioCommit: null,
      actorId: `task:${id}`,
      failure: null,
      evaluation: null,
      issueDigest: digest,
      attempts: (previous?.attempts ?? 0) + 1,
      startFailure: null,
      startAttempts: 0,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    const fail = (value: IntakeFailure) => {
      let changed = false;
      options.store.connection.transaction(() => {
        const failed = { ...record, status: "failed" as const, failure: value };
        rows.decide(failed);
        const currentIssue = options.tracked.trackedIssue(id);
        if (!currentIssue) withdraw(id);
        else if (issueDigest(currentIssue) !== digest) changed = true;
        else raise(failed, previous, currentIssue.issue);
      });
      if (changed) {
        queued.add(id);
        wakeRequested = true;
      }
      notifyFailure("failed", id);
    };
    if (!chosen) {
      fail(
        bindings.length
          ? failure("binding-archived", { bindings: bindings.map((b) => b.binding.name) })
          : failure("binding-missing", {}),
      );
      return;
    }
    // Capture all decision inputs before the first await. A later revision or
    // mirror update belongs only to a later attempt or to the start step.
    const input = decisionInput(issue, chosen.binding, declaration, chosen.project.nodeId);
    let cached;
    try {
      cached = await models.get(basis.revision);
    } catch (error) {
      throw new IntakeError("read", id, error);
    }
    if (!cached.ok) {
      fail(failure("manifest", { findings: cached.findings }));
      return;
    }
    const evaluation = await cached.models.evaluate(cached.key, input);
    record = { ...record, evaluation: json(evaluation) };
    if (evaluation.outcome === "error") {
      fail(failure("decision-model", evaluation.error));
      return;
    }
    const decision = decide(evaluation.result, chosen.binding, declaration, basis.blueprints);
    if ("kind" in decision) {
      fail(decision);
      return;
    }
    record = {
      ...record,
      status: "recorded",
      blueprintPath: decision.blueprint.version.path,
      blueprintVersion: decision.blueprint.key,
      portfolioItem: decision.item,
      portfolioCommit: basis.portfolio.commit,
    };
    const errors = inputErrors(
      decision.blueprint,
      taskInput(issue, record, decision.data),
      record.actorId,
    );
    if (errors) {
      fail(failure("input-invalid", { errors }));
      return;
    }
    options.store.connection.transaction(() => {
      rows.decide(record);
      withdraw(id);
    });
    options.probe?.("recorded", id);
    await start(record);
  }
  async function run() {
    while (wakeRequested) {
      if (stopped) return;
      wakeRequested = false;
      const batch = [...queued];
      queued.clear();
      for (const id of batch) {
        if (stopped) break;
        if (!options.current()) {
          queued.add(id);
          continue;
        }
        try {
          await take(id);
        } catch (error) {
          queued.add(id);
          options.onError?.(
            error instanceof IntakeError ? error : new IntakeError("store", id, error),
          );
          if (!(error instanceof IntakeError)) {
            for (const pending of batch.slice(batch.indexOf(id) + 1)) queued.add(pending);
            return;
          }
        }
      }
    }
  }
  function wake() {
    wakeRequested = true;
    if (!running && !stopped)
      running = Promise.resolve()
        .then(run)
        .finally(() => {
          models.retain(options.current()?.revision.commit);
          running = undefined;
          if (wakeRequested && !stopped) wake();
        });
  }
  function checkRecords() {
    const basis = options.current();
    for (const record of rows.unfinished()) {
      const issue = options.tracked.trackedIssue(record.issueNodeId);
      if (!issue) withdraw(record.issueNodeId);
      else if (
        record.status === "failed" &&
        basis &&
        (record.commit !== basis.revision.commit || record.issueDigest !== issueDigest(issue))
      )
        queued.add(record.issueNodeId);
    }
  }
  function reconcile() {
    const basis = options.current();
    for (const id of options.tracked.trackedIssueIds()) {
      const record = rows.get(id);
      if (
        !record ||
        record.status === "recorded" ||
        (record.status === "failed" && basis && record.commit !== basis.revision.commit)
      )
        queued.add(id);
    }
    for (const id of rows.pending()) queued.add(id);
    checkRecords();
    wake();
  }
  reconcile();
  return {
    discovered(ids) {
      if (stopped) throw new TypeError("Intake is stopped");
      for (const id of ids) queued.add(id);
      wake();
    },
    revisionLoaded() {
      if (stopped) throw new TypeError("Intake is stopped");
      reconcile();
    },
    mirrorChanged() {
      if (stopped) throw new TypeError("Intake is stopped");
      checkRecords();
      wake();
    },
    record: rows.get,
    async idle() {
      for (;;) {
        const active = running;
        if (!active) return;
        await active;
      }
    },
    async stop() {
      stopped = true;
      queued.clear();
      await running;
      models.dispose();
    },
  };
}
