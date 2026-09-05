import { SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
  /**
   * Show this banner only to a signed-in dentystka.
   *
   * `Layout.astro` is shared with `/p/<token>`, the anonymous patient page,
   * whose own no-disclosure invariant (FR-060) says we never surface internals
   * there — a patient holding a link has no use for our configuration state and
   * should not be told about it. Supabase is left unflagged on purpose: without
   * it the patient page cannot render at all, so its banner is the page.
   */
  adminOnly?: boolean;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "Anthropic",
    configured: Boolean(ANTHROPIC_API_KEY),
    adminOnly: true,
    message:
      "Wypełnianie formularza z notatki jest wyłączone — brak klucza API. Kosztorys można wypełnić ręcznie jak dotąd.",
  },
];

const missing = configStatuses.filter((s) => !s.configured);

/** Everything unconfigured — for the admin panel. */
export const missingConfigs = missing;

/** Only what an anonymous visitor may be told about, i.e. nothing admin-only. */
export const publicMissingConfigs = missing.filter((s) => !s.adminOnly);
