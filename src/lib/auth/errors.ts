/** Map Supabase Auth errors to safe, user-facing messages (no token leakage). */
export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Something went wrong. Please try again.";
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  if (message.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (
    message.includes("token has expired") ||
    message.includes("otp_expired") ||
    (message.includes("expired") &&
      (message.includes("otp") ||
        message.includes("token") ||
        message.includes("code") ||
        message.includes("link")))
  ) {
    return "That confirmation or reset link has expired. Request a new email.";
  }
  if (
    message.includes("invalid") &&
    (message.includes("otp") || message.includes("token"))
  ) {
    return "That confirmation or reset link is invalid. Request a new email.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirm your email using the link we sent, then sign in.";
  }
  if (message.includes("user already registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (message.includes("password")) {
    return "Password does not meet the requirements.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return "Unable to complete that request. Please try again.";
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
