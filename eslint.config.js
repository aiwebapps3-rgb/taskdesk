import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "coverage/", "data/", "logs/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // stdout carries the MCP protocol in stdio mode. Only stderr is allowed.
      "no-console": ["error", { allow: ["error"] }],
      "no-restricted-properties": [
        "error",
        { object: "process", property: "stdout", message: "stdout is reserved for the MCP protocol." },
      ],
    },
  },
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
