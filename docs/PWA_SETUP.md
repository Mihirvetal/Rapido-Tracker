# PWA Setup — Installability & Offline Policy

Rapido Income Tracker is prepared for home-screen installation on Android Chrome and iOS Safari. This document describes what is implemented, what was intentionally omitted, and how to verify installability on real devices.

## What is implemented

| Feature | Status |
|---------|--------|
| Web app manifest (`src/app/manifest.ts` → `/manifest.webmanifest`) | Yes |
| App name | Rapido Income Tracker |
| Short name | Rapido Income |
| `display: standalone`, `start_url: /`, `scope: /` | Yes |
| Theme / background colors (`#1f7a4d` / `#f4f6f5`) | Yes |
| PNG icons 192 & 512 (+ maskable) | `public/icons/` |
| Apple touch icon 180×180 | `public/icons/apple-touch-icon.png` |
| SVG favicon | `public/icon.svg` |
| Viewport + `theme-color` + `viewport-fit=cover` | Root layout |
| Safe-area padding for notch / home indicator | CSS + shell |
| Offline connectivity banner (`experimental.useOffline`) | Banner only — no private cache |
| Custom service worker / Cache Storage | **Not used** (see below) |

## Service worker & caching decision

**No custom service worker is registered.**

Reasons:

1. Dashboard, entries, reports, and profile are **authenticated, user-specific** HTML and data. Caching them in shared Cache Storage risks stale or cross-session financial figures.
2. OTP, password reset, and Supabase Auth must always hit the network; a SW that intercepts navigations can break cookie/SSR session refresh.
3. This phase forbids offline financial writes and background sync.

**What we do instead**

- Next.js `experimental.useOffline` detects offline state and retries failed navigations / Server Actions when the network returns.
- An explicit banner states that live data and saves need a connection.
- Static icons and the manifest are normal static/public assets (browser HTTP cache only).

**Update strategy without a SW**

- Deploy a new build; users get new HTML/JS on the next full load (standard Next.js asset hashing).
- In installed standalone mode, closing and reopening the app (or pull-to-refresh where available) picks up the new deployment.
- If a SW is added later, it must: never cache authenticated HTML/API/Supabase responses; use `updateViaCache: 'none'`; skipWaiting + clients.claim only with a clear “Update available” UX.

## Manifest must be public

`src/lib/supabase/proxy.ts` allow-lists `/manifest.webmanifest` so install prompts can fetch the manifest without a login session. PNG icons under `/icons/*` are already excluded from the proxy matcher.

## Build verification (CI / local)

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

After `npm run start` (or a deployed HTTPS URL):

1. Open `/manifest.webmanifest` — confirm name, icons, `display: standalone`.
2. Open each icon URL in the manifest — HTTP 200, correct dimensions.
3. View page source / DevTools Application → Manifest — no broken icon entries.

Build success ≠ installability. Chromium install criteria also require **HTTPS** (or `localhost`) and a valid manifest + icons.

## Android Chrome — manual install steps

1. Deploy the app over **HTTPS** (or use `http://localhost` for local checks).
2. Open the site in Chrome for Android and sign in (OTP flow).
3. Tap the browser menu (⋮) → **Install app** / **Add to Home screen** (wording varies).
4. Confirm. Launch from the home screen icon — UI should run without the Chrome address bar (`standalone`).
5. Optional DevTools (desktop remote debugging): Application → Manifest — check “Installability” / errors.

## iOS Safari — manual install steps

1. Open the **HTTPS** site in Safari (not an in-app browser).
2. Tap **Share** → **Add to Home Screen**.
3. Confirm the name **Rapido Income Tracker** (or edit), then Add.
4. Open from the home screen — should launch full-screen / near-standalone.
5. Note: iOS does not use `beforeinstallprompt`; there is no Chrome-style install banner.

## Security reminders

- Never put the Supabase **service-role** key in client bundles or the manifest.
- Do not add a SW that caches `/login`, `/verify-otp`, `/reset-password`, or any authenticated route HTML.
- Do not cache Supabase REST/Auth responses in Cache Storage.
