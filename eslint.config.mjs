import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    ".next-e2e-*/**",
    ".next-playwright*/**",
    "playwright-report/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // React Native / Expo is validated by the dedicated Mobile CI workflow.
    "mobile/**",
  ]),
]);

export default eslintConfig;
