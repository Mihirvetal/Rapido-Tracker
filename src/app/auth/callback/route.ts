import { NextResponse } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

function redirectAuthError(
  origin: string,
  code: "missing_code" | "exchange_failed" | "provider_error" | "expired",
) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", code);
  return NextResponse.redirect(loginUrl);
}

/**
 * PKCE / email confirmation callback.
 * Supabase redirects here with ?code=… after the user clicks the email link.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"), "/");

  if (providerError) {
    const expired =
      errorCode === "otp_expired" ||
      providerError === "access_denied" ||
      (requestUrl.searchParams.get("error_description") ?? "")
        .toLowerCase()
        .includes("expired");
    return redirectAuthError(origin, expired ? "expired" : "provider_error");
  }

  if (!code) {
    return redirectAuthError(origin, "missing_code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const lowered = error.message.toLowerCase();
    const expired =
      lowered.includes("expired") ||
      lowered.includes("invalid") ||
      error.status === 401;
    return redirectAuthError(origin, expired ? "expired" : "exchange_failed");
  }

  return NextResponse.redirect(new URL(next, origin));
}
