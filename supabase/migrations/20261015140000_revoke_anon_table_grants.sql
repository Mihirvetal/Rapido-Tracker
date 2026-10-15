-- Phase 9 defense-in-depth: anon must not hold table privileges on user data.
-- RLS already denies anon (no policies + FORCE RLS); revoke grants so PostgREST
-- cannot rely on SELECT grants alone if policies are ever misconfigured.

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.daily_entries FROM anon;
REVOKE ALL ON TABLE public.daily_expenses FROM anon;
REVOKE ALL ON TABLE public.expense_categories FROM anon;

-- Authenticated privileges remain unchanged (RLS still applies).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expense_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_expenses TO authenticated;
