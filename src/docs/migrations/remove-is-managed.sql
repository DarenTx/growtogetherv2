-- Migration: Remove is_managed column from growth_data
-- Run this against the Supabase database to apply the schema change.

ALTER TABLE public.growth_data DROP COLUMN is_managed;
