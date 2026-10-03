import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // @shadcn/lint — design-system rules for Tailwind v4 + shadcn/ui.
  // The plugin is registered; no rules are enabled yet.
  // Add rules here, e.g.:
  //   rules: { "shadcn/no-arbitrary-values": "error" }
  // Rules reference: https://github.com/shadcn-ui/lint/blob/main/docs/rules.md
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { shadcn },
    rules: {},
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
