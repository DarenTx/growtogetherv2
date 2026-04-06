-- Diagnostic script for account state
-- Target account: daren@thedahls.us
--
-- Run this in the Supabase SQL Editor after reproducing the problem.
-- Share the results from each query block.

-- =========================================================
-- 1) auth.users rows for this email
-- =========================================================
SELECT
  u.id,
  lower(trim(u.email)) AS email,
  u.created_at,
  u.updated_at,
  u.last_sign_in_at,
  u.email_confirmed_at,
  u.is_sso_user,
  u.is_anonymous,
  u.raw_app_meta_data,
  u.raw_user_meta_data
FROM auth.users u
WHERE lower(trim(u.email)) = lower(trim('daren@thedahls.us'))
ORDER BY u.created_at DESC;

-- =========================================================
-- 2) public.profiles rows that match this email in any relevant column
-- =========================================================
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.work_email,
  p.personal_email,
  p.work_email_verified,
  p.personal_email_verified,
  p.registration_complete,
  p.is_admin,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE lower(trim(coalesce(p.work_email, ''))) = lower(trim('daren@thedahls.us'))
   OR lower(trim(coalesce(p.personal_email, ''))) = lower(trim('daren@thedahls.us'))
ORDER BY p.created_at DESC;

-- =========================================================
-- 3) Join auth.users to profiles by id for this email
-- =========================================================
SELECT
  u.id AS auth_user_id,
  lower(trim(u.email)) AS auth_email,
  u.created_at AS auth_created_at,
  u.last_sign_in_at,
  p.id AS profile_id,
  p.work_email,
  p.personal_email,
  p.registration_complete,
  p.is_admin,
  p.created_at AS profile_created_at,
  p.updated_at AS profile_updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(trim(u.email)) = lower(trim('daren@thedahls.us'));

-- =========================================================
-- 4) Any growth_data rows for this email key, and whether they are claimed
-- =========================================================
SELECT
  gd.id,
  gd.email_key,
  gd.bank_name,
  gd.year,
  gd.month,
  gd.growth_pct,
  gd.user_id,
  gd.created_at,
  gd.updated_at
FROM public.growth_data gd
WHERE lower(trim(gd.email_key)) = lower(trim('daren@thedahls.us'))
ORDER BY gd.year DESC, gd.month DESC, gd.bank_name ASC;

-- =========================================================
-- 5) Count of growth rows still attached to any user for this email key
-- =========================================================
SELECT
  COUNT(*) AS claimed_growth_rows,
  MIN(gd.user_id::text) AS sample_user_id
FROM public.growth_data gd
WHERE lower(trim(gd.email_key)) = lower(trim('daren@thedahls.us'))
  AND gd.user_id IS NOT NULL;

-- =========================================================
-- 6) Audit log rows tied to the current auth user for this email
-- =========================================================
SELECT
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.performed_by,
  al.created_at
FROM public.audit_logs al
WHERE al.performed_by IN (
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim('daren@thedahls.us'))
)
ORDER BY al.created_at DESC;

-- =========================================================
-- 7) Auth sessions for the current auth user
-- =========================================================
SELECT
  s.id,
  s.user_id,
  s.created_at,
  s.updated_at,
  s.factor_id,
  s.not_after,
  s.refreshed_at,
  s.user_agent,
  s.ip,
  s.tag
FROM auth.sessions s
WHERE s.user_id IN (
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim('daren@thedahls.us'))
)
ORDER BY s.created_at DESC;

-- =========================================================
-- 8) Auth identities for the current auth user
-- =========================================================
SELECT
  i.id,
  i.user_id,
  i.provider,
  i.identity_data,
  i.created_at,
  i.updated_at,
  i.last_sign_in_at
FROM auth.identities i
WHERE i.user_id IN (
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim('daren@thedahls.us'))
)
ORDER BY i.created_at DESC;

-- =========================================================
-- 9) Quick summary in one row
-- =========================================================
WITH auth_rows AS (
  SELECT id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim('daren@thedahls.us'))
),
profile_rows AS (
  SELECT id, registration_complete
  FROM public.profiles
  WHERE lower(trim(coalesce(work_email, ''))) = lower(trim('daren@thedahls.us'))
     OR lower(trim(coalesce(personal_email, ''))) = lower(trim('daren@thedahls.us'))
),
growth_rows AS (
  SELECT user_id
  FROM public.growth_data
  WHERE lower(trim(email_key)) = lower(trim('daren@thedahls.us'))
)
SELECT
  (SELECT COUNT(*) FROM auth_rows) AS auth_user_count,
  (SELECT COUNT(*) FROM profile_rows) AS profile_count,
  (SELECT COUNT(*) FROM profile_rows WHERE registration_complete = true) AS registered_profile_count,
  (SELECT COUNT(*) FROM growth_rows) AS growth_row_count,
  (SELECT COUNT(*) FROM growth_rows WHERE user_id IS NOT NULL) AS claimed_growth_row_count;
