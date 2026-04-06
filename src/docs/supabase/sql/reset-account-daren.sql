-- Account reset scripts for local testing
-- Target account: daren@thedahls.us
--
-- WHAT THIS DOES (hard reset):
-- 1) Detaches claimed growth_data rows by setting user_id = NULL
-- 2) Deletes audit log rows for the user (required before deleting auth.users)
-- 3) Deletes the profile row entirely from public.profiles
-- 4) Deletes the auth account from auth.users
--
-- Run in Supabase SQL Editor with a role that can modify auth schema.

-- =========================================================
-- Script A: Preview current state for this email
-- =========================================================
WITH target AS (
  SELECT id, lower(trim(email)) AS email
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim('daren@thedahls.us'))
  LIMIT 1
)
SELECT
  t.id AS user_id,
  t.email,
  p.work_email,
  p.personal_email,
  p.registration_complete,
  (SELECT COUNT(*) FROM public.growth_data gd WHERE gd.user_id = t.id) AS claimed_growth_rows,
  (SELECT COUNT(*) FROM public.audit_logs al WHERE al.performed_by = t.id) AS audit_rows
FROM target t
LEFT JOIN public.profiles p ON p.id = t.id;

-- =========================================================
-- Script B: HARD RESET account (delete profile row + auth user)
-- =========================================================
BEGIN;

DO $$
DECLARE
  v_email text := lower(trim('daren@thedahls.us'));
  v_user_id uuid;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users record found for %', v_email;
  END IF;

  -- Detach prior claimed growth rows so registration can claim them again.
  UPDATE public.growth_data
  SET user_id = NULL
  WHERE user_id = v_user_id;

  -- Required because audit_logs.performed_by has an FK to auth.users without ON DELETE CASCADE.
  DELETE FROM public.audit_logs
  WHERE performed_by = v_user_id;

  -- Delete profile row entirely (requested), not just reset flags.
  DELETE FROM public.profiles
  WHERE id = v_user_id;

  -- Remove the auth account so signup can start from zero.
  DELETE FROM auth.users
  WHERE id = v_user_id;
END
$$;

COMMIT;

-- =========================================================
-- Script C: Verify reset outcome
-- =========================================================
SELECT id, email
FROM auth.users
WHERE lower(trim(email)) = lower(trim('daren@thedahls.us'));

SELECT id, work_email, personal_email, registration_complete
FROM public.profiles
WHERE lower(trim(work_email)) = lower(trim('daren@thedahls.us'));

SELECT COUNT(*) AS growth_rows_still_claimed
FROM public.growth_data gd
WHERE gd.user_id IS NOT NULL
  AND lower(trim(gd.email_key)) = lower(trim('daren@thedahls.us'));
