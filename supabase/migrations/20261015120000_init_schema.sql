-- Rapido Income Tracker — Phase 2 schema
-- Tables, constraints, indexes, triggers, and shared category seeds.
-- Profit is never stored; derive as earnings − sum(expenses) in application queries.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Sets updated_at to now() on row UPDATE.';

-- Creates a profiles row when a new auth.users row is inserted.
-- SECURITY DEFINER so the insert succeeds under the auth admin path.
-- Does not grant broader privileges; search_path is pinned to public.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'After signup: insert a matching public.profiles row (id = auth.users.id). Minimal metadata only; no auth UI in Phase 2.';

-- Ensures daily_expenses.category_id is a shared default (user_id IS NULL)
-- or a private category owned by the same user as the expense.
CREATE OR REPLACE FUNCTION public.enforce_expense_category_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_owner uuid;
BEGIN
  SELECT c.user_id
  INTO category_owner
  FROM public.expense_categories AS c
  WHERE c.id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expense category % does not exist', NEW.category_id
      USING ERRCODE = '23503';
  END IF;

  IF category_owner IS NOT NULL AND category_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION
      'cannot use another user''s private expense category'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_expense_category_access() IS
  'DB-level guard: expenses may only use shared categories or the owner''s private categories. Complements RLS; composite FK handles daily_entry ownership.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.profiles IS
  'One profile per auth user. Auto-created by handle_new_user on signup.';

-- ---------------------------------------------------------------------------
-- daily_entries
-- ---------------------------------------------------------------------------

CREATE TABLE public.daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  total_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  total_km numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_entries_user_date_key UNIQUE (user_id, entry_date),
  CONSTRAINT daily_entries_earnings_non_negative CHECK (total_earnings >= 0),
  CONSTRAINT daily_entries_km_non_negative CHECK (total_km >= 0),
  -- Supports composite FK from daily_expenses (daily_entry_id, user_id)
  CONSTRAINT daily_entries_id_user_key UNIQUE (id, user_id)
);

CREATE INDEX daily_entries_user_id_entry_date_idx
  ON public.daily_entries (user_id, entry_date DESC);

CREATE INDEX daily_entries_entry_date_idx
  ON public.daily_entries (entry_date DESC);

CREATE TRIGGER daily_entries_set_updated_at
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.daily_entries IS
  'One work-day record per user. Net profit is not stored; compute earnings − expenses.';

-- ---------------------------------------------------------------------------
-- expense_categories
-- ---------------------------------------------------------------------------

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL user_id = shared default category available to all authenticated users
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_name_not_blank CHECK (length(btrim(name)) > 0)
);

-- Case- and whitespace-insensitive uniqueness for private categories
CREATE UNIQUE INDEX expense_categories_user_name_uidx
  ON public.expense_categories (user_id, lower(btrim(name)))
  WHERE user_id IS NOT NULL;

-- Case- and whitespace-insensitive uniqueness for shared defaults
CREATE UNIQUE INDEX expense_categories_shared_name_uidx
  ON public.expense_categories (lower(btrim(name)))
  WHERE user_id IS NULL;

CREATE INDEX expense_categories_user_id_idx
  ON public.expense_categories (user_id)
  WHERE user_id IS NOT NULL;

CREATE TRIGGER expense_categories_set_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.expense_categories IS
  'Private categories (user_id set) and shared defaults (user_id NULL). Shared rows are read-only for ordinary users via RLS.';

-- Deterministic shared defaults (fixed UUIDs). Safe to re-run: ON CONFLICT (id) DO NOTHING.
INSERT INTO public.expense_categories (id, user_id, name, is_active)
VALUES
  ('a0000000-0000-4000-8000-000000000001'::uuid, NULL, 'Petrol', TRUE),
  ('a0000000-0000-4000-8000-000000000002'::uuid, NULL, 'Food', TRUE),
  ('a0000000-0000-4000-8000-000000000003'::uuid, NULL, 'Maintenance', TRUE),
  ('a0000000-0000-4000-8000-000000000004'::uuid, NULL, 'Parking', TRUE),
  ('a0000000-0000-4000-8000-000000000005'::uuid, NULL, 'Other', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- daily_expenses
-- ---------------------------------------------------------------------------

CREATE TABLE public.daily_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_entry_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.expense_categories (id),
  amount numeric(12, 2) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_expenses_amount_non_negative CHECK (amount >= 0),
  -- Ownership consistency: expense.user_id must match parent daily_entries.user_id
  CONSTRAINT daily_expenses_entry_user_fkey
    FOREIGN KEY (daily_entry_id, user_id)
    REFERENCES public.daily_entries (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX daily_expenses_user_id_idx
  ON public.daily_expenses (user_id);

CREATE INDEX daily_expenses_daily_entry_id_idx
  ON public.daily_expenses (daily_entry_id);

CREATE INDEX daily_expenses_category_id_idx
  ON public.daily_expenses (category_id);

CREATE INDEX daily_expenses_user_created_idx
  ON public.daily_expenses (user_id, created_at DESC);

CREATE TRIGGER daily_expenses_set_updated_at
  BEFORE UPDATE ON public.daily_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER daily_expenses_enforce_category_access
  BEFORE INSERT OR UPDATE OF category_id, user_id
  ON public.daily_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_expense_category_access();

COMMENT ON TABLE public.daily_expenses IS
  'Line-item expenses for a daily entry. Owner must match parent entry (composite FK). Category must be shared or owned (trigger).';

COMMENT ON CONSTRAINT daily_expenses_entry_user_fkey ON public.daily_expenses IS
  'Composite FK ensures expense.user_id always equals the parent daily_entries.user_id at the database level.';
