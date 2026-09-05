import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors the `@/* → ./src/*` path alias from tsconfig.json so unit tests
// resolve imports the same way the app does. Node environment is sufficient —
// the modules under test are pure (no DOM).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Astro builds `astro:env/server` at build time, so it does not exist for
      // a plain Node runner. Without this stub any module that reads an env var
      // — or merely imports one that does — fails the suite on an unresolved
      // import instead of on an assertion.
      "astro:env/server": fileURLToPath(new URL("./test/astro-env-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
