// ---
// relationships:
//   verifies: expressions
// ---
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
process.exit(8);
