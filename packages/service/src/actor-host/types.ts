// ---
// relationships:
//   implements: actor-host
// ---
import type { ManifoldIdentity } from "@wyrd-company/manifold-shared";
import type { BlueprintLoader, LoadedBlueprint } from "../blueprint-loader/index.ts";
import type { ActorHost as RouterActorHost } from "../router/index.ts";
import type { JsonValue, PersistedSnapshot, Store } from "../store/index.ts";
export interface ActorHostOptions {
  readonly store: Store;
  readonly blueprints: Pick<BlueprintLoader, "version">;
  readonly saveHooks: readonly SaveHook[];
  readonly log: (entry: {
    readonly level: "info" | "warn" | "error";
    readonly event: string;
    readonly message: string;
    readonly detail?: Readonly<Record<string, JsonValue>>;
  }) => void;
  readonly now?: () => number;
}
export interface ActorHost extends RouterActorHost {
  start(request: ActorStart): void;
  actorOf(
    actorId: string,
  ): { readonly manifold: ManifoldIdentity; readonly commit: string } | undefined;
  release(actorId: string): Promise<void>;
}
export interface ActorStart {
  readonly actorId: string;
  readonly blueprint: LoadedBlueprint;
  readonly input: { readonly manifold?: ManifoldIdentity; readonly [key: string]: unknown };
}
export interface Invocation {
  readonly actorId: string;
  readonly invokeId: string;
  readonly entryId: string;
}
export interface ActiveInvoke {
  readonly invokeId: string;
  readonly entryId: string;
}
export interface ActorSave {
  readonly actorId: string;
  readonly machine: string;
  readonly snapshot: PersistedSnapshot;
  readonly activeInvokes: readonly ActiveInvoke[];
  readonly entered: readonly string[];
  readonly entries: Readonly<Record<string, string>>;
}
export type SaveHook = (save: ActorSave) => void;
export class ActorStartError extends Error {
  readonly actorId: string;
  readonly issues: readonly { readonly path: string; readonly message: string }[];
  constructor(
    actorId: string,
    issues: readonly { readonly path: string; readonly message: string }[],
  ) {
    super(
      `Actor ${actorId} input is invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    );
    this.actorId = actorId;
    this.issues = issues;
    this.name = "ActorStartError";
  }
}
