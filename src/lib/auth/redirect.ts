/**
 * Allow only same-origin relative paths. Rejects open redirects (//evil.com, https://…).
 * Safe for client and server imports.
 */
export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/",
): string {
  if (!candidate) {
    return fallback;
  }

  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return fallback;
  }

  return trimmed;
}

export function getSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function buildAuthCallbackUrl(
  origin: string,
  nextPath: string,
): string {
  const next = getSafeRedirectPath(nextPath, "/");
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}
