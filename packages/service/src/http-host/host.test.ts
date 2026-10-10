// ---
// relationships:
//   verifies: service-assembly
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { createHttpHost } from "./index.ts";
import type { HttpHost } from "./index.ts";
const hosts: HttpHost[] = [];
afterEach(async () => {
  for (const host of hosts.splice(0)) await host.close();
});
async function fixture() {
  const errors: Error[] = [];
  const host = createHttpHost({
    configuration: { host: "127.0.0.1", port: 0 },
    onError: (error) => errors.push(error),
  });
  hosts.push(host);
  expect(() => host.address()).toThrow(TypeError);
  const address = await host.listen();
  return { host, errors, url: `http://${address.host}:${address.port}` };
}
test("routes full raw paths by longest segment prefix and validates mounts", async () => {
  const f = await fixture();
  f.host.mount("/a", (request, response) => response.end(request.url));
  f.host.mount("/a/b", (_request, response) => response.end("longest"));
  for (const prefix of ["/", "a", "/a/", "/a//b", "/a?b", "/a#b", "/a%b", "/a"])
    expect(() => f.host.mount(prefix, () => {})).toThrow(TypeError);
  expect(await (await fetch(f.url + "/a/b/c")).text()).toBe("longest");
  expect(await (await fetch(f.url + "/a/%62?q=1")).text()).toBe("/a/%62?q=1");
  for (const path of ["/", "/ab", "/missing"]) expect((await fetch(f.url + path)).status).toBe(404);
});
test("serves API mounts without authentication", async () => {
  const f = await fixture();
  f.host.mount("/api", (_request, response) => response.end("ready"));
  for (const authorization of [undefined, "Basic synthetic-token", "Bearer wrong"]) {
    const response = await fetch(f.url + "/api", {
      headers: authorization ? { authorization } : {},
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(await response.text()).toBe("ready");
  }
});
test("listener errors answer 500 and reach the error sink", async () => {
  const f = await fixture();
  f.host.mount("/fail", () => {
    throw new Error("synthetic failure");
  });
  expect((await fetch(f.url + "/fail")).status).toBe(500);
  expect(f.errors.map(String)).toEqual(["Error: synthetic failure"]);
});
test("close waits for an active request and returns the same promise", async () => {
  const f = await fixture();
  let answer!: () => void;
  let entered!: () => void;
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.host.mount("/wait", (_request, response) => {
    answer = () => response.end("done");
    entered();
  });
  const request = fetch(f.url + "/wait");
  await reached;
  const closed = f.host.close();
  try {
    expect(f.host.close()).toBe(closed);
    let finished = false;
    void closed.then(() => {
      finished = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(finished).toBe(false);
  } finally {
    answer();
  }
  expect(await (await request).text()).toBe("done");
  await closed;
  await expect(fetch(f.url + "/wait")).rejects.toThrow();
});
