// ---
// relationships:
//   verifies: usage-intake
// ---
// Pause the real CLI after reading its second acknowledgement, before it can
// checkpoint that source. Production code has no crash instrumentation.
const original = globalThis.fetch;
let requests = 0;
globalThis.fetch = async (...args) => {
  const response = await original(...args);
  requests++;
  if (requests === 2) {
    const json = response.json.bind(response);
    response.json = async () => {
      const value: unknown = await json();
      process.send?.("acknowledged");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      return value;
    };
  }
  return response;
};
