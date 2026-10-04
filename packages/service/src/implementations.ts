// ---
// relationships:
//   implements: [blueprint-loader, actor-host]
// ---
import type { ImplementationRegistry } from "./blueprint-loader/index.ts";
export interface ServiceImplementationParts {
  readonly [module: string]: ImplementationRegistry;
}
export function serviceImplementations(
  parts: ServiceImplementationParts = {},
): ImplementationRegistry {
  const composed = { actors: {}, actions: {}, guards: {}, delays: {} } as {
    [Kind in "actors" | "actions" | "guards" | "delays"]: Record<
      string,
      ImplementationRegistry[Kind][string]
    >;
  } & { raises?: Record<string, readonly string[]> };
  for (const part of Object.values(parts)) {
    for (const kind of ["actors", "actions", "guards", "delays"] as const) {
      for (const [name, implementation] of Object.entries(part[kind])) {
        if (Object.hasOwn(composed[kind], name))
          throw new TypeError(`Duplicate ${kind} implementation: ${name}`);
        Object.assign(composed[kind], { [name]: implementation });
      }
    }
    if (part.raises !== undefined) {
      composed.raises ??= {};
      for (const [name, events] of Object.entries(part.raises)) {
        if (Object.hasOwn(composed.raises, name))
          throw new TypeError(`Duplicate raises declaration: ${name}`);
        Object.assign(composed.raises, { [name]: events });
      }
    }
  }
  return composed;
}
