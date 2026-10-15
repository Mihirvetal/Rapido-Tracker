-- Rapido Income Tracker — Phase 2 Row Level Security
-- Authenticated users only access their own private rows.
-- Shared expense categories (user_id IS NULL) are readable but not writable by clients.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_expenses FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_delete_own
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- daily_entries
-- ---------------------------------------------------------------------------

CREATE POLICY daily_entries_select_own
  ON public.daily_entries
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY daily_entries_insert_own
  ON public.daily_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY daily_entries_update_own
  ON public.daily_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY daily_entries_delete_own
  ON public.daily_entries
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- expense_categories
-- Own private categories + shared defaults (user_id IS NULL) for SELECT.
-- Shared defaults cannot be inserted, updated, or deleted by clients.
-- ---------------------------------------------------------------------------

CREATE POLICY expense_categories_select_own_or_shared
  ON public.expense_categories
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR user_id IS NULL
  );

CREATE POLICY expense_categories_insert_own
  ON public.expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND user_id IS NOT NULL
  );

CREATE POLICY expense_categories_update_own
  ON public.expense_categories
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND user_id IS NOT NULL
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND user_id IS NOT NULL
  );

CREATE POLICY expense_categories_delete_own
  ON public.expense_categories
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND user_id IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- daily_expenses
-- ---------------------------------------------------------------------------

CREATE POLICY daily_expenses_select_own
  ON public.daily_expenses
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY daily_expenses_insert_own
  ON public.daily_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY daily_expenses_update_own
  ON public.daily_expenses
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY daily_expenses_delete_own
  ON public.daily_expenses
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No policies for the anon role on these tables → denied by default under RLS.
-- Service role bypasses RLS (server-only); never expose service-role keys to the browser.

-- Explicit privileges for API roles (RLS still applies).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_expenses TO authenticated;

-- Do not grant table privileges to anon. RLS would still deny access without
-- policies, but explicit REVOKE/no-GRANT is clearer (see 20261015140000_*).
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.daily_entries FROM anon;
REVOKE ALL ON TABLE public.daily_expenses FROM anon;
REVOKE ALL ON TABLE public.expense_categories FROM anon;
