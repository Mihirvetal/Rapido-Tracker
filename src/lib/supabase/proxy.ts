import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/auth/callback",
  "/auth/confirm",
  // Installability assets must load without a session.
  "/manifest.webmanifest",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isAuthEntryPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    // Allow the app to boot so missing-config errors surface in pages/clients.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Must run immediately after createServerClient — refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    const nextPath = `${pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("next", getSafeRedirectPath(nextPath, "/"));
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthEntryPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    const next = getSafeRedirectPath(
      request.nextUrl.searchParams.get("next"),
      "/",
    );
    redirectUrl.pathname = next;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
