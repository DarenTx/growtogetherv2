-- Fix incorrect email for Daren Dahl
-- Change from daren.dahl@fmr.com to daren@thedahls.us

UPDATE public.growth_data
SET email_key = 'daren@thedahls.us'
WHERE email_key = 'daren.dahl@fmr.com';
