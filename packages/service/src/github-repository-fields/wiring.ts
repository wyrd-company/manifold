// ---
// relationships:
//   implements: service-assembly
// ---
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import { createRepositoryFields } from "./index.ts";
export const repositoryFields = wiringPart({
  name: "github-repository-fields",
  start: (members: Required<Pick<Service, "configuration">>, context) => {
    const githubRepositoryFields = createRepositoryFields({
      configuration: members.configuration.github,
      credentials: members.configuration.credentials,
    });
    context.onStop("sources", () => githubRepositoryFields.stop());
    return { githubRepositoryFields };
  },
});
