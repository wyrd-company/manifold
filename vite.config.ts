// ---
// relationships:
//   implements: operator-console
// ---
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp fmt --no-error-on-unmatched-pattern",
  },
  fmt: {
    ignorePatterns: [
      "coverage",
      "dist",
      "node_modules",
      "pnpm-lock.yaml",
      "*.tsbuildinfo",
      "packages/service/src/decision-model-fixtures/editor-export.yml",
    ],
    sortPackageJson: {},
  },
  lint: {
    ignorePatterns: ["coverage", "dist", "node_modules", "pnpm-lock.yaml", "*.tsbuildinfo"],
    plugins: ["eslint", "oxc", "unicorn", "typescript", "react"],
    categories: {
      correctness: "warn",
      suspicious: "warn",
      perf: "warn",
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "unicorn/no-array-sort": "off",
      "unicorn/consistent-function-scoping": "off",
      "oxc/no-map-spread": "off",
      "eslint/no-shadow": "off",
      "eslint/no-await-in-loop": "off",
      "eslint/no-underscore-dangle": "off",
      "typescript/consistent-return": "off",
      "typescript/no-base-to-string": "off",
      "typescript/no-floating-promises": "off",
      "typescript/no-unnecessary-type-assertion": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "typescript/require-array-sort-compare": "off",
      "typescript/restrict-template-expressions": "off",
      "typescript/unbound-method": "off",
      "typescript/no-explicit-any": "error",
    },
    options: {
      reportUnusedDisableDirectives: "error",
      typeAware: false,
      typeCheck: false,
    },
  },
});
