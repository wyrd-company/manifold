// ---
// relationships:
//   verifies: portfolio-api
// ---
import { expect, test } from "vite-plus/test";
import { mapPortfolioResult } from "./portfolio.ts";
test("maps failures and refuses malformed success bodies", () => {
  expect(mapPortfolioResult(500, { message: "Read failed" })).toEqual({
    kind: "failed",
    message: "Read failed",
  });
  expect(mapPortfolioResult(200, {}).kind).toBe("failed");
});
