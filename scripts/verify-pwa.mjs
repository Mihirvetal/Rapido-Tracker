import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "public/icon.svg",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/icon-192-maskable.png",
  "public/icons/icon-512-maskable.png",
  "public/icons/apple-touch-icon.png",
  "src/app/manifest.ts",
];

for (const relative of requiredFiles) {
  assert.equal(
    existsSync(join(root, relative)),
    true,
    `Missing PWA asset: ${relative}`,
  );
}

const manifestSource = readFileSync(join(root, "src/app/manifest.ts"), "utf8");
assert.match(manifestSource, /name:\s*"Rapido Income Tracker"/);
assert.match(manifestSource, /display:\s*"standalone"/);
assert.match(manifestSource, /start_url:\s*"\/"/);
assert.match(manifestSource, /theme_color:\s*"#1f7a4d"/);
assert.match(manifestSource, /\/icons\/icon-192\.png/);
assert.match(manifestSource, /\/icons\/icon-512\.png/);
assert.match(manifestSource, /purpose:\s*"maskable"/);

const proxySource = readFileSync(
  join(root, "src/lib/supabase/proxy.ts"),
  "utf8",
);
assert.match(proxySource, /\/manifest\.webmanifest/);

const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
assert.match(nextConfig, /useOffline:\s*true/);

// Confirm we did not add a custom service worker that caches app shells.
assert.equal(existsSync(join(root, "public/sw.js")), false);
assert.equal(existsSync(join(root, "src/sw.ts")), false);
assert.equal(existsSync(join(root, "src/service-worker.ts")), false);

console.log("verify-pwa: ok");
