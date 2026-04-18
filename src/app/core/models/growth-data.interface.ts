export interface GrowthData {
  id: string;
  email_key: string | null;
  bank_name: string;
  year: number;
  month: number;
  growth_pct: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonBankEntry {
  /** UUID from profiles.id / auth.users.id */
  userId: string;
  firstName: string;
  lastName: string;
  /** Raw bank_name value from growth_data */
  bankName: string;
}
