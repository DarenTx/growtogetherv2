-- Migration: Fix complete_registration work email fallback and ensure profile upsert
-- Run this against the Supabase database to apply the schema change.

CREATE OR REPLACE FUNCTION public.complete_registration(
  p_first_name text,
  p_last_name text,
  p_work_email text,
  p_personal_email text,
  p_invitation_code text
) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_work_email text;
  v_personal_email text;
  v_claimed_count integer;
BEGIN
  IF p_invitation_code != 'Fruehling' THEN
    RAISE EXCEPTION 'Invalid invitation code.';
  END IF;

  -- Prefer existing profile work_email when present; otherwise use submitted work email.
  v_work_email := COALESCE(
    (
      SELECT NULLIF(LOWER(TRIM(p.work_email)), '')
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    NULLIF(LOWER(TRIM(p_work_email)), '')
  );

  v_personal_email := LOWER(TRIM(p_personal_email));

  UPDATE public.growth_data
  SET user_id = auth.uid()
  WHERE (
    (v_work_email IS NOT NULL AND email_key = v_work_email)
    OR email_key = v_personal_email
  )
    AND user_id IS NULL;

  GET DIAGNOSTICS v_claimed_count = ROW_COUNT;

  IF v_claimed_count = 0 THEN
    RAISE EXCEPTION 'No unclaimed PRR data found. Either your personal or work email must match the email that receives PRR notifications.';
  END IF;

  -- Ensure profile exists and capture registration details.
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    work_email,
    personal_email,
    personal_email_verified,
    registration_complete
  )
  VALUES (
    auth.uid(),
    p_first_name,
    p_last_name,
    v_work_email,
    v_personal_email,
    false,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    work_email = COALESCE(EXCLUDED.work_email, profiles.work_email),
    personal_email = EXCLUDED.personal_email,
    personal_email_verified = CASE
      WHEN profiles.personal_email IS NOT DISTINCT FROM EXCLUDED.personal_email
        THEN COALESCE(profiles.personal_email_verified, false)
      ELSE false
    END,
    registration_complete = true;

  RETURN true;
END;
$$;

GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO service_role;
