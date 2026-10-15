-- Phase 2 database security & integrity tests (pgTAP via `supabase test db`)
-- Requires a running local Supabase stack with migrations applied.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

-- ---------------------------------------------------------------------------
-- Fixtures (run as postgres / bypasses RLS)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _fixture (
  user_a uuid PRIMARY KEY DEFAULT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  user_b uuid NOT NULL DEFAULT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
);

-- Minimal auth.users rows for RLS identity tests
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'user_a@test.local',
    crypt('test-password-a', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"User A"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'user_b@test.local',
    crypt('test-password-b', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"User B"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- Profiles may already exist via handle_new_user; ensure rows for fixtures
INSERT INTO public.profiles (id, full_name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'User A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'User B')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name;

CREATE OR REPLACE FUNCTION pg_temp.authenticate_as(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.clear_auth()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.as_postgres()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  EXECUTE 'RESET ROLE';
END;
$$;

-- Shared category id from seed
CREATE TEMP TABLE _shared AS
SELECT id AS petrol_id
FROM public.expense_categories
WHERE user_id IS NULL AND lower(btrim(name)) = 'petrol'
LIMIT 1;

-- ---------------------------------------------------------------------------
-- 1) Valid owner can create daily entry + expense
-- ---------------------------------------------------------------------------

SELECT pg_temp.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);

SELECT lives_ok(
  $$
    INSERT INTO public.daily_entries (id, user_id, entry_date, total_earnings, total_km)
    VALUES (
      'e1111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-01',
      1250.00,
      85.5
    )
  $$,
  'owner can insert a valid daily entry'
);

SELECT lives_ok(
  $$
    INSERT INTO public.daily_expenses (
      id, daily_entry_id, user_id, category_id, amount, description
    )
    VALUES (
      'f1111111-1111-4111-8111-111111111111',
      'e1111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      (SELECT petrol_id FROM _shared),
      320.00,
      'Fuel'
    )
  $$,
  'owner can insert a valid expense on own entry with shared category'
);

-- ---------------------------------------------------------------------------
-- 2) Duplicate (user_id, entry_date) rejected
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$
    INSERT INTO public.daily_entries (user_id, entry_date, total_earnings, total_km)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-01',
      100,
      10
    )
  $$,
  '23505',
  NULL,
  'duplicate entry for same user and date is rejected'
);

-- ---------------------------------------------------------------------------
-- 3) Negative earnings / km / expense amount rejected
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$
    INSERT INTO public.daily_entries (user_id, entry_date, total_earnings, total_km)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-02',
      -1,
      10
    )
  $$,
  '23514',
  NULL,
  'negative earnings are rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.daily_entries (user_id, entry_date, total_earnings, total_km)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-03',
      100,
      -5
    )
  $$,
  '23514',
  NULL,
  'negative kilometres are rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.daily_expenses (
      daily_entry_id, user_id, category_id, amount
    )
    VALUES (
      'e1111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      (SELECT petrol_id FROM _shared),
      -10
    )
  $$,
  '23514',
  NULL,
  'negative expense amounts are rejected'
);

-- ---------------------------------------------------------------------------
-- 4) User B fixtures (as postgres), then cross-user isolation
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

INSERT INTO public.daily_entries (id, user_id, entry_date, total_earnings, total_km)
VALUES (
  'e2222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '2026-10-01',
  900,
  40
);

INSERT INTO public.expense_categories (id, user_id, name)
VALUES (
  'c2222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'User B Toll'
);

INSERT INTO public.daily_expenses (
  id, daily_entry_id, user_id, category_id, amount
)
VALUES (
  'f2222222-2222-4222-8222-222222222222',
  'e2222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'c2222222-2222-4222-8222-222222222222',
  50
);

-- ---------------------------------------------------------------------------
-- 5) Expense cannot reference another user's daily entry (composite FK)
-- ---------------------------------------------------------------------------

SELECT pg_temp.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);

SELECT throws_ok(
  $$
    INSERT INTO public.daily_expenses (
      daily_entry_id, user_id, category_id, amount
    )
    VALUES (
      'e2222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      (SELECT petrol_id FROM _shared),
      10
    )
  $$,
  '23503',
  NULL,
  'expense cannot reference another user''s daily entry'
);

