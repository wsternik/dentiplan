import { defineConfig, devices } from "@playwright/test";

// Node 22 reads `.env` natively, so the runner picks up E2E_EMAIL / E2E_PASSWORD
// without a dotenv dependency. Missing file is fine — `auth.setup.ts` fails with
// a readable message if the variables are absent.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env on disk; the setup project reports what is missing
}

// E2E runs against the app the dentystka actually uses: `astro dev` on the
// workerd runtime, talking to the real Supabase project. There is no local
// Supabase in this setup (see `context/foundation/test-plan.md` §5) — which is
// also why e2e stays out of CI and runs locally before a PR.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "./e2e",
  // Every spec is self-contained (own setup, action, assertion, cleanup), so
  // parallel and random order are safe and are what the suite is written for.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // No retries: a test that only passes on the second run is hiding a race, and
  // this suite is small enough to fix rather than paper over.
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Authenticates once through the real sign-in form and stores the session,
    // so no other spec spends time (or asserts) on logging in.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/dentist.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
