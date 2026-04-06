import { inject, Injectable } from '@angular/core';
import { Profile } from '../models/profile.interface';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`[AdminService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[AdminService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[AdminService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[AdminService] ${msg}`, ...args),
  };

  async getAllProfiles(): Promise<Profile[]> {
    this.logger.debug('Fetching all profiles');
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('getAllProfiles failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} profiles`);
    return (data ?? []) as Profile[];
  }

  async adminCreateProfile(profileData: {
    first_name: string;
    last_name: string;
    work_email: string;
  }): Promise<void> {
    this.logger.info('Admin creating profile for', profileData.work_email);
    const { error } = await this.client.from('profiles').insert(profileData);
    if (error) {
      this.logger.error('adminCreateProfile failed', error);
      throw error;
    }
    this.logger.info('Profile created successfully for', profileData.work_email);
  }
}
