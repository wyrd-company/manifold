import { expect, test } from "vite-plus/test";
import { banner } from "./index.ts";

test("prints a placeholder banner", () => {
  expect(banner()).toBe("manifold-host: placeholder");
});
