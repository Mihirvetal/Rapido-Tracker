import assert from "node:assert/strict";

function getSafeRedirectPath(candidate, fallback = "/") {
  if (!candidate) return fallback;
  const trimmed = String(candidate).trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  return trimmed;
}

function buildAuthCallbackUrl(origin, nextPath) {
  const next = getSafeRedirectPath(nextPath, "/");
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

// Safe redirects
assert.equal(getSafeRedirectPath("/"), "/");
assert.equal(getSafeRedirectPath("/reports"), "/reports");
assert.equal(getSafeRedirectPath("/reset-password"), "/reset-password");
assert.equal(getSafeRedirectPath("/entries/new?x=1"), "/entries/new?x=1");

// Open redirect attempts
assert.equal(getSafeRedirectPath("//evil.com"), "/");
assert.equal(getSafeRedirectPath("https://evil.com"), "/");
assert.equal(getSafeRedirectPath("http://evil.com"), "/");
assert.equal(getSafeRedirectPath("\\\\evil"), "/");
assert.equal(getSafeRedirectPath(""), "/");
assert.equal(getSafeRedirectPath(null, "/login"), "/login");
assert.equal(getSafeRedirectPath("reports"), "/");

// Callback URL builder
assert.equal(
  buildAuthCallbackUrl("http://localhost:3000", "/"),
  "http://localhost:3000/auth/callback?next=%2F",
);
assert.equal(
  buildAuthCallbackUrl("http://localhost:3000", "/reset-password"),
  "http://localhost:3000/auth/callback?next=%2Freset-password",
);
assert.equal(
  buildAuthCallbackUrl("http://localhost:3000", "https://evil.com"),
  "http://localhost:3000/auth/callback?next=%2F",
);

// Public auth paths (proxy allow-list intent)
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/auth/callback",
  "/auth/confirm",
];
function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
assert.equal(isPublicPath("/auth/callback"), true);
assert.equal(isPublicPath("/auth/confirm"), true);
assert.equal(isPublicPath("/reports"), false);

console.log("verify-auth-redirect: ok");
