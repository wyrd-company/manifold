// ---
// relationships:
//   implements: live-github-environment
// ---
import type { SmokeStep } from "./secrets.ts";
export type SmokeBoundary = {
  configuration: () => Promise<void>;
  createItem: (step: "delivery" | "sweep") => Promise<string>;
  delivery: (issue: string) => Promise<{ guid: string; accepted: boolean } | undefined>;
  recorded: (guid: string) => Promise<boolean>;
  actor: (issue: string) => Promise<boolean>;
  setHook: (active: boolean) => Promise<void>;
  hookActive: () => Promise<boolean>;
  hasDelivery: (issue: string) => Promise<boolean>;
  paths: () => Promise<void>;
  wait: (probe: () => Promise<boolean>, limit: number) => Promise<void>;
};
export function smokeSteps(boundary: SmokeBoundary, sweepIntervalMs = 60000): SmokeStep[] {
  let delivered: string | undefined;
  return [
    {
      name: "Configuration",
      run: async () => {
        await boundary.configuration();
        return "App credentials by file; service holds no PAT";
      },
    },
    {
      name: "Delivery",
      run: async () => {
        delivered = await boundary.createItem("delivery");
        await boundary.wait(async () => {
          const delivery = await boundary.delivery(delivered!);
          return !!delivery?.accepted && (await boundary.recorded(delivery.guid));
        }, 60000);
        return "GitHub accepted delivery is recorded in service store";
      },
    },
    {
      name: "Intake",
      run: async () => {
        if (!delivered) throw new Error("delivery issue unavailable");
        await boundary.wait(() => boundary.actor(delivered!), 60000);
        return "task actor observed through loopback API";
      },
    },
    {
      name: "Sweep",
      run: async () => {
        try {
          await boundary.setHook(false);
          if (await boundary.hookActive()) throw new Error("hook remains active");
          const issue = await boundary.createItem("sweep");
          await boundary.wait(() => boundary.actor(issue), 2 * sweepIntervalMs + 60000);
          if (await boundary.hasDelivery(issue)) throw new Error("sweep item received a delivery");
          return "task actor observed without webhook delivery";
        } finally {
          await boundary.setHook(true);
        }
      },
    },
    {
      name: "Tunnel paths",
      run: async () => {
        await boundary.paths();
        return "only enabled webhook and answer paths reach service";
      },
    },
  ];
}
