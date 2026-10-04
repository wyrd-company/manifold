// ---
// relationships:
//   verifies: expressions
// ---
import { workerData } from "node:worker_threads";
import type { ExpressionWorkerData } from "../expression-worker-channel.ts";
import { serveExpressionWorker } from "../expression-worker-channel.ts";
serveExpressionWorker(async (request) => {
  const { operation, value, signal } = request as {
    operation: string;
    value?: unknown;
    signal?: SharedArrayBuffer;
  };
  if (operation === "stale")
    // MessagePort uses the worker_threads API, which has no targetOrigin.
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    (workerData as ExpressionWorkerData).port.postMessage({ sequence: -1, value: "stale" });
  if (operation === "exit") process.exit(7);
  if (operation === "late") await new Promise((resolve) => setTimeout(resolve, 3000));
  if (operation === "answerThenExit") setImmediate(() => process.exit(0));
  if (operation === "idleExit")
    setImmediate(() => {
      const view = new Int32Array(signal!);
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
      Atomics.wait(view, 1, 0);
      process.exit(0);
    });
  return value;
});
