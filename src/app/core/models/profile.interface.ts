export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  work_email: string | null;
  personal_email: string | null;
  is_admin: boolean;
  work_email_verified: boolean;
  personal_email_verified: boolean;
  registration_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegistrationData {
  first_name: string;
  last_name: string;
  work_email: string;
  personal_email: string;
  invitation_code: string;
}
