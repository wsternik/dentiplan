import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // Checked, not fired and forgotten. A sign-out that fails silently redirects
  // to `/` looking exactly like one that worked, and the session cookie may
  // still be live — on the shared surgery machine this app runs on, that is the
  // failure worth reporting. Same shape as `signin.ts`.
  const { error } = await supabase.auth.signOut();
  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/");
};
