// ---
// relationships:
//   verifies: live-github-environment
// ---
import { expect, test } from "vite-plus/test";
import { serviceConfiguration, servicePort } from "./configuration.ts";
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
test("a fixed service port stays on loopback and wins over the overlay", () => {
  const config = serviceConfiguration(
    settings,
    "/state",
    { hook: { id: 7 } },
    { appId: 2, installationId: 3 },
    { port: 47480, overlay: { http: { host: "0.0.0.0", port: 9 } } },
  );
  expect(config["http"]).toEqual({ host: "127.0.0.1", port: 47480 });
});
test("SERVICE_PORT is absent for an ephemeral port, or a whole port number", () => {
  expect(servicePort(undefined)).toBeUndefined();
  expect(servicePort("")).toBeUndefined();
  expect(servicePort("47480")).toBe(47480);
  for (const value of ["0", "65536", "-1", "80.5", "port", " 47480"])
    expect(() => servicePort(value)).toThrow("SERVICE_PORT must be a port number from 1 to 65535");
});
