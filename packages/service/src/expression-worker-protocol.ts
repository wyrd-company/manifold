// ---
// relationships:
//   implements: expressions
// ---
export const words = { state: 0, life: 1, exitCode: 2 } as const;
export const states = {
  idle: 0,
  pending: 1,
  running: 2,
  done: 3,
  untaken: 4,
  failed: 5,
  abandoned: 6,
} as const;

function move(view: Int32Array, from: number, to: number) {
  return Atomics.compareExchange(view, words.state, from, to) === from;
}
export function claim(view: Int32Array) {
  return move(view, states.idle, states.pending);
}
export function confirm(view: Int32Array) {
  if (Atomics.load(view, words.life) === 0) return true;
  move(view, states.pending, states.untaken);
  return false;
}
export function take(view: Int32Array) {
  return move(view, states.pending, states.running);
}
export function complete(view: Int32Array) {
  return move(view, states.running, states.done);
}
export function recordExit(view: Int32Array, code: number) {
  Atomics.store(view, words.exitCode, code);
  // Publish exit before arbitration, paired with the caller's claim then confirm.
  Atomics.store(view, words.life, 1);
  if (!move(view, states.pending, states.untaken)) move(view, states.running, states.failed);
  Atomics.notify(view, words.state);
}
export function abandon(view: Int32Array) {
  return (
    move(view, states.pending, states.abandoned) || move(view, states.running, states.abandoned)
  );
}
export function release(view: Int32Array) {
  return move(view, states.done, states.idle);
}
