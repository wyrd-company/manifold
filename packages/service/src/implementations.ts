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
    [Kind in keyof ImplementationRegistry]: Record<string, ImplementationRegistry[Kind][string]>;
  };
  for (const part of Object.values(parts)) {
    for (const kind of ["actors", "actions", "guards", "delays"] as const) {
      for (const [name, implementation] of Object.entries(part[kind])) {
        if (Object.hasOwn(composed[kind], name))
          throw new TypeError(`Duplicate ${kind} implementation: ${name}`);
        Object.assign(composed[kind], { [name]: implementation });
      }
    }
  }
  return composed;
}
