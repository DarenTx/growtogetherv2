-- Account reset scripts for local testing
-- Target account: daren@thedahls.us
--
-- WHAT THIS DOES (hard reset):
-- 1) Finds every auth/profile row tied to this email
-- 2) Detaches claimed growth_data rows by user_id and by email_key
-- 3) Deletes audit log rows for matching users
-- 4) Deletes matching profile rows entirely from public.profiles
-- 5) Deletes matching auth sessions, identities, and auth.users rows
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
-- Script B: HARD RESET account (aggressive cleanup by email + user id)
-- =========================================================
BEGIN;

DO $$
DECLARE
  v_email text := lower(trim('daren@thedahls.us'));
BEGIN
  -- Detach growth rows linked by any matching auth/profile user id.
  UPDATE public.growth_data
  SET user_id = NULL
  WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email

    UNION

    SELECT p.id
    FROM public.profiles p
    WHERE lower(trim(coalesce(p.work_email, ''))) = v_email
       OR lower(trim(coalesce(p.personal_email, ''))) = v_email
  );

  -- Also detach by email key directly so all preloaded history becomes claimable again.
  UPDATE public.growth_data
  SET user_id = NULL
  WHERE lower(trim(email_key)) = v_email;

  -- Required because audit_logs.performed_by has an FK to auth.users without ON DELETE CASCADE.
  DELETE FROM public.audit_logs
  WHERE performed_by IN (
    SELECT u.id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email

    UNION

    SELECT p.id
    FROM public.profiles p
    WHERE lower(trim(coalesce(p.work_email, ''))) = v_email
       OR lower(trim(coalesce(p.personal_email, ''))) = v_email
  );

  -- Remove auth child rows explicitly for a fully clean slate.
  DELETE FROM auth.sessions
  WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
  );

  DELETE FROM auth.identities
  WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
  );

  -- Delete profile rows entirely (requested), not just reset flags.
  DELETE FROM public.profiles
  WHERE id IN (
    SELECT u.id
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_email
  )
     OR lower(trim(coalesce(work_email, ''))) = v_email
     OR lower(trim(coalesce(personal_email, ''))) = v_email;

  -- Remove the auth account so signup can start from zero.
  DELETE FROM auth.users
  WHERE lower(trim(email)) = v_email;
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
