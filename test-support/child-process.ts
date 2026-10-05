// ---
// relationships:
//   verifies: [service-assembly, host-cli-usage]
// ---
import { inject } from "vite-plus/test";

export interface ChildArtifacts {
  service: string;
  host: string;
  blueprint: string;
}

declare module "vite-plus/test" {
  interface ProvidedContext {
    childArtifacts: ChildArtifacts;
  }
}

export const childArtifacts = () => inject("childArtifacts");
