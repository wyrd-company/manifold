import { expect, test } from "vite-plus/test";
import { packageName } from "./index.ts";

test("names its package", () => {
  expect(packageName).toBe("@wyrd-company/manifold-shared");
});
