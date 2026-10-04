// ---
// relationships:
//   implements: escalations
// ---
import { readFile } from "node:fs/promises";
import type { EscalationsOptions } from "./types.ts";
import type { EscalationRows } from "./rows.ts";
export function notificationSender(
  options: EscalationsOptions,
  rows: EscalationRows,
  now: () => number,
) {
  const { store, configuration, logger } = options;
  const fetch = options.fetch ?? globalThis.fetch;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let job: Promise<void> | undefined;
  const controller = new AbortController();
  async function request(url: string, init: RequestInit) {
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(configuration.requestTimeoutMs),
    ]);
    const response = await fetch(url, { ...init, signal, redirect: "error" });
    // No response payload is retained or logged; ntfy may echo addresses and tokens.
    await response.body?.cancel();
    return response.status;
  }
  async function checkPostures() {
    for (const [name, destination] of Object.entries(configuration.destinations)) {
      if (controller.signal.aborted) return;
      if (destination.posture === "open") {
        logger?.warn(
          `Notification destination ${name}: anyone who knows its topic can read and answer questions`,
        );
        if (destination.topic.length < 32)
          logger?.warn(
            `Notification destination ${name}: topic name is shorter than 32 characters`,
          );
        continue;
      }
      if (
        destination.posture === "self-hosted" &&
        new URL(destination.server).origin === "https://ntfy.sh"
      )
        logger?.warn(
          `Notification destination ${name}: self-hosted posture uses the hosted service`,
        );
      try {
        const status = await request(
          destination.server.replace(/\/$/, "") + "/" + destination.topic + "/json?poll=1",
          {},
        );
        if (status === 200)
          logger?.warn(`Notification destination ${name}: topic is readable without a credential`);
        else if (status !== 401 && status !== 403)
          logger?.warn(`Notification destination ${name}: posture check status ${status}`);
      } catch {
        if (!controller.signal.aborted)
          logger?.warn(`Notification destination ${name}: posture check unavailable`);
      }
    }
  }
  async function sendDue() {
    while (!controller.signal.aborted) {
      const row = rows.due();
      if (!row) return;
      const destination = configuration.destinations[row.destination];
      if (!destination) {
        store.connection.database
          .prepare(
            "UPDATE escalation_notification SET status='failed',message=NULL,settled_at=?,last_error='unknown destination' WHERE notification_id=? AND status='pending'",
          )
          .run(now(), row.notification_id);
        logger?.error(`Notification destination ${row.destination}: unknown destination`);
        continue;
      }
      store.connection.transaction(() =>
        store.connection.database
          .prepare(
            "UPDATE escalation_notification SET attempts=attempts+1 WHERE notification_id=? AND status='pending'",
          )
          .run(row.notification_id),
      );
      let status: number | undefined;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (destination.credential)
          headers["Authorization"] =
            "Bearer " + (await readFile(options.tokenFile(destination.credential), "utf8")).trim();
        if (!running) return;
        status = await request(destination.server.replace(/\/$/, "") + "/", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...(JSON.parse(row.message) as Record<string, unknown>),
            topic: destination.topic,
            sequence_id: row.escalation_id,
          }),
        });
      } catch {
        /* All request errors are transient; their text may expose credentials. */
      }
      if (!running) return;
      store.connection.transaction(() => {
        if (status !== undefined && status >= 200 && status < 300)
          store.connection.database
            .prepare(
              "UPDATE escalation_notification SET status='sent',message=NULL,settled_at=?,last_error=NULL WHERE notification_id=? AND status='pending'",
            )
            .run(now(), row.notification_id);
        else if (status === undefined || status === 429 || status >= 500)
          store.connection.database
            .prepare(
              "UPDATE escalation_notification SET next_attempt_at=?,last_error=? WHERE notification_id=? AND status='pending'",
            )
            .run(
              now() + configuration.retryIntervalMs,
              status === undefined ? "unavailable" : String(status),
              row.notification_id,
            );
        else {
          store.connection.database
            .prepare(
              "UPDATE escalation_notification SET status='failed',message=NULL,settled_at=?,last_error=? WHERE notification_id=? AND status='pending'",
            )
            .run(now(), String(status), row.notification_id);
          logger?.error(`Notification destination ${row.destination}: status ${status}`);
        }
      });
    }
  }
  function arm() {
    if (!running || job) return;
    if (timer !== undefined) clearTimeout(timer);
    const next = rows.next();
    if (next === null || next === undefined) {
      timer = undefined;
      return;
    }
    timer = setTimeout(
      () => {
        timer = undefined;
        job = sendDue().finally(() => {
          job = undefined;
          arm();
        });
      },
      Math.max(0, next - now()),
    );
    timer.unref();
  }
  return {
    wake: arm,
    start() {
      if (running) return;
      running = true;
      job = checkPostures()
        .then(sendDue)
        .finally(() => {
          job = undefined;
          arm();
        });
    },
    async stop() {
      running = false;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
      await job;
    },
  };
}
