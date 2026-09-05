// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Prefill (S-02). Optional like the Supabase pair: a missing key must
      // degrade to a banner and a hand-filled form (FR-013), never a boot failure.
      ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Not a secret, but `access: "public"` in Astro means client-readable,
      // and a server-only knob has no business in the browser bundle.
      LLM_MODEL: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
