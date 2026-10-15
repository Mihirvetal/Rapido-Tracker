import { headers } from "next/headers";
import { getSiteOrigin } from "@/lib/auth/redirect";

/** Prefer configured site URL; otherwise derive from the incoming request. */
export async function getAuthRedirectOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") ?? "http";
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable outside a request
  }

  return getSiteOrigin();
}
