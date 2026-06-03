import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors the `@/* → ./src/*` path alias from tsconfig.json so unit tests
// resolve imports the same way the app does. Node environment is sufficient —
// the modules under test are pure (no DOM).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
