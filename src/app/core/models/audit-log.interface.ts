export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  performed_by: string | null;
  performer_first_name: string | null; // resolved by RPC join
  performer_last_name: string | null; // resolved by RPC join
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}
