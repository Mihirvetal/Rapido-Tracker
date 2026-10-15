export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export type OtpPurpose = "signup" | "login" | "recovery";

const OTP_PURPOSES = new Set<OtpPurpose>(["signup", "login", "recovery"]);

export function isOtpPurpose(value: string | null | undefined): value is OtpPurpose {
  return typeof value === "string" && OTP_PURPOSES.has(value as OtpPurpose);
}

export function parseOtpPurpose(
  value: string | null | undefined,
): OtpPurpose | null {
  return isOtpPurpose(value) ? value : null;
}

export function isValidOtpCode(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
