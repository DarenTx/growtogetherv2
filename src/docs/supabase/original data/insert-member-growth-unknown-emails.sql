-- Insert member growth data for members WITHOUT known email addresses
-- Email is set to NULL — populate manually before running if NOT NULL constraint exists
--
-- Players in this file:
--   Richardson, Todd — Fidelity Investments
--   Sitzman, Julie — Fidelity Investments (Managed)

INSERT INTO public.growth_data (email_key, bank_name, year, month, growth_pct)
VALUES
  (NULL, 'Fidelity Investments', 2019, 1, 11.2),
  (NULL, 'Fidelity Investments', 2019, 2, 16.3),
  (NULL, 'Fidelity Investments', 2019, 4, 23.1),
  (NULL, 'Fidelity Investments', 2019, 5, 11.4),
  (NULL, 'Fidelity Investments (Managed)', 2019, 1, 5.9),
  (NULL, 'Fidelity Investments (Managed)', 2019, 2, 8.2),
  (NULL, 'Fidelity Investments (Managed)', 2019, 3, 9.8),
  (NULL, 'Fidelity Investments (Managed)', 2019, 4, 12.6),
  (NULL, 'Fidelity Investments (Managed)', 2019, 5, 8.9),
  (NULL, 'Fidelity Investments (Managed)', 2019, 6, 14),
  (NULL, 'Fidelity Investments (Managed)', 2019, 7, 14.5),
  (NULL, 'Fidelity Investments (Managed)', 2019, 8, 13.6),
  (NULL, 'Fidelity Investments (Managed)', 2019, 10, 13.6),
  (NULL, 'Fidelity Investments (Managed)', 2019, 12, 22.2),
  (NULL, 'Fidelity Investments (Managed)', 2020, 1, -0.1),
  (NULL, 'Fidelity Investments (Managed)', 2020, 2, -4.7),
  (NULL, 'Fidelity Investments (Managed)', 2020, 3, -15.6),
  (NULL, 'Fidelity Investments (Managed)', 2020, 4, -7.7),
  (NULL, 'Fidelity Investments (Managed)', 2020, 5, -3.7),
  (NULL, 'Fidelity Investments (Managed)', 2020, 6, -0.8),
  (NULL, 'Fidelity Investments (Managed)', 2020, 12, 19.8);
