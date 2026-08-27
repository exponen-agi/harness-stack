// Flat ESLint config (ESLint 9+). Type-aware linting is intentionally
// skipped here — `npm run typecheck` (tsc --noEmit) already owns type
// correctness; this config catches the things tsc doesn't (unused
// variables/imports, accidental console usage, etc.) across both src/ and
// tests/, which tsconfig.json deliberately excludes from the build.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
