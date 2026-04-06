-- Migration: Rename profile email to work_email, add personal_email, and remove phone fields
-- Run this against the Supabase database to apply the schema change.

ALTER TABLE public.profiles
  RENAME COLUMN email TO work_email;

ALTER TABLE public.profiles
  RENAME COLUMN email_verified TO work_email_verified;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_email text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format_check;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_format_check;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_key;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_key;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone_verified;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_work_email_format_check
    CHECK ((work_email IS NULL) OR (work_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_personal_email_format_check
    CHECK ((personal_email IS NULL) OR (personal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_work_email_key UNIQUE (work_email);

DROP FUNCTION IF EXISTS public.complete_registration(text, text, text, text, text);

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
  v_claimed_count integer;
BEGIN
  IF p_invitation_code != 'Fruehling' THEN
    RAISE EXCEPTION 'Invalid invitation code.';
  END IF;

  SELECT COALESCE(profiles.work_email, LOWER(TRIM(p_work_email)))
    INTO v_work_email
  FROM public.profiles
  WHERE id = auth.uid();

  WITH claimed_rows AS (
    UPDATE public.growth_data
    SET user_id = auth.uid()
    WHERE email_key = v_work_email
      AND user_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_claimed_count FROM claimed_rows;

  UPDATE public.profiles
  SET
    first_name = p_first_name,
    last_name = p_last_name,
    work_email = v_work_email,
    personal_email = LOWER(TRIM(p_personal_email)),
    registration_complete = true
  WHERE id = auth.uid();

  RETURN true;
END;
$$;

GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_registration(text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, work_email)
  VALUES (new.id, LOWER(TRIM(new.email)))
  ON CONFLICT (work_email) DO UPDATE SET id = EXCLUDED.id;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_verification_status()
RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    work_email_verified = (new.email_confirmed_at IS NOT NULL),
    work_email = COALESCE(LOWER(TRIM(new.email)), profiles.work_email)
  WHERE id = new.id;
  RETURN new;
END;
$$;