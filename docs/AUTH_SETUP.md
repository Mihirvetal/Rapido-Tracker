# Authentication Setup — Confirmation Link + Password Login

Signup uses Supabase’s **default confirmation email link** (no custom SMTP / no editable templates required). Sign-in is **email + password only** (no login email).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key — never the service-role key |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical origin (e.g. `http://localhost:3000`) |

## Supabase Dashboard (required)

### Authentication → Providers → Email

1. Enable the **Email** provider.
2. Enable **Confirm email**.

### Authentication → URL configuration

- **Site URL:** `http://localhost:3000` (local) or your production origin
- **Redirect URLs** (allow-list):
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/callback?next=/`
  - `http://localhost:3000/auth/callback?next=/reset-password`
  - Production equivalents of the above

Wildcards such as `http://localhost:3000/**` are fine if your project allows them.

### Default email templates

Without custom SMTP, Supabase controls the default **Confirm signup** / **Reset password** emails (usually a **confirmation link**, not a 6-digit OTP). This app is built for that link flow.

Delivery uses Supabase’s default sender, which is **rate-limited** and may not deliver to every address. Prefer an eligible inbox for testing; check spam.

## App flows

| Flow | Steps |
|------|--------|
| **Signup** | `signUp({ emailRedirectTo: /auth/callback?next=/ })` → check inbox → click link → `/auth/callback` exchanges `code` → session → dashboard (or sign in if confirm only verifies) |
| **Sign in** | `signInWithPassword` → dashboard (**no email**) |
| **Forgot password** | `resetPasswordForEmail({ redirectTo: /auth/callback?next=/reset-password })` → click link → set password → sign in |

After signup with Confirm email ON, the user typically has **no session until the link is clicked**. This app then shows “check your email” and asks them to **sign in** after confirming (PKCE callback may also establish a session and land on `/`).

## Callback routes

| Route | Role |
|-------|------|
| `/auth/callback` | PKCE `?code=` → `exchangeCodeForSession` (primary for default emails) |
| `/auth/confirm` | `token_hash` + `type` → `verifyOtp` (fallback if a template uses it) |

Both validate `next` with same-origin relative paths only. Failures redirect to `/login?error=…` with a safe message.

## Manual verification

1. Set Site URL + redirect allow-list as above.
2. Delete any old test user under Authentication → Users (or use a new email).
3. Sign up once → wait for Supabase’s confirmation email (do not spam resend).
4. Click the link → you should land authenticated on `/` or be able to sign in.
5. Sign in with password → no new email.
6. Forgot password → open reset link → set password → sign in.

## Security

- RLS and protected routes unchanged.
- Confirm email stays enabled.
- No service-role key in the client.
- No tokens logged; redirects are validated.
