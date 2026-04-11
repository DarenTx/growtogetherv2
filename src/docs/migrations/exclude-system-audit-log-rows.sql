-- Migration: Exclude system-performed rows from audit log page RPC
-- Run this against the Supabase database to apply the schema change.

CREATE OR REPLACE FUNCTION public.get_audit_log_page(
  p_offset integer,
  p_limit integer
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH visible_logs AS (
    SELECT
      al.id,
      al.table_name,
      al.record_id,
      al.action,
      al.performed_by,
      p.first_name AS performer_first_name,
      p.last_name AS performer_last_name,
      al.old_data,
      al.new_data,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.profiles p ON p.id = al.performed_by
    WHERE NULLIF(BTRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), '') IS NOT NULL
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM visible_logs),
    'rows', (
      SELECT json_agg(r)
      FROM (
        SELECT *
        FROM visible_logs
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r
    )
  );
$$;