-- ---------------------------------------------------------------------------
-- 6) Expense cannot reference another user's private category (trigger)
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$
    INSERT INTO public.daily_expenses (
      daily_entry_id, user_id, category_id, amount
    )
    VALUES (
      'e1111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'c2222222-2222-4222-8222-222222222222',
      10
    )
  $$,
  '23514',
  NULL,
  'expense cannot reference another user''s private category'
);

-- ---------------------------------------------------------------------------
-- 7) Cross-user RLS: cannot read/modify another user's private records
-- ---------------------------------------------------------------------------

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_entries
    WHERE id = 'e2222222-2222-4222-8222-222222222222'
  ),
  0,
  'user A cannot select user B daily entry'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_expenses
    WHERE id = 'f2222222-2222-4222-8222-222222222222'
  ),
  0,
  'user A cannot select user B expense'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.expense_categories
    WHERE id = 'c2222222-2222-4222-8222-222222222222'
  ),
  0,
  'user A cannot select user B private category'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.profiles
    WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  0,
  'user A cannot select user B profile'
);

SELECT results_eq(
  $$
    UPDATE public.daily_entries
    SET total_earnings = 1
    WHERE id = 'e2222222-2222-4222-8222-222222222222'
    RETURNING id
  $$,
  $$SELECT NULL::uuid WHERE false$$,
  'user A cannot update user B daily entry'
);

SELECT results_eq(
  $$
    DELETE FROM public.daily_entries
    WHERE id = 'e2222222-2222-4222-8222-222222222222'
    RETURNING id
  $$,
  $$SELECT NULL::uuid WHERE false$$,
  'user A cannot delete user B daily entry'
);

-- ---------------------------------------------------------------------------
-- 8) Shared categories readable; not modifiable by ordinary users
-- ---------------------------------------------------------------------------

SELECT ok(
  (
    SELECT count(*) > 0
    FROM public.expense_categories
    WHERE user_id IS NULL AND lower(btrim(name)) = 'petrol'
  ),
  'authenticated user can read shared categories'
);

SELECT results_eq(
  $$
    UPDATE public.expense_categories
    SET name = 'Hacked Petrol'
    WHERE user_id IS NULL AND lower(btrim(name)) = 'petrol'
    RETURNING id
  $$,
  $$SELECT NULL::uuid WHERE false$$,
  'authenticated user cannot update shared categories'
);

SELECT results_eq(
  $$
    DELETE FROM public.expense_categories
    WHERE user_id IS NULL AND lower(btrim(name)) = 'petrol'
    RETURNING id
  $$,
  $$SELECT NULL::uuid WHERE false$$,
  'authenticated user cannot delete shared categories'
);

SELECT throws_ok(
  $$
    INSERT INTO public.expense_categories (user_id, name)
    VALUES (NULL, 'Should Fail Shared Insert')
  $$,
  '42501',
  NULL,
  'authenticated user cannot insert a shared category'
);

-- ---------------------------------------------------------------------------
-- 9) Anonymous access denied to private records
-- ---------------------------------------------------------------------------

SELECT pg_temp.clear_auth();

-- Under RLS with no anon policies, SELECT returns zero rows (default deny filter).
SELECT is(
  (SELECT count(*)::integer FROM public.daily_entries),
  0,
  'anon cannot see daily_entries rows'
);

SELECT is(
  (SELECT count(*)::integer FROM public.daily_expenses),
  0,
  'anon cannot see daily_expenses rows'
);

SELECT is(
  (SELECT count(*)::integer FROM public.profiles),
  0,
  'anon cannot see profiles rows'
);

SELECT throws_ok(
  $$
    INSERT INTO public.daily_entries (user_id, entry_date, total_earnings, total_km)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-09',
      10,
      1
    )
  $$,
  '42501',
  NULL,
  'anon cannot insert daily_entries'
);

-- ---------------------------------------------------------------------------
-- 10) Owner can still read own rows after isolation checks
-- ---------------------------------------------------------------------------

SELECT pg_temp.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_entries
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  ),
  1,
  'owner can read own daily entry'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_expenses
    WHERE id = 'f1111111-1111-4111-8111-111111111111'
  ),
  1,
  'owner can read own expense'
);

SELECT pg_temp.as_postgres();

SELECT * FROM finish();

ROLLBACK;
