// ---
// relationships:
//   implements: environment-control
// ---
import type { HttpListener } from "../http-host/index.ts";
import type { Router } from "../router/index.ts";
import type { Store } from "../store/index.ts";
import type {
  EnvironmentHold,
  EnvironmentHolds,
  EnvironmentStatus,
  EnvironmentsConfiguration,
} from "../t3code-source/index.ts";
export type EnvironmentAction = "pause" | "resume" | "disconnect" | "reconnect";
export interface EnvironmentsOptions {
  readonly store: Store;
  readonly router: Router;
  readonly environments: EnvironmentsConfiguration;
  readonly configurationFile: string;
  readonly status: () => readonly EnvironmentStatus[];
  readonly restart: (environment: string) => void;
  readonly scheduled: (environment: string) => number;
  readonly clock?: () => number;
}
export interface Environments extends EnvironmentHolds {
  act(environment: string, action: EnvironmentAction): EnvironmentHold;
  readonly requestListener: HttpListener;
}
