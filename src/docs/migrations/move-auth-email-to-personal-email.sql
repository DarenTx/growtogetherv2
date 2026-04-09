-- Migration: Move auth email sync from work_email to personal_email fields
-- Run this against the Supabase database to apply the schema change.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, personal_email, personal_email_verified)
  VALUES (
    new.id,
    LOWER(TRIM(new.email)),
    (new.email_confirmed_at IS NOT NULL)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    personal_email = EXCLUDED.personal_email,
    personal_email_verified = EXCLUDED.personal_email_verified;

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
    personal_email_verified = (new.email_confirmed_at IS NOT NULL),
    personal_email = COALESCE(LOWER(TRIM(new.email)), profiles.personal_email)
  WHERE id = new.id;

  RETURN new;
END;
$$;
