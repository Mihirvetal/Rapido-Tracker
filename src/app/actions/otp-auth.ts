"use server";

import { revalidatePath } from "next/cache";
import {
  getAuthErrorMessage,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "@/lib/auth/errors";
import {
  accountDiagId,
  authDebugLog,
  createAuthRequestId,
  envConfigPresence,
  sanitizeAuthError,
  startTimer,
} from "@/lib/auth/debug-logger";
import { normalizeEmail } from "@/lib/auth/otp";
import { buildAuthCallbackUrl } from "@/lib/auth/redirect";
import { getAuthRedirectOrigin } from "@/lib/auth/redirect-server";
import { createClient } from "@/lib/supabase/server";

export type OtpAuthResult =
  | {
      status: "check_email";
      kind: "signup" | "recovery";
      requestId: string;
    }
  | { status: "authenticated"; requestId: string }
  | { status: "password_updated"; requestId: string }
  | { status: "error"; message: string; requestId: string };

function resolveRequestId(incoming?: string): string {
  if (incoming && incoming.trim().length >= 8 && incoming.trim().length <= 80) {
    return incoming.trim();
  }
  return createAuthRequestId();
}

/**
 * Signup: Supabase default confirmation email (link). No numeric OTP.
 * When Confirm email is enabled, signUp returns no session until the link is used.
 */
export async function beginSignupAction(input: {
  email: string;
  password: string;
  fullName: string;
  requestId?: string;
}): Promise<OtpAuthResult> {
  const requestId = resolveRequestId(input.requestId);
  const flow = "signup" as const;
  const location = "server" as const;
  const email = normalizeEmail(input.email);
  const accountId = await accountDiagId(email);

  authDebugLog({
    event: "signup.action_received",
    flow,
    stage: "action_received",
    location,
    requestId,
    status: "started",
    accountId,
    ...envConfigPresence(),
  });

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { status: "error", message: passwordError, requestId };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    authDebugLog({
      event: "signup.client_failed",
      flow,
      stage: "supabase_client",
      location,
      requestId,
      status: "failure",
      ...sanitizeAuthError(error),
    });
    return {
      status: "error",
      message: "Authentication is not configured. Please try again later.",
      requestId,
    };
  }

  const origin = await getAuthRedirectOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(origin, "/");

  const timer = startTimer();
  authDebugLog({
    event: "signup.signUp_started",
    flow,
    stage: "signUp",
    location,
    requestId,
    status: "started",
    accountId,
    usesConfirmationLink: true,
    // Do not log full redirect URL query if it ever contained secrets (it should not).
    redirectPath: "/auth/callback",
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: input.fullName.trim() || undefined,
      },
    },
  });

  if (error) {
    authDebugLog({
      event: "signup.signUp_failed",
      flow,
      stage: "signUp",
      location,
      requestId,
      status: "failure",
      elapsedMs: timer(),
      ...sanitizeAuthError(error),
    });
    return {
      status: "error",
      message: getAuthErrorMessage(error),
      requestId,
    };
  }

  const identitiesCount = data.user?.identities?.length ?? null;
  authDebugLog({
    event: "signup.signUp_completed",
    flow,
    stage: "signUp",
    location,
    requestId,
    status: "success",
    elapsedMs: timer(),
    accountId,
    hasUser: Boolean(data.user),
    hasSession: Boolean(data.session),
    identitiesCount,
    emailDeliveryConfirmed: false,
    emailDeliveryEvidence: "none_from_api",
  });

  if (data.user && identitiesCount === 0) {
    authDebugLog({
      event: "signup.existing_account_no_email",
      flow,
      stage: "signUp",
      location,
      requestId,
      status: "failure",
      identitiesCount,
    });
    return {
      status: "error",
      message:
        "An account with this email already exists. Sign in instead, or use Forgot password.",
      requestId,
    };
  }

  // Confirm email disabled: session returned immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    authDebugLog({
      event: "signup.session_without_confirm",
      flow,
      stage: "response",
      location,
      requestId,
      status: "success",
      resultStatus: "authenticated",
      note: "Confirm email appears disabled in Supabase; session established at signup",
    });
    return { status: "authenticated", requestId };
  }

  authDebugLog({
    event: "signup.action_response",
    flow,
    stage: "response",
    location,
    requestId,
    status: "success",
    resultStatus: "check_email",
    kind: "signup",
  });
  return { status: "check_email", kind: "signup", requestId };
}

