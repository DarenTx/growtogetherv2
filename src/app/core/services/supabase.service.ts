import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  AuthChangeEvent,
  createClient,
  Session,
  Subscription,
  SupabaseClient,
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { GrowthData } from '../models/growth-data.interface';
import { MarketIndex } from '../models/market-index.interface';
import { Profile, RegistrationData } from '../models/profile.interface';

export const SUPABASE_CLIENT_TOKEN = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => createClient(environment.supabaseUrl, environment.supabaseKey),
});

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`[SupabaseService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[SupabaseService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[SupabaseService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[SupabaseService] ${msg}`, ...args),
  };

  /** Redirect URL used by Magic Link emails */
  readonly authCallbackUrl = `${window.location.origin}/auth/callback`;

  // ─── Authentication ───────────────────────────────────────────────────────

  async signInWithEmail(email: string): Promise<void> {
    this.logger.info('Sending magic link to email', email.trim().toLowerCase());
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: this.authCallbackUrl },
    });
    if (error) {
      this.logger.error('signInWithEmail failed', error);
      throw error;
    }
    this.logger.info('Magic link sent successfully');
  }

  async signInWithPhone(phone: string): Promise<void> {
    this.logger.info('Sending OTP to phone', phone);
    const { error } = await this.client.auth.signInWithOtp({ phone });
    if (error) {
      this.logger.error('signInWithPhone failed', error);
      throw error;
    }
    this.logger.info('Phone OTP sent successfully');
  }

  async signOut(): Promise<void> {
    this.logger.info('Signing out');
    const { error } = await this.client.auth.signOut();
    if (error) {
      this.logger.error('signOut failed', error);
      throw error;
    }
    this.logger.info('Signed out successfully');
  }

  async getSession(): Promise<Session | null> {
    this.logger.debug('Getting session');
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      this.logger.error('getSession failed', error);
      throw error;
    }
    this.logger.debug('Session retrieved', data.session ? 'authenticated' : 'unauthenticated');
    return data.session;
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): Subscription {
    this.logger.debug('Subscribing to auth state changes');
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      this.logger.info('Auth state changed', event, session?.user?.email ?? 'no session');
      callback(event, session);
    });
    return data.subscription;
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  async getProfile(): Promise<Profile | null> {
    this.logger.debug('Fetching profile');
    const session = await this.getSession();
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
    const session = await this.getSession();
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
    const profile = await this.getProfile();
    return profile?.is_admin ?? false;
  }

  // ─── Growth Data ─────────────────────────────────────────────────────────

  async getOwnGrowthData(): Promise<GrowthData[]> {
    this.logger.debug('Fetching own growth data');
    const session = await this.getSession();
    if (!session) {
      this.logger.warn('getOwnGrowthData called without active session');
      return [];
    }

    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('user_id', session.user.id)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      this.logger.error('getOwnGrowthData failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} own growth records`);
    return (data ?? []) as GrowthData[];
  }

  async getAllGrowthData(): Promise<GrowthData[]> {
    this.logger.debug('Fetching all growth data');
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      this.logger.error('getAllGrowthData failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} total growth records`);
    return (data ?? []) as GrowthData[];
  }

  async getGrowthDataForYear(year: number): Promise<GrowthData[]> {
    this.logger.debug('Fetching growth data for year', year);
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('year', year)
      .order('month', { ascending: true });

    if (error) {
      this.logger.error('getGrowthDataForYear failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} growth records for ${year}`);
    return (data ?? []) as GrowthData[];
  }

  async saveGrowthData(growthData: Partial<GrowthData>): Promise<void> {
    this.logger.debug('Saving growth data', growthData);
    const { error } = await this.client.from('growth_data').upsert(growthData);
    if (error) {
      this.logger.error('saveGrowthData failed', error);
      throw error;
    }
    this.logger.debug('Growth data saved successfully');
  }

  // ─── Market Indexes ───────────────────────────────────────────────────────

  async getMarketIndexes(): Promise<MarketIndex[]> {
    this.logger.debug('Fetching market indexes');
    const { data, error } = await this.client
      .from('market_indexes')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      this.logger.error('getMarketIndexes failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} market index records`);
    return (data ?? []) as MarketIndex[];
  }

  async saveMarketIndex(marketIndex: Partial<MarketIndex>): Promise<void> {
    this.logger.debug('Saving market index', marketIndex);
    const { error } = await this.client.from('market_indexes').upsert(marketIndex);
    if (error) {
      this.logger.error('saveMarketIndex failed', error);
      throw error;
    }
    this.logger.debug('Market index saved successfully');
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

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
    email: string;
  }): Promise<void> {
    this.logger.info('Admin creating profile for', profileData.email);
    const { error } = await this.client.from('profiles').insert(profileData);
    if (error) {
      this.logger.error('adminCreateProfile failed', error);
      throw error;
    }
    this.logger.info('Profile created successfully for', profileData.email);
  }

  async getGrowthDataByEmailKey(emailKey: string): Promise<GrowthData[]> {
    this.logger.debug('Fetching growth data for email key', emailKey);
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('email_key', emailKey)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      this.logger.error('getGrowthDataByEmailKey failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} growth records for email key`);
    return (data ?? []) as GrowthData[];
  }
}
