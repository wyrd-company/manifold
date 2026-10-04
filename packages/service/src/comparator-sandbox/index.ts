// ---
// relationships:
//   implements: comparator-sandbox
//   references: comparator-contract
// ---
import { readFile } from "node:fs/promises";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newVariant, newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import type {
  ComparatorInput,
  ComparatorSelection,
} from "@wyrd-company/manifold-shared/comparator.d.ts";
import { transpileComparator } from "./transpile.ts";
import { evaluateScope } from "./evaluate.ts";

export interface ComparatorSandboxLimits {
  readonly timeoutMs: number;
  readonly memoryLimitMiB: number;
}
export const comparatorSandboxDefaults: ComparatorSandboxLimits = Object.freeze({
  timeoutMs: 100,
  memoryLimitMiB: 32,
});
export interface ComparatorSource {
  readonly name: string;
  readonly text: string;
}
export type ComparatorInputData = Omit<ComparatorInput, "random">;
export interface ComparatorFailure {
  readonly kind:
    | "transpile"
    | "module"
    | "timeout"
    | "memory"
    | "thrown"
    | "invalid-output"
    | "engine";
  readonly message: string;
}
export type ComparatorEvaluation = (
  | { readonly ok: true; readonly selection: ComparatorSelection | null }
  | { readonly ok: false; readonly failure: ComparatorFailure }
) & { readonly durationMs: number };
export type ComparatorLoad =
  | { readonly ok: true; readonly comparator: LoadedComparator }
  | { readonly ok: false; readonly failure: ComparatorFailure };
export interface LoadedComparator {
  evaluate(input: ComparatorInputData, seed: number): ComparatorEvaluation;
  dispose(): void;
}
export interface ComparatorSandbox {
  load(source: ComparatorSource): Promise<ComparatorLoad>;
}

export async function createComparatorSandbox(
  overrides: Partial<ComparatorSandboxLimits> = {},
): Promise<ComparatorSandbox> {
  const limits = { ...comparatorSandboxDefaults, ...overrides };
  if (!Number.isInteger(limits.timeoutMs) || limits.timeoutMs < 1)
    throw new RangeError("timeoutMs must be an integer of at least 1");
  if (
    !Number.isInteger(limits.memoryLimitMiB) ||
    limits.memoryLimitMiB < 8 ||
    limits.memoryLimitMiB > 1024
  )
    throw new RangeError("memoryLimitMiB must be an integer from 8 to 1024");
  const wasm = await WebAssembly.compile(
    await readFile(new URL(import.meta.resolve("@jitl/quickjs-wasmfile-release-sync/wasm"))),
  );
  return {
    async load(source) {
      try {
        const compiled = transpileComparator(source);
        if (!compiled.ok) return compiled;
        let module: QuickJSWASMModule | undefined = await newQuickJSWASMModuleFromVariant(
          // The variant ships CJS-shaped declarations for its ESM default.
          newVariant(variant as unknown as typeof variant.default, {
            wasmModule: wasm,
            wasmMemory: new WebAssembly.Memory({
              initial: 256,
              maximum: limits.memoryLimitMiB * 32,
            }),
          }),
        );
        const probe = evaluateScope(module, source, compiled.code, limits);
        if (!probe.ok)
          return {
            ok: false,
            failure: {
              ...probe.failure,
              kind: probe.failure.kind === "thrown" ? "module" : probe.failure.kind,
            },
          };
        let instance: QuickJSWASMModule | undefined = module;
        module = undefined;
        let spent: ComparatorFailure | undefined;
        return {
          ok: true,
          comparator: {
            evaluate(input, seed) {
              if (!instance) throw new Error("Comparator is disposed");
              if (spent) return { ok: false, failure: spent, durationMs: 0 };
              const result = evaluateScope(
                instance,
                source,
                compiled.code,
                limits,
                input,
                seed,
                (failure) => {
                  spent = failure;
                },
              );
              return result;
            },
            dispose() {
              instance = undefined;
            },
          },
        };
      } catch (error) {
        return {
          ok: false,
          failure: { kind: "engine", message: `${source.name}: ${String(error)}` },
        };
      }
    },
  };
}
