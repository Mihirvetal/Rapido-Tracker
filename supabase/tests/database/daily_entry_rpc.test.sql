-- Phase 4 RPC atomicity and ownership tests (requires supabase test db)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated', 'authenticated', 'rpc_a@test.local',
    crypt('test-password-a', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated', 'authenticated', 'rpc_b@test.local',
    crypt('test-password-b', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.authenticate_as(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.as_postgres()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  EXECUTE 'RESET ROLE';
END;
$$;

SELECT pg_temp.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);

-- 1) Create entry with petrol + extra expense
SELECT is(
  (
    SELECT (public.save_daily_entry(
      '2026-10-10'::date,
      1000,
      50,
      'note',
      jsonb_build_array(
        jsonb_build_object(
          'category_id', 'a0000000-0000-4000-8000-000000000001',
          'amount', '200',
          'description', null
        ),
        jsonb_build_object(
          'category_id', 'a0000000-0000-4000-8000-000000000002',
          'amount', '50',
          'description', 'Lunch'
        )
      ),
      NULL
    ) ->> 'ok')
  ),
  'true',
  'save_daily_entry creates entry with expenses'
);

-- 2) Net profit math via stored rows
SELECT is(
  (
    SELECT round(e.total_earnings - coalesce(sum(x.amount), 0), 2)
    FROM public.daily_entries e
    LEFT JOIN public.daily_expenses x ON x.daily_entry_id = e.id
    WHERE e.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND e.entry_date = '2026-10-10'
    GROUP BY e.total_earnings
  ),
  750.00,
  'net profit is earnings minus expenses'
);

-- 3) Duplicate date rejected
SELECT is(
  (
    SELECT public.save_daily_entry(
      '2026-10-10'::date, 10, 1, NULL, '[]'::jsonb, NULL
    ) ->> 'code'
  ),
  'duplicate_date',
  'duplicate date returns duplicate_date'
);

-- 4) Negative earnings rejected
SELECT is(
  (
    SELECT public.save_daily_entry(
      '2026-10-11'::date, -1, 1, NULL, '[]'::jsonb, NULL
    ) ->> 'code'
  ),
  'invalid_earnings',
  'negative earnings rejected'
);

-- 5) Invalid category rejected
SELECT is(
  (
    SELECT public.save_daily_entry(
      '2026-10-12'::date,
      100,
      1,
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'category_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          'amount', '10',
          'description', null
        )
      ),
      NULL
    ) ->> 'code'
  ),
  'invalid_category',
  'invalid category rejected'
);

-- Prepare user B private category and entry
SELECT pg_temp.as_postgres();

INSERT INTO public.expense_categories (id, user_id, name)
VALUES (
  'c2222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'B Only'
);

SELECT pg_temp.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);

-- 6) Cannot attach another user's private category
SELECT is(
  (
    SELECT public.save_daily_entry(
      '2026-10-13'::date,
      100,
      1,
      NULL,
      jsonb_build_array(
        jsonb_build_object(
          'category_id', 'c2222222-2222-4222-8222-222222222222',
          'amount', '10',
          'description', null
        )
      ),
      NULL
    ) ->> 'code'
  ),
  'category_forbidden',
  'cannot use another user private category'
);

-- 7) Failed expense save rolls back (no entry left for that date)
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_entries
    WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND entry_date = '2026-10-13'
  ),
  0,
  'failed expense save rolls back entry insert'
);

-- Capture entry id for delete test
CREATE TEMP TABLE _entry AS
SELECT id
FROM public.daily_entries
WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND entry_date = '2026-10-10';

-- 8) User B cannot delete user A entry
SELECT pg_temp.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid);

SELECT is(
  (
    SELECT public.delete_daily_entry((SELECT id FROM _entry)) ->> 'code'
  ),
  'not_found',
  'user B cannot delete user A entry'
);

-- 9) User A can delete own entry (expenses cascade)
SELECT pg_temp.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);

SELECT is(
  (SELECT public.delete_daily_entry((SELECT id FROM _entry)) ->> 'ok'),
  'true',
  'owner can delete entry'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_expenses
    WHERE daily_entry_id = (SELECT id FROM _entry)
  ),
  0,
  'expenses cascade on delete'
);

SELECT pg_temp.as_postgres();
SELECT * FROM finish();
ROLLBACK;
