import assert from "node:assert/strict";

const OTP_LENGTH = 6;
const OTP_PURPOSES = new Set(["signup", "login", "recovery"]);

function isOtpPurpose(value) {
  return typeof value === "string" && OTP_PURPOSES.has(value);
}

function isValidOtpCode(code) {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(code).trim());
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isPublicPath(pathname) {
  const PUBLIC_PATHS = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
    "/auth/callback",
    "/auth/confirm",
  ];
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

assert.equal(isValidOtpCode("123456"), true);
assert.equal(isValidOtpCode("12345"), false);
assert.equal(isValidOtpCode("1234567"), false);
assert.equal(isValidOtpCode("12a456"), false);
assert.equal(isValidOtpCode(" 123456 "), true);

assert.equal(isOtpPurpose("signup"), true);
assert.equal(isOtpPurpose("login"), true);
assert.equal(isOtpPurpose("recovery"), true);
assert.equal(isOtpPurpose("magiclink"), false);
assert.equal(isOtpPurpose(""), false);

assert.equal(normalizeEmail("  A@B.Com "), "a@b.com");

assert.equal(isPublicPath("/verify-otp"), true);
assert.equal(isPublicPath("/reports"), false);
assert.equal(isPublicPath("/"), false);
assert.equal(isPublicPath("/entries/new"), false);

// Auth error mapping snippets (mirrors getAuthErrorMessage branches)
function mapAuthError(message) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (
    m.includes("token has expired") ||
    m.includes("otp_expired") ||
    (m.includes("expired") &&
      (m.includes("otp") || m.includes("token") || m.includes("code") || m.includes("link")))
  ) {
    return "That code has expired. Request a new one.";
  }
  if (m.includes("invalid") && (m.includes("otp") || m.includes("token"))) {
    return "That code is invalid. Check the email and try again.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Unable to complete that request. Please try again.";
}

assert.equal(
  mapAuthError("Invalid login credentials"),
  "Incorrect email or password.",
);
assert.equal(
  mapAuthError("Token has expired or is invalid"),
  "That code has expired. Request a new one.",
);
assert.equal(
  mapAuthError("Invalid otp"),
  "That code is invalid. Check the email and try again.",
);

console.log("verify-otp: ok");
