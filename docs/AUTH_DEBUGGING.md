# Auth Debugging — Confirmation Link Flow

Logs use prefix **`[AUTH_DEBUG]`** (on in `next dev`, or `NEXT_PUBLIC_AUTH_DEBUG=true`).

## Current sequences

### Signup
1. Client submits signup form  
2. Server `signUp` with `emailRedirectTo=/auth/callback?next=/`  
3. UI shows **check your email** (no `/verify-otp`)  
4. User clicks Supabase link → `/auth/callback?code=…` → `exchangeCodeForSession`  
5. Redirect to `/` (or user signs in with password after confirm)

### Login
1. `signInWithPassword` only — **no email**

### Recovery
1. `resetPasswordForEmail` with `redirectTo=/auth/callback?next=/reset-password`  
2. User clicks link → callback → `/reset-password` → `updateUser` → sign out → login  

## What to paste
Filter `[AUTH_DEBUG]` for one signup: `signup.signUp_started` / `signup.signUp_completed` / `resultStatus: check_email`.  
Do **not** repeatedly trigger signup emails (default sender rate limits).