/** Password-only sign-in. No email. */
export async function beginLoginOtpAction(input: {
  email: string;
  password: string;
  requestId?: string;
}): Promise<OtpAuthResult> {
  const requestId = resolveRequestId(input.requestId);
  const flow = "login" as const;
  const location = "server" as const;
  const email = normalizeEmail(input.email);
  const accountId = await accountDiagId(email);

  authDebugLog({
    event: "login.action_received",
    flow,
    stage: "action_received",
    location,
    requestId,
    status: "started",
    accountId,
    sendsEmail: false,
  });

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return {
      status: "error",
      message: "Authentication is not configured. Please try again later.",
      requestId,
    };
  }

  const timer = startTimer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    const lowered = error.message.toLowerCase();
    authDebugLog({
      event: "login.signInWithPassword_failed",
      flow,
      stage: "signInWithPassword",
      location,
      requestId,
      status: "failure",
      elapsedMs: timer(),
      emailNotConfirmed: lowered.includes("email not confirmed"),
      ...sanitizeAuthError(error),
    });
    if (lowered.includes("email not confirmed")) {
      return {
        status: "error",
        message:
          "Confirm your email using the link we sent, then sign in with your password.",
        requestId,
      };
    }
    return {
      status: "error",
      message: "Incorrect email or password.",
      requestId,
    };
  }

  authDebugLog({
    event: "login.signInWithPassword_succeeded",
    flow,
    stage: "signInWithPassword",
    location,
    requestId,
    status: "success",
    elapsedMs: timer(),
    hasSession: Boolean(data.session),
    sendsEmail: false,
  });

  revalidatePath("/", "layout");
  return { status: "authenticated", requestId };
}

/**
 * Password recovery via Supabase default reset email (confirmation link).
 * Always returns check_email for non-rate-limit cases (no account enumeration).
 */
export async function beginRecoveryOtpAction(input: {
  email: string;
  requestId?: string;
}): Promise<OtpAuthResult> {
  const requestId = resolveRequestId(input.requestId);
  const flow = "recovery" as const;
  const location = "server" as const;
  const email = normalizeEmail(input.email);
  const accountId = await accountDiagId(email);

  authDebugLog({
    event: "recovery.action_received",
    flow,
    stage: "action_received",
    location,
    requestId,
    status: "started",
    accountId,
  });

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return {
      status: "error",
      message: "Authentication is not configured. Please try again later.",
      requestId,
    };
  }

  const origin = await getAuthRedirectOrigin();
  const redirectTo = buildAuthCallbackUrl(origin, "/reset-password");

  const timer = startTimer();
  authDebugLog({
    event: "recovery.resetPasswordForEmail_started",
    flow,
    stage: "resetPasswordForEmail",
    location,
    requestId,
    status: "started",
    redirectPath: "/auth/callback",
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    const message = error.message.toLowerCase();
    authDebugLog({
      event: "recovery.resetPasswordForEmail_failed",
      flow,
      stage: "resetPasswordForEmail",
      location,
      requestId,
      status: "failure",
      elapsedMs: timer(),
      ...sanitizeAuthError(error),
    });
    if (message.includes("rate") || message.includes("seconds")) {
      return {
        status: "error",
        message: getAuthErrorMessage(error),
        requestId,
      };
    }
  } else {
    authDebugLog({
      event: "recovery.resetPasswordForEmail_completed",
      flow,
      stage: "resetPasswordForEmail",
      location,
      requestId,
      status: "success",
      elapsedMs: timer(),
      emailDeliveryConfirmed: false,
      emailDeliveryEvidence: "none_from_api",
    });
  }

  return { status: "check_email", kind: "recovery", requestId };
}

export async function completePasswordResetAction(input: {
  password: string;
  requestId?: string;
}): Promise<OtpAuthResult> {
  const requestId = resolveRequestId(input.requestId);
  const flow = "recovery" as const;
  const location = "server" as const;

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      requestId,
    };
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { status: "error", message: passwordError, requestId };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return {
      status: "error",
      message: "Authentication is not configured. Please try again later.",
      requestId,
    };
  }

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message:
        "Open the password reset link from your email before setting a new password.",
      requestId,
    };
  }

  const timer = startTimer();
  const { error } = await supabase.auth.updateUser({
    password: input.password,
  });

  if (error) {
    authDebugLog({
      event: "recovery.updateUser_failed",
      flow,
      stage: "updateUser",
      location,
      requestId,
      status: "failure",
      elapsedMs: timer(),
      ...sanitizeAuthError(error),
    });
    return {
      status: "error",
      message: getAuthErrorMessage(error),
      requestId,
    };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  authDebugLog({
    event: "recovery.password_updated",
    flow,
    stage: "response",
    location,
    requestId,
    status: "success",
    elapsedMs: timer(),
  });
  return { status: "password_updated", requestId };
}
