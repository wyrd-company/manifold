// ---
// relationships:
//   implements: expressions
// ---
import { Worker, workerData } from "node:worker_threads";
import type { ExpressionWorkerData } from "./expression-worker-channel.ts";
import { recordExit } from "./expression-worker-protocol.ts";

const { worker, buffer, port } = workerData as ExpressionWorkerData & { worker: string };
const view = new Int32Array(buffer);
const evaluator = new Worker(new URL(worker), {
  workerData: { buffer, port },
  transferList: [port],
});
evaluator.on("error", () => {});
evaluator.once("exit", (code) => recordExit(view, code));
