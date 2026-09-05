// Stand-in for Astro's virtual `astro:env/server` module under Vitest.
//
// Astro generates that module at build time, so anything importing it is
// unreachable from a plain Node test runner — which is why `config-status.ts`
// and `supabase.ts` had no unit tests at all, and why a module that merely
// imported one of them transitively would take a whole suite down on an
// unresolved import rather than on a failing assertion.
//
// Values come from the real environment so a test can opt into "configured" or
// "not configured" by setting the variable; the default of `undefined` is the
// unconfigured case, which is usually the interesting one.

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const LLM_MODEL = process.env.LLM_MODEL;
