# Phase 9 — Verification & Security Audit

## Environment variables (no secrets)

| Variable | Required for | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | App + live probes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App + live probes | Anon/publishable key only |
| Service-role key | Local/admin only | **Never** in `.env` committed to the browser or client |

Optional for CLI apply: Supabase access token / DB password via `supabase login` + `supabase link`.

## Commands

```bash
# Always safe / local
npm run test:unit
npm run test:financial
npm run typecheck
npm run lint
npm run build

# Requires Docker + local Supabase
npm run db:start          # or: npx supabase start
npm run db:reset          # applies migrations (LOCAL only)
npm run db:test           # pgTAP RLS + RPC tests

# Non-destructive remote probe (anon key; fails if schema missing)
npm run test:live
```

**There is no Playwright/Cypress E2E framework in this repo.** Use the manual checklist below against a migrated environment.

## Actual results (this Phase 9 run)

| Check | Result | Notes |
|-------|--------|-------|
| `npm run test:unit` | **PASS** | dates, money, otp, pwa, financial |
| `npm run test:financial` | **PASS** | (included in `test:unit`) |
| `npm run typecheck` | **PASS** | |
| `npm run lint` | **PASS** | |
| `npm run build` | **PASS** | |
| `npm run db:test` | **BLOCKED / FAIL** | `ECONNREFUSED 127.0.0.1:54322` — Docker not installed |
| Local `supabase start` | **BLOCKED** | `docker: command not found` |
| Live anon probe (`npm run test:live`) | **FAIL** | `PGRST205` / `SCHEMA_MISSING` on configured cloud project |
| `bad_password_no_session` (live) | **PASS** | Auth API rejects invalid credentials; no session |
| Live Auth OTP signup/login/recovery | **NOT EXECUTED** | Needs migrated project + mailbox + OTP templates |
| Multi-user RLS via pgTAP | **NOT EXECUTED** | Needs Docker + `db:test` |
| Browser E2E journeys | **NOT EXECUTED** | No E2E framework; remote schema missing |
| PWA manifest/icons HTTP | **PASS** (prior local `next start`) | Real-device install still needs HTTPS |

## Critical finding

The Supabase project referenced by `.env` (`*.supabase.co`) does **not** currently expose `public.daily_entries` (and related tables) via PostgREST. Until migrations are applied to an **isolated** project (or local Docker stack), the application cannot function in production.

**Do not** run `db reset` against a production database with real user data.

## Auth security (architecture)

| Claim | Status |
|-------|--------|
| App login path: password → server `signOut` → email OTP → session | Implemented; post-signOut claims re-check added (fail closed) |
| Password-only session kept after login action | Intended: cleared before response |
| True AAL2 / MFA with email OTP | **Not available** in Supabase — email OTP is a first factor |
| Client can still call `signInWithPassword` with anon key | **Residual risk** — protocol allows password-only sessions outside our UI |
| Recommendation for stronger 2FA | Enroll Supabase **TOTP MFA** and enforce AAL2 for sensitive routes |

## Manual checklist (after schema is applied)

### Auth
1. Sign up → receive 6-digit OTP → verify → dashboard session
2. Wrong OTP / expired OTP → clear error, no session
3. Resend OTP → cooldown; rate-limit message when throttled
4. Wrong password → generic error
5. Correct password → OTP screen; visit `/reports` before verify → redirect to login
6. Complete OTP → refresh page → still authenticated
7. Logout → protected routes redirect to login
8. Recovery OTP → set password → login again

### Multi-user (two browsers / users)
1. User A creates entry + expenses; User B cannot see them in UI or by guessing entry IDs
2. User B cannot update/delete A’s categories or expenses
3. Shared Petrol category readable; not editable

### Entries / Dashboard / Reports
1. Create entry (earnings, km, petrol, extras) → edit same date updates, no duplicate
2. Delete entry → expenses gone; dashboard/reports refresh
3. Today / last 10 / last 30 / overall match hand-calculated fixtures
4. Month list newest-first; leap-year Feb; invalid `?month=` handled
5. Empty calendar day → add entry with that date

### PWA
1. `/manifest.webmanifest` + icons 200
2. Offline banner appears/disappears; does not claim offline save
3. Android Chrome / iOS Safari install per `docs/PWA_SETUP.md`

## Production deployment gate

**NO-GO** until at least:

1. Docker local `npm run db:test` **passes**, **or** equivalent RLS/RPC verification on an isolated remote
2. Migrations applied to the target Supabase project (tables visible; live probe passes)
3. Auth OTP templates configured; signup/login/recovery manually verified
4. Two-user isolation manually verified
5. HTTPS deploy; PWA install smoke on one Android and one iOS device (or documented waiver)
