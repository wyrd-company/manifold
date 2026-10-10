// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { environmentRow, environmentsCaption } from "./rows.ts";
import type { EnvironmentSummary } from "@wyrd-company/manifold-shared/environments-api";
const environment: EnvironmentSummary = {
  name: "site-a",
  host: "example.invalid",
  url: "ws://example.invalid",
  status: "connected",
  connection: "connected",
  paused: false,
  disconnected: false,
  activeThreads: 1,
  scheduledThreads: 2,
};
test("rows preserve connection, holds, errors and unknown counts", () => {
  for (const connection of ["connected", "connecting", "disconnected"] as const)
    for (const paused of [false, true])
      for (const disconnected of [false, true])
        for (const error of [undefined, "Unavailable"]) {
          const row = environmentRow({
            ...environment,
            connection,
            paused,
            disconnected,
            ...(error ? { error } : {}),
            activeThreads: null,
          });
          expect(row.status.label).toBe(
            connection === "connected"
              ? "Connected"
              : error
                ? "Error"
                : connection === "connecting"
                  ? "Connecting"
                  : "Disconnected",
          );
          expect(row.status.dot).toBe(
            connection === "connected" ? "connected" : error ? "error" : connection,
          );
          expect(row.pause.label).toBe(paused ? "Resume" : "Pause");
          expect(row.connection.label).toBe(
            connection === "disconnected" ? "Reconnect" : "Disconnect",
          );
          expect(row.status.paused).toBe(paused);
          expect(row.status.detail).toBe(connection === "connected" ? undefined : error);
          expect(row.activeThreads).toBe("—");
          expect(row.scheduledThreads).toBe(2);
          expect(row.pause.action).toBe(paused ? "resume" : "pause");
          expect(row.connection.action).toBe(
            connection === "disconnected" ? "reconnect" : "disconnect",
          );
        }
});
test("captions count connected and paused independently", () => {
  expect(environmentsCaption([])).toBe("0 environments · 0 connected · 0 paused");
  expect(environmentsCaption([environment])).toBe("1 environment · 1 connected · 0 paused");
  expect(
    environmentsCaption([
      environment,
      { ...environment, paused: true },
      { ...environment, connection: "disconnected" },
    ]),
  ).toBe("3 environments · 2 connected · 1 paused");
});

test("rows keep zero and populated thread counts", () => {
  expect(environmentRow({ ...environment, activeThreads: 0 }).activeThreads).toBe(0);
  expect(environmentRow(environment).activeThreads).toBe(1);
});
