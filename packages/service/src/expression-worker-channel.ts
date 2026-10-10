// ---
// relationships:
//   implements: expressions
// ---
import { MessageChannel, receiveMessageOnPort, Worker, workerData } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";
import {
  abandon,
  claim,
  complete,
  confirm,
  release,
  states,
  take,
  words,
} from "./expression-worker-protocol.ts";

export type ChannelResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly cause: "timeout" }
  | { readonly ok: false; readonly cause: "exit"; readonly exitCode: number };
export interface ExpressionWorkerChannel {
  evaluate(request: unknown, timeoutMs: number): ChannelResult;
  close(): Promise<void>;
}
export type ExpressionWorkerData = { buffer: SharedArrayBuffer; port: MessagePort };
type Envelope = { sequence: number; value: unknown };

export function serveExpressionWorker(handler: (request: unknown) => Promise<unknown>): void {
  const { buffer, port } = workerData as ExpressionWorkerData;
  const view = new Int32Array(buffer);
  port.on("message", async ({ sequence, value }: Envelope) => {
    if (!take(view)) return;
    const result = await handler(value);
    // Publish the answer before done lets the caller read it synchronously.
    port.postMessage({ sequence, value: result });
    if (complete(view)) Atomics.notify(view, words.state);
  });
}

export function createExpressionWorkerChannel(options: {
  worker: URL;
  onPair?(event: { pair: number; phase: "started" | "ended" }): void;
}): ExpressionWorkerChannel {
  type Pair = {
    view: Int32Array;
    port: MessagePort;
    supervisor: Worker;
    discarded: boolean;
  };
  let current: Pair | undefined;
  let count = 0;
  let sequence = 0;
  const ending = new Set<Promise<void>>();

  function start(): Pair {
    const pair = ++count;
    const buffer = new SharedArrayBuffer(12);
    const { port1, port2 } = new MessageChannel();
    const supervisor = new Worker(
      new URL(
        import.meta.url.endsWith(".ts")
          ? "./expression-worker-supervisor.ts"
          : "./expression-worker-supervisor.js",
        import.meta.url,
      ),
      { workerData: { worker: options.worker.href, buffer, port: port2 }, transferList: [port2] },
    );
    supervisor.unref();
    port1.unref();
    const ended = new Promise<void>((resolve) => {
      supervisor.once("exit", () => {
        ending.delete(ended);
        port1.close();
        options.onPair?.({ pair, phase: "ended" });
        resolve();
      });
    });
    // Worker errors are followed by exit; consume them to avoid an uncaught event.
    supervisor.on("error", () => {});
    ending.add(ended);
    options.onPair?.({ pair, phase: "started" });
    return { view: new Int32Array(buffer), port: port1, supervisor, discarded: false };
  }
  function discard(pair: Pair) {
    if (pair.discarded) return;
    pair.discarded = true;
    if (current === pair) current = undefined;
    pair.port.close();
    void pair.supervisor.terminate();
  }

  return {
    evaluate(request, timeoutMs) {
      const deadline = performance.now() + timeoutMs;
      const evaluation = ++sequence;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (current && Atomics.load(current.view, words.life) !== 0) discard(current);
        const pair = (current ??= start());
        // Claim before checking life, so an idle exit cannot strand a request.
        claim(pair.view);
        if (confirm(pair.view)) {
          try {
            // MessagePort uses the worker_threads API, which has no targetOrigin.
            // eslint-disable-next-line unicorn/require-post-message-target-origin
            pair.port.postMessage({ sequence: evaluation, value: request });
          } catch (error) {
            discard(pair);
            throw error;
          }
        }
        for (;;) {
          let state = Atomics.load(pair.view, words.state);
          if (state === states.pending || state === states.running) {
            const remaining = deadline - performance.now();
            if (remaining > 0) {
              Atomics.wait(pair.view, words.state, state, remaining);
              continue;
            }
            if (abandon(pair.view)) {
              discard(pair);
              return { ok: false, cause: "timeout" };
            }
            // A completed result or exit wins over a deadline that lost arbitration.
            state = Atomics.load(pair.view, words.state);
          }
          if (state === states.done) {
            let answer: { message: Envelope } | undefined;
            do {
              answer = receiveMessageOnPort(pair.port) as { message: Envelope } | undefined;
            } while (answer && answer.message.sequence !== evaluation);
            release(pair.view);
            return { ok: true, value: answer!.message.value };
          }
          const exitCode = Atomics.load(pair.view, words.exitCode);
          discard(pair);
          if (state === states.untaken && performance.now() >= deadline)
            return { ok: false, cause: "timeout" };
          if (state === states.untaken && attempt === 0) break;
          return { ok: false, cause: "exit", exitCode };
        }
      }
      throw new Error("Unreachable expression worker retry");
    },
    async close() {
      if (current) discard(current);
      await Promise.all(ending);
    },
  };
}
