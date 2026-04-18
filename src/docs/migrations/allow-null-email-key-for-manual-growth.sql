-- Migration: Allow NULL email_key for manually entered monthly growth rows
-- Run this against the Supabase database to apply the schema change.

ALTER TABLE public.growth_data
  ALTER COLUMN email_key DROP NOT NULL;
