# Database Setup — Rapido Income Tracker (Phase 2)

This document describes the Supabase/PostgreSQL schema, migrations, RLS rules, and security tests added in Phase 2. The Phase 1 UI remains mock-driven; deferred dashboard/report product requirements stay in [`PHASE_2_IMPLEMENTATION_NOTES.md`](./PHASE_2_IMPLEMENTATION_NOTES.md).

For email/password auth, SSR sessions, and Profile wiring, see [`AUTH_SETUP.md`](./AUTH_SETUP.md) (Phase 3).

## Schema overview

```
auth.users
    │
    ├── profiles (1:1, id = auth.users.id)
    │
    ├── daily_entries (1:N)
    │       │
    │       └── daily_expenses (1:N)
    │               │
    │               └── expense_categories (N:1)
    │
    └── expense_categories (1:N private; shared rows have user_id NULL)
```

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Display profile for each auth user; created by `handle_new_user` after signup |
| `daily_entries` | One row per user per calendar day (earnings, km, notes) |
| `expense_categories` | Private categories (`user_id` set) and shared defaults (`user_id` NULL) |
| `daily_expenses` | Expense line items belonging to a daily entry |

**Profit is never stored.** Net operating profit / overall net profit must be computed as:

`total_earnings − SUM(daily_expenses.amount)` (scoped to the authenticated user via RLS).

### Key constraints & indexes

- `daily_entries`: `UNIQUE (user_id, entry_date)`; non-negative `total_earnings` / `total_km`; indexes on `(user_id, entry_date DESC)`.
- `expense_categories`: case- and whitespace-insensitive unique names for private and shared rows (`lower(btrim(name))`).
- `daily_expenses`: non-negative `amount`; indexes on `user_id`, `daily_entry_id`, `category_id`.

### Ownership consistency (database-enforced)

1. **Composite foreign key** `daily_expenses (daily_entry_id, user_id) → daily_entries (id, user_id)`  
   An expense cannot point at another user’s entry even if someone forges IDs in the client.

2. **Trigger** `enforce_expense_category_access`  
   Category must be a shared default (`user_id IS NULL`) or a private category owned by the same `user_id` as the expense.  
   A plain FK to `expense_categories(id)` alone cannot express “shared OR mine,” so the trigger complements the FK.

3. **RLS** on all four tables (with `FORCE ROW LEVEL SECURITY`) so table-owner sessions still obey policies.

### Shared default categories

Seeded idempotently (fixed UUIDs, `ON CONFLICT (id) DO NOTHING`):

- Petrol, Food, Maintenance, Parking, Other

Authenticated users may **SELECT** shared categories. They may **not** INSERT/UPDATE/DELETE shared rows. They may manage their own private categories.

### Signup profile trigger

`public.handle_new_user` runs `AFTER INSERT ON auth.users` (`SECURITY DEFINER`, `search_path = public`) and inserts `profiles (id, full_name)` from optional `raw_user_meta_data.full_name`. No signup UI is implemented in Phase 2.

---

## Prerequisites

- Node.js + npm (project already uses these)
- Supabase CLI (devDependency: `supabase`, invoke via `npx supabase`)
- Docker Desktop / Docker Engine (required for local Supabase)
- For remote apply: a Supabase project + access token / DB password

**Current environment note:** If Docker or live project credentials are unavailable, migrations and tests are still present under `supabase/` and can be applied when the stack is available. Phase 9 verification status, live probes, and production gates are in [`PHASE_9_VERIFICATION.md`](./PHASE_9_VERIFICATION.md).

---

## Local setup

```bash
# From repo root
npm install

# Start local Supabase (Docker required)
npx supabase start

# Apply migrations (also done by db reset)
npx supabase db reset

# Or push migrations only to local DB
npx supabase migration up
```

Copy API URL and publishable (anon) key from `npx supabase status` into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key-from-status>
```

Never put the **service_role** key in `NEXT_PUBLIC_*` or browser code.

---

## Remote (hosted) project

1. Create or select a Supabase project in the dashboard.
2. Link the CLI (one-time):

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

3. Review SQL under `supabase/migrations/`, then apply:

   ```bash
   npx supabase db push
   ```

   Prefer `db push` / migration history over pasting SQL blindly into the SQL editor so history stays consistent.

4. Set production/preview env vars to the project URL and **publishable** key only.

---

## Running SQL security tests

Tests live in `supabase/tests/database/rls_and_constraints.test.sql` (pgTAP).

```bash
npx supabase start          # if not already running
npx supabase db reset       # apply migrations cleanly
npx supabase test db        # run pgTAP tests
```

npm scripts:

```bash
npm run db:start
npm run db:reset
npm run db:test
```

### Coverage

1. Duplicate `(user_id, entry_date)` rejected  
2. Negative earnings, km, and expense amounts rejected  
3. Expense cannot reference another user’s daily entry  
4. Expense cannot reference another user’s private category  
5. Authenticated user cannot read/modify another user’s private rows  
6. Shared categories readable; not modifiable by ordinary users  
7. Anonymous users see no private rows and cannot insert entries  
8. Valid owner inserts for entries and expenses succeed  

### Test execution status (Phase 2 agent environment)

| Check | Result |
|-------|--------|
| Migrations authored | Yes — `supabase/migrations/` |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npx supabase start` / `npm run db:test` | **Could not run** — Docker/Podman not installed (`docker: command not found`). Install Docker Desktop or Engine, then run `npm run db:start && npm run db:reset && npm run db:test`. |

---

## RLS ownership summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | own `id` | own `id` | own `id` | own `id` |
| `daily_entries` | own `user_id` | own `user_id` | own `user_id` | own `user_id` |
| `expense_categories` | own **or** `user_id IS NULL` | own only (not shared) | own only | own only |
| `daily_expenses` | own `user_id` | own `user_id` | own `user_id` | own `user_id` |

Anonymous role: no write policies; SELECT policies absent → zero rows under RLS.

---

## Migration files

| File | Contents |
|------|----------|
| `supabase/migrations/20261015120000_init_schema.sql` | Helpers, tables, constraints, indexes, triggers, shared category seed |
| `supabase/migrations/20261015120100_enable_rls.sql` | Enable/FORCE RLS, policies, grants |
| `supabase/migrations/20261015130000_daily_entry_rpc.sql` | Atomic `save_daily_entry` / `delete_daily_entry` RPCs (Phase 4) |

---

## App configuration

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Browser-safe anon/publishable key |

Client module: `src/lib/supabase/client.ts` (throws if env vars missing). Phase 2 does **not** wire UI forms to the database.
