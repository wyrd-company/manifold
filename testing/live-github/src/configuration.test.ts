// ---
// relationships:
//   verifies: live-github-environment
// ---
import { expect, test } from "vite-plus/test";
import { serviceConfiguration } from "./configuration.ts";
import type { Settings } from "./settings.ts";
const settings: Settings = {
  organization: "sample-org",
  marker: "owned",
  repository: "fixture-app",
  processRepository: "fixture-settings",
  project: "Fixture board",
  seedIssues: 2,
  credentials: {
    patFile: "/private/pat",
    pinggyTokenFile: "/private/tunnel",
    appEnvFile: "/private/app.env",
    appPrivateKeyFile: "/private/app.pem",
  },
  pinggyHost: "pro.pinggy.io",
  sweepIntervalMs: 60000,
};
test("generated boundaries win over overlay, with credentials by path and optional public answer URL", () => {
  const config = serviceConfiguration(
    settings,
    "/state",
    { hook: { id: 7 } },
    { appId: 2, installationId: 3 },
    {
      url: "https://example.test",
      answers: true,
      overlay: {
        http: { host: "0.0.0.0" },
        credentials: {
          "live-app": { kind: "wrong" },
          extra: { kind: "ntfy-token", tokenFile: "/private/ntfy" },
        },
        escalations: { destinations: {} },
      },
    },
  );
  expect(config["http"]).toEqual({ host: "127.0.0.1", port: 0 });
  expect(config["credentials"]).toMatchObject({
    "live-app": { kind: "github-app", privateKeyFile: "/private/app.pem" },
    extra: { kind: "ntfy-token" },
  });
  expect(config["escalations"]).toEqual({ destinations: {}, publicUrl: "https://example.test" });
  expect(JSON.stringify(config)).not.toContain("/private/pat");
  expect(
    serviceConfiguration(settings, "/state", { hook: { id: 7 } }, { appId: 2, installationId: 3 })[
      "escalations"
    ],
  ).toBeUndefined();
});
