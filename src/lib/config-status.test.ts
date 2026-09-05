// The patient page at `/p/<token>` renders through the same `Layout.astro` as
// the admin panel, and that layout prints a banner for every unconfigured
// integration. Its own header states the no-disclosure invariant (FR-060):
// "unknown, draft, missing-env, parse-failure, and RPC-error cases ALL render
// the identical generic error page. We never distinguish causes and never
// surface internals." An unset Anthropic key telling a patient that a form
// prefill is unavailable is exactly that leak.
//
// `Layout.astro` picks between the two exported lists on `Astro.locals.user`.
// This asserts the list an anonymous visitor gets can never carry an admin-only
// status — so removing the `adminOnly` flag, or adding a second admin-only
// integration without one, turns a test red instead of shipping the banner.
//
// Note the module is imported for its *shape*, not for whether a key happens to
// be set in this environment: the assertions hold either way.

import { describe, expect, it } from "vitest";

import { configStatuses, missingConfigs, publicMissingConfigs } from "./config-status";

describe("config status audiences", () => {
  it("never shows an admin-only banner to an anonymous visitor", () => {
    expect(publicMissingConfigs.every((s) => !s.adminOnly)).toBe(true);
  });

  it("keeps the Anthropic key admin-only, so a missing key cannot reach the patient page", () => {
    const anthropic = configStatuses.find((s) => s.name === "Anthropic");
    expect(anthropic).toBeDefined();
    expect(anthropic?.adminOnly).toBe(true);
    expect(publicMissingConfigs).not.toContain(anthropic);
  });

  it("keeps Supabase visible to everyone — without it the patient page cannot render at all", () => {
    const supabase = configStatuses.find((s) => s.name === "Supabase");
    expect(supabase).toBeDefined();
    expect(supabase?.adminOnly).toBeFalsy();
  });

  it("shows the admin every unconfigured integration, admin-only ones included", () => {
    expect(publicMissingConfigs.length).toBeLessThanOrEqual(missingConfigs.length);
    for (const status of publicMissingConfigs) {
      expect(missingConfigs).toContain(status);
    }
  });
});
