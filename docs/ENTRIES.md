# Daily Entry CRUD — Phase 4

## Routes

| Route | Purpose |
|-------|---------|
| `/entries/new` | Create a daily entry |
| `/entries/[id]` | Edit / delete an existing entry |
| `/entries` | Entry history (live data) |

Dashboard mock metrics and Reports mock UI are unchanged. History is the live entry list.

## Atomic save design

Mutations go through PostgreSQL RPCs (migration `20261015130000_daily_entry_rpc.sql`):

- `save_daily_entry(...)` — create/update entry and replace expense rows in one transaction
- `delete_daily_entry(id)` — delete own entry (expenses cascade via FK)

Both are `SECURITY DEFINER` with:

- `SET search_path = public`
- `auth.uid()` checks
- ownership and category access validation
- `EXECUTE` granted only to `authenticated` (revoked from `PUBLIC` / `anon`)

Petrol is stored as an expense under the shared Petrol category id  
`a0000000-0000-4000-8000-000000000001`, not as a second parallel total.

Net operating profit is always calculated: earnings − sum(expenses). It is never stored.

## Money handling

Server validation uses integer paise (`src/lib/money.ts`) so authoritative amounts are not IEEE floats. Values are sent to Postgres as numeric strings with 2 decimal places.

## Apply migration

```bash
npx supabase db reset   # local
# or
npx supabase db push    # linked remote
```

## Tests

```bash
npm run db:test
```

Includes `supabase/tests/database/daily_entry_rpc.test.sql` (requires Docker + `supabase start`).
