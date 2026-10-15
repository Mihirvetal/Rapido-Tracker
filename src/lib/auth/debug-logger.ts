/**
 * Structured auth diagnostics. Disabled in production unless explicitly enabled.
 * Never log passwords, OTPs, emails, cookies, JWTs, or secrets.
 */

export type AuthDebugFlow =
  | "signup"
  | "login"
  | "otp_verification"
  | "resend_otp"
  | "recovery";

export type AuthDebugLocation = "client" | "server";

export type AuthDebugStatus =
  | "started"
  | "success"
  | "failure"
  | "info"
  | "blocked";

export interface AuthDebugPayload {
  event: string;
  flow: AuthDebugFlow;
  stage: string;
  location: AuthDebugLocation;
  requestId: string;
  status: AuthDebugStatus;
  elapsedMs?: number;
  [key: string]: unknown;
}

const PREFIX = "[AUTH_DEBUG]";

function readFlag(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env[name];
}

/** Verbose auth logs: on in development, or when NEXT_PUBLIC_AUTH_DEBUG=true. */
export function isAuthDebugEnabled(): boolean {
  if (readFlag("NEXT_PUBLIC_AUTH_DEBUG") === "true") {
    return true;
  }
  if (readFlag("AUTH_DEBUG") === "true") {
    return true;
  }
  if (readFlag("NEXT_PUBLIC_AUTH_DEBUG") === "false") {
    return false;
  }
  return readFlag("NODE_ENV") === "development";
}

export function createAuthRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `auth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Non-reversible short id for correlating an account without logging the email. */
export async function accountDiagId(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(`auth-diag:${normalized}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .slice(0, 6)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback: opaque length-based stub (still no email content).
  return `len${normalized.length}`;
}

export function sanitizeAuthError(error: unknown): {
  errorName: string | null;
  errorMessage: string | null;
  errorStatus: number | null;
  errorCode: string | null;
} {
  if (!error || typeof error !== "object") {
    return {
      errorName: null,
      errorMessage: error == null ? null : String(error),
      errorStatus: null,
      errorCode: null,
    };
  }
  const record = error as Record<string, unknown>;
  return {
    errorName: typeof record.name === "string" ? record.name : null,
    errorMessage: typeof record.message === "string" ? record.message : null,
    errorStatus: typeof record.status === "number" ? record.status : null,
    errorCode: typeof record.code === "string" ? record.code : null,
  };
}

export function envConfigPresence(): {
  hasSupabaseUrl: boolean;
  hasPublishableKey: boolean;
  supabaseUrlHostValid: boolean;
  supabaseUrlLooksLikeSupabase: boolean;
} {
  const url = readFlag("NEXT_PUBLIC_SUPABASE_URL") ?? "";
  const key = readFlag("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? "";
  let hostValid = false;
  let looksLikeSupabase = false;
  try {
    if (url) {
      const parsed = new URL(url);
      hostValid = parsed.protocol === "https:" || parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
      looksLikeSupabase =
        parsed.hostname.endsWith(".supabase.co") ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "localhost";
    }
  } catch {
    hostValid = false;
  }
  return {
    hasSupabaseUrl: url.length > 0,
    hasPublishableKey: key.length > 0,
    supabaseUrlHostValid: hostValid,
    supabaseUrlLooksLikeSupabase: looksLikeSupabase,
  };
}

export function authDebugLog(payload: AuthDebugPayload): void {
  if (!isAuthDebugEnabled()) {
    return;
  }

  const body = {
    ts: new Date().toISOString(),
    ...payload,
  };

  // Single-line JSON for easy terminal/console filtering.
  // Use console.log (not info) so browser DevTools "Info" filters do not hide client logs.
  const line = `${PREFIX} ${JSON.stringify(body)}`;
  if (payload.status === "failure") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function startTimer(): () => number {
  const started = Date.now();
  return () => Date.now() - started;
}
