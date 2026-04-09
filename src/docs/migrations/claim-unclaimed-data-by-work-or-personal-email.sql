-- Migration: Claim unclaimed growth data by work_email or personal_email during registration
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

  SELECT COALESCE(profiles.work_email, LOWER(TRIM(p_work_email)))
    INTO v_work_email
  FROM public.profiles
  WHERE id = auth.uid();

  v_personal_email := LOWER(TRIM(p_personal_email));

  WITH claimed_rows AS (
    UPDATE public.growth_data
    SET user_id = auth.uid()
    WHERE (email_key = v_work_email OR email_key = v_personal_email)
      AND user_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_claimed_count FROM claimed_rows;

  UPDATE public.profiles
  SET
    first_name = p_first_name,
    last_name = p_last_name,
    work_email = v_work_email,
    personal_email = v_personal_email,
    personal_email_verified = CASE
      WHEN profiles.personal_email IS NOT DISTINCT FROM v_personal_email
        THEN COALESCE(profiles.personal_email_verified, false)
      ELSE false
    END,
    registration_complete = true
  WHERE id = auth.uid();

  RETURN true;
END;
$$;

GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO service_role;
