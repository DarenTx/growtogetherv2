import { inject, Injectable } from '@angular/core';
import { Profile, RegistrationData } from '../models/profile.interface';
import { AuthService } from './auth.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly auth = inject(AuthService);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`[ProfileService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[ProfileService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[ProfileService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[ProfileService] ${msg}`, ...args),
  };

  async getProfile(): Promise<Profile | null> {
    this.logger.debug('Fetching profile');
    const session = await this.auth.getSession();
    if (!session) {
      this.logger.warn('getProfile called without active session');
      return null;
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      // PGRST116 = row not found – not an error condition here
      if (error.code === 'PGRST116') {
        this.logger.debug('Profile not found for user', session.user.id);
        return null;
      }
      this.logger.error('getProfile failed', error);
      throw error;
    }
    this.logger.debug('Profile fetched successfully');
    return data as Profile;
  }

  async completeRegistration(data: RegistrationData): Promise<boolean> {
    this.logger.info('Completing registration for', data.email);
    const { data: result, error } = await this.client.rpc('complete_registration', {
      p_first_name: data.first_name,
      p_last_name: data.last_name,
      p_phone: data.phone,
      p_email: data.email,
      p_invitation_code: data.invitation_code,
    });
    if (error) {
      this.logger.error('completeRegistration failed', error);
      throw error;
    }
    this.logger.info('Registration completed, result:', result);
    return result as boolean;
  }

  async updateProfile(profile: Partial<Profile>): Promise<void> {
    this.logger.debug('Updating profile', Object.keys(profile));
    const session = await this.auth.getSession();
    if (!session) {
      this.logger.error('updateProfile called without active session');
      throw new Error('Not authenticated');
    }

    const { error } = await this.client.from('profiles').update(profile).eq('id', session.user.id);
    if (error) {
      this.logger.error('updateProfile failed', error);
      throw error;
    }
    this.logger.debug('Profile updated successfully');
  }

  async isAdmin(): Promise<boolean> {
    const session = await this.auth.getSession();
    if (!session) return false;
    const { data, error } = await this.client
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
    if (error) return false;
    return (data as { is_admin: boolean } | null)?.is_admin ?? false;
  }

  async getRegisteredProfiles(): Promise<Profile[]> {
    this.logger.debug('Fetching registered profiles');
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('registration_complete', true)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) {
      this.logger.error('getRegisteredProfiles failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} registered profiles`);
    return (data ?? []) as Profile[];
  }
}
