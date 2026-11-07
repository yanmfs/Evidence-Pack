import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-web", "src-tauri", "node_modules", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "react/*",
            "@tauri-apps/*",
            "**/platform",
            "**/platform/*",
            "**/features/*",
            "**/components/*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/App.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@tauri-apps/*"] }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,ts}", "tests/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
);
