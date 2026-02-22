export interface GrowthData {
  id: string;
  email_key: string;
  bank_name: string;
  is_managed: boolean;
  year: number;
  month: number;
  growth_pct: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}
