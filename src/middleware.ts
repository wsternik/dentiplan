import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// `/dashboard` was the starter's demo page and is gone; leaving a protected
// route pointing at a deleted page is a redirect nobody would ever explain.
const PROTECTED_ROUTES = ["/admin"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
