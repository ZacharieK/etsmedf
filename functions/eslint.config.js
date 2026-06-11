const js = require("@eslint/js")
const tseslint = require("typescript-eslint")
const { defineConfig, globalIgnores } = require("eslint/config")

module.exports = defineConfig([
  globalIgnores(["lib"]),
  {
    files: ["src/**/*.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
])
