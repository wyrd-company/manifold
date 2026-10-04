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
async function fixture(operatorCredential?: string) {
  const errors: Error[] = [];
  let token = "synthetic-token";
  let unreadable = false;
  const host = createHttpHost({
    configuration: { host: "127.0.0.1", port: 0, operatorCredential },
    credentials: {
      names: ["operator"],
      resolve: (name) => ({
        kind: "operator-token",
        name,
        verify: async (presented) => {
          if (unreadable) throw new Error("Credential operator: unreadable");
          return presented === token;
        },
      }),
    },
    onError: (error) => errors.push(error),
  });
  hosts.push(host);
  expect(() => host.address()).toThrow(TypeError);
  const address = await host.listen();
  return {
    host,
    errors,
    url: `http://${address.host}:${address.port}`,
    rotate: () => {
      token = "synthetic-new";
    },
    unreadable: () => {
      unreadable = true;
    },
  };
}
test("routes full raw paths by longest segment prefix and validates mounts", async () => {
  const f = await fixture();
  f.host.mount("/a", (request, response) => response.end(request.url));
  f.host.mount("/a/b", (_request, response) => response.end("longest"));
  for (const prefix of ["/", "a", "/a/", "/a//b", "/a?b", "/a#b", "/a%b", "/a"])
    expect(() => f.host.mount(prefix, () => {})).toThrow(TypeError);
  expect(() => f.host.mountOperator("/a", () => {})).toThrow(TypeError);
  expect(await (await fetch(f.url + "/a/b/c")).text()).toBe("longest");
  expect(await (await fetch(f.url + "/a/%62?q=1")).text()).toBe("/a/%62?q=1");
  for (const path of ["/", "/ab", "/missing"]) expect((await fetch(f.url + path)).status).toBe(404);
});
test("operator mounts hide without configuration and authenticate each request", async () => {
  const hidden = await fixture();
  hidden.host.mountOperator("/api", (_request, response) => response.end("private"));
  expect((await fetch(hidden.url + "/api")).status).toBe(404);
  const f = await fixture("operator");
  f.host.mountOperator("/api", (_request, response) => response.end("private"));
  for (const authorization of [
    undefined,
    "Basic synthetic-token",
    "Bearer wrong",
    "Bearer  synthetic-token",
  ]) {
    const response = await fetch(f.url + "/api", {
      headers: authorization ? { authorization } : {},
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  }
  expect(
    await (
      await fetch(f.url + "/api", { headers: { authorization: "Bearer synthetic-token" } })
    ).text(),
  ).toBe("private");
  f.rotate();
  expect(
    (await fetch(f.url + "/api", { headers: { authorization: "Bearer synthetic-token" } })).status,
  ).toBe(401);
  expect(
    (await fetch(f.url + "/api", { headers: { authorization: "Bearer synthetic-new" } })).status,
  ).toBe(200);
  f.unreadable();
  expect(
    (await fetch(f.url + "/api", { headers: { authorization: "Bearer synthetic-new" } })).status,
  ).toBe(500);
  expect(f.errors.map(String).join()).toContain("operator");
  expect(f.errors.map(String).join()).not.toContain("synthetic-new");
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
