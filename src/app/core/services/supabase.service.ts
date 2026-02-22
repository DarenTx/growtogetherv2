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

  /** Redirect URL used by Magic Link emails */
  readonly authCallbackUrl = `${window.location.origin}/auth/callback`;

  // ─── Authentication ───────────────────────────────────────────────────────

  async signInWithEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: this.authCallbackUrl },
    });
    if (error) throw error;
  }

  async signInWithPhone(phone: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({ phone });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): Subscription {
    const { data } = this.client.auth.onAuthStateChange(callback);
    return data.subscription;
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  async getProfile(): Promise<Profile | null> {
    const session = await this.getSession();
    if (!session) return null;

    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      // PGRST116 = row not found – not an error condition here
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as Profile;
  }

  async completeRegistration(data: RegistrationData): Promise<boolean> {
    const { data: result, error } = await this.client.rpc('complete_registration', {
      p_first_name: data.first_name,
      p_last_name: data.last_name,
      p_phone: data.phone,
      p_email: data.email,
      p_invitation_code: data.invitation_code,
    });
    if (error) throw error;
    return result as boolean;
  }

  async updateProfile(profile: Partial<Profile>): Promise<void> {
    const session = await this.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await this.client.from('profiles').update(profile).eq('id', session.user.id);
    if (error) throw error;
  }

  async isAdmin(): Promise<boolean> {
    const profile = await this.getProfile();
    return profile?.is_admin ?? false;
  }

  // ─── Growth Data ─────────────────────────────────────────────────────────

  async getOwnGrowthData(): Promise<GrowthData[]> {
    const session = await this.getSession();
    if (!session) return [];

    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('user_id', session.user.id)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) throw error;
    return (data ?? []) as GrowthData[];
  }

  async getAllGrowthData(): Promise<GrowthData[]> {
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) throw error;
    return (data ?? []) as GrowthData[];
  }

  async saveGrowthData(growthData: Partial<GrowthData>): Promise<void> {
    const { error } = await this.client.from('growth_data').upsert(growthData);
    if (error) throw error;
  }

  // ─── Market Indexes ───────────────────────────────────────────────────────

  async getMarketIndexes(): Promise<MarketIndex[]> {
    const { data, error } = await this.client
      .from('market_indexes')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) throw error;
    return (data ?? []) as MarketIndex[];
  }

  async saveMarketIndex(marketIndex: Partial<MarketIndex>): Promise<void> {
    const { error } = await this.client.from('market_indexes').upsert(marketIndex);
    if (error) throw error;
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Profile[];
  }

  async adminCreateProfile(profileData: {
    first_name: string;
    last_name: string;
    email: string;
  }): Promise<void> {
    const { error } = await this.client.from('profiles').insert(profileData);
    if (error) throw error;
  }

  async getGrowthDataByEmailKey(emailKey: string): Promise<GrowthData[]> {
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('email_key', emailKey)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) throw error;
    return (data ?? []) as GrowthData[];
  }
}
