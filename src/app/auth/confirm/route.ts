import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function redirectAuthError(
  origin: string,
  code: "missing_token" | "confirm_failed" | "expired",
) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", code);
  return NextResponse.redirect(loginUrl);
}

/**
 * Token-hash confirmation (used when email templates link to /auth/confirm).
 * Prefer /auth/callback with PKCE `code` for the default hosted email flow.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const typeParam = requestUrl.searchParams.get("type");
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"), "/");

  if (!tokenHash || !typeParam || !ALLOWED_TYPES.has(typeParam as EmailOtpType)) {
    return redirectAuthError(origin, "missing_token");
  }

  const type = typeParam as EmailOtpType;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    const lowered = error.message.toLowerCase();
    const expired = lowered.includes("expired") || lowered.includes("invalid");
    return redirectAuthError(origin, expired ? "expired" : "confirm_failed");
  }

  const destination =
    type === "recovery"
      ? getSafeRedirectPath(next === "/" ? "/reset-password" : next, "/reset-password")
      : next;

  return NextResponse.redirect(new URL(destination, origin));
}
