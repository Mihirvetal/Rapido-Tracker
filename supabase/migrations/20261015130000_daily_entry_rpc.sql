-- Phase 4: Atomic daily entry save/delete via SECURITY DEFINER RPCs.
-- Verifies auth.uid(), ownership, and category access inside the function.
-- search_path is pinned; grants limited to authenticated.

-- ---------------------------------------------------------------------------
-- save_daily_entry
-- p_expenses: JSON array of { "category_id": uuid, "amount": number|string, "description": string|null }
-- Returns jsonb: { ok, entry_id } or { ok:false, code, message, existing_entry_id? }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_daily_entry(
  p_entry_date date,
  p_total_earnings numeric,
  p_total_km numeric,
  p_notes text DEFAULT NULL,
  p_expenses jsonb DEFAULT '[]'::jsonb,
  p_entry_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_entry_id uuid;
  v_existing_id uuid;
  v_expense jsonb;
  v_category_id uuid;
  v_amount numeric;
  v_description text;
  v_category_owner uuid;
  v_idx integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authenticated',
      'message', 'You must be signed in.'
    );
  END IF;

  IF p_entry_date IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_date',
      'message', 'Entry date is required.'
    );
  END IF;

  IF p_total_earnings IS NULL OR p_total_earnings < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_earnings',
      'message', 'Earnings must be zero or greater.'
    );
  END IF;

  IF p_total_km IS NULL OR p_total_km < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_km',
      'message', 'Kilometres must be zero or greater.'
    );
  END IF;

  IF p_expenses IS NULL OR jsonb_typeof(p_expenses) <> 'array' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_expenses',
      'message', 'Expenses payload is invalid.'
    );
  END IF;

  -- Create or update entry
  IF p_entry_id IS NULL THEN
    SELECT e.id
    INTO v_existing_id
    FROM public.daily_entries AS e
    WHERE e.user_id = v_uid
      AND e.entry_date = p_entry_date;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'duplicate_date',
        'message', 'An entry already exists for this date.',
        'existing_entry_id', v_existing_id
      );
    END IF;

    INSERT INTO public.daily_entries (
      user_id,
      entry_date,
      total_earnings,
      total_km,
      notes
    )
    VALUES (
      v_uid,
      p_entry_date,
      round(p_total_earnings, 2),
      round(p_total_km, 2),
      NULLIF(btrim(COALESCE(p_notes, '')), '')
    )
    RETURNING id INTO v_entry_id;
  ELSE
    SELECT e.id
    INTO v_entry_id
    FROM public.daily_entries AS e
    WHERE e.id = p_entry_id
      AND e.user_id = v_uid
    FOR UPDATE;

    IF v_entry_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'not_found',
        'message', 'Entry not found.'
      );
    END IF;

    -- Changing date must not collide with another of the user's entries
    SELECT e.id
    INTO v_existing_id
    FROM public.daily_entries AS e
    WHERE e.user_id = v_uid
      AND e.entry_date = p_entry_date
      AND e.id <> v_entry_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'duplicate_date',
        'message', 'An entry already exists for this date.',
        'existing_entry_id', v_existing_id
      );
    END IF;

    UPDATE public.daily_entries
    SET
      entry_date = p_entry_date,
      total_earnings = round(p_total_earnings, 2),
      total_km = round(p_total_km, 2),
      notes = NULLIF(btrim(COALESCE(p_notes, '')), '')
    WHERE id = v_entry_id
      AND user_id = v_uid;
  END IF;

  -- Replace expenses atomically within this transaction
  DELETE FROM public.daily_expenses AS x
  WHERE x.daily_entry_id = v_entry_id
    AND x.user_id = v_uid;

  FOR v_expense IN
    SELECT value
    FROM jsonb_array_elements(p_expenses)
  LOOP
    v_idx := v_idx + 1;

    BEGIN
      v_category_id := (v_expense ->> 'category_id')::uuid;
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'invalid_category',
          'message', format('Expense row %s has an invalid category.', v_idx)
        );
    END;

    BEGIN
      v_amount := round((v_expense ->> 'amount')::numeric, 2);
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'invalid_amount',
          'message', format('Expense row %s has an invalid amount.', v_idx)
        );
    END;

    IF v_amount IS NULL OR v_amount < 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'invalid_amount',
        'message', format('Expense row %s amount must be zero or greater.', v_idx)
      );
    END IF;

    -- Skip zero-amount rows (optional empty lines)
    IF v_amount = 0 THEN
      CONTINUE;
    END IF;

    SELECT c.user_id
    INTO v_category_owner
    FROM public.expense_categories AS c
    WHERE c.id = v_category_id
      AND c.is_active = TRUE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'invalid_category',
        'message', format('Expense row %s category was not found.', v_idx)
      );
    END IF;

    IF v_category_owner IS NOT NULL AND v_category_owner IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'category_forbidden',
        'message', 'You cannot use another user''s private category.'
      );
    END IF;

    v_description := NULLIF(btrim(COALESCE(v_expense ->> 'description', '')), '');

    INSERT INTO public.daily_expenses (
      daily_entry_id,
      user_id,
      category_id,
      amount,
      description
    )
    VALUES (
      v_entry_id,
      v_uid,
      v_category_id,
      v_amount,
      v_description
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'entry_id', v_entry_id
  );
END;
$$;

COMMENT ON FUNCTION public.save_daily_entry(date, numeric, numeric, text, jsonb, uuid) IS
  'Atomically create/update a daily entry and replace its expense rows for auth.uid().';

REVOKE ALL ON FUNCTION public.save_daily_entry(date, numeric, numeric, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_daily_entry(date, numeric, numeric, text, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_daily_entry(date, numeric, numeric, text, jsonb, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- delete_daily_entry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_daily_entry(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authenticated',
      'message', 'You must be signed in.'
    );
  END IF;

  IF p_entry_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_id',
      'message', 'Entry id is required.'
    );
  END IF;

  DELETE FROM public.daily_entries AS e
  WHERE e.id = p_entry_id
    AND e.user_id = v_uid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'message', 'Entry not found.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id);
END;
$$;

COMMENT ON FUNCTION public.delete_daily_entry(uuid) IS
  'Deletes own daily entry (expenses cascade) for auth.uid().';

REVOKE ALL ON FUNCTION public.delete_daily_entry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_daily_entry(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_daily_entry(uuid) TO authenticated;
