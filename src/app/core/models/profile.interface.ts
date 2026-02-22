export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_admin: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  registration_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegistrationData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  invitation_code: string;
}
