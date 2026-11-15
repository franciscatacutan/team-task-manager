import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name='queryKey'][value.type='ArrayExpression']",
          message:
            "Use the shared queryKeys builders for query identities and prefixes.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(setQueryData|getQueryData|getQueryState|setQueriesData|getQueriesData)$/][arguments.0.type='ArrayExpression']",
          message: "Use the shared queryKeys builders for direct cache access.",
        },
      ],
    },
  },
  prettier,
]);
