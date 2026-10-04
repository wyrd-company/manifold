// ---
// relationships:
//   verifies: escalations
// ---
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { loadServiceConfiguration } from "../service-configuration/index.ts";
import { createHttpHost } from "../http-host/index.ts";
import { mountEscalations, escalationImplementations } from "./index.ts";
import { fixture, request } from "./test-support.ts";
test.each([true, false])(
  "real HTTP host mounts escalation answers and operator API (token configured: %s)",
  async (configured) => {
    const f = fixture();
    const file = join(f.directory, "service.yml");
    writeFileSync(join(f.directory, "token"), "synthetic-token");
    writeFileSync(
      file,
      `store:\n  file: state.sqlite\nprocessRepository:\n  url: https://example.test/recipes.git\n  directory: clone\nhttp:\n  port: 0\n${configured ? "  operatorCredential: operator\ncredentials:\n  operator:\n    kind: operator-token\n    tokenFile: token\n" : ""}`,
    );
    const configuration = await loadServiceConfiguration(file);
    const http = createHttpHost({
      configuration: configuration.http,
      credentials: configuration.credentials,
      onError: (error) => {
        throw error;
      },
    });
    try {
      mountEscalations(http, f.module);
      expect(escalationImplementations(f.module).actors["escalate"]).toBe(f.module.escalate);
      const escalation = f.module.raise(request);
      const address = await http.listen();
      const url = `http://${address.host}:${address.port}`;
      expect((await fetch(url + "/api/escalations")).status).toBe(configured ? 401 : 404);
      expect(
        (await fetch(url + "/api/escalations", { headers: { Authorization: "Bearer wrong" } }))
          .status,
      ).toBe(configured ? 401 : 404);
      const response = await fetch(url + "/api/escalations", {
        headers: { Authorization: "Bearer synthetic-token" },
      });
      expect(response.status).toBe(configured ? 200 : 404);
      if (configured)
        expect(await response.json()).toMatchObject({ escalations: [{ id: escalation.id }] });
      expect((await fetch(url + "/escalations/" + escalation.id + "?key=wrong")).status).toBe(404);
    } finally {
      await http.close();
      await f.close();
    }
  },
);
