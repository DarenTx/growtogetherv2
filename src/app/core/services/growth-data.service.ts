import { inject, Injectable } from '@angular/core';
import { GrowthData, PersonBankEntry } from '../models/growth-data.interface';
import { AuthService } from './auth.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class GrowthDataService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly auth = inject(AuthService);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) =>
      console.debug(`[GrowthDataService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[GrowthDataService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[GrowthDataService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) =>
      console.error(`[GrowthDataService] ${msg}`, ...args),
  };

  async getOwnGrowthData(): Promise<GrowthData[]> {
    this.logger.debug('Fetching own growth data');
    const session = await this.auth.getSession();
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

  async getOwnGrowthDataForMonth(
    year: number,
    month: number,
    bankName: string,
  ): Promise<GrowthData | null> {
    this.logger.debug('Fetching own growth data for month', year, month, bankName);
    const session = await this.auth.getSession();
    if (!session) {
      this.logger.warn('getOwnGrowthDataForMonth called without active session');
      return null;
    }

    const email = session.user.email;
    if (!email) {
      this.logger.warn(
        'getOwnGrowthDataForMonth: user has no email (phone-auth only); cannot look up by email_key',
      );
      return null;
    }

    const emailKey = email.toLowerCase();
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('email_key', emailKey)
      .eq('year', year)
      .eq('month', month)
      .eq('bank_name', bankName)
      .limit(1);

    if (error) {
      this.logger.error('getOwnGrowthDataForMonth failed', error);
      throw error;
    }

    if (data && data.length > 1) {
      this.logger.warn('getOwnGrowthDataForMonth returned multiple rows; using first');
    }

    return data && data.length > 0 ? (data[0] as GrowthData) : null;
  }

  async deleteOwnGrowthDataForMonth(year: number, month: number, bankName: string): Promise<void> {
    this.logger.debug('Deleting own growth data for month', year, month, bankName);
    const session = await this.auth.getSession();
    if (!session) {
      this.logger.error('deleteOwnGrowthDataForMonth called without active session');
      throw new Error('Not authenticated');
    }

    // Filter by user_id to align with the RLS policy (USING user_id = auth.uid()).
    // Filtering by email_key would silently no-op on admin-imported rows where user_id IS NULL.
    const { error } = await this.client
      .from('growth_data')
      .delete()
      .eq('user_id', session.user.id)
      .eq('year', year)
      .eq('month', month)
      .eq('bank_name', bankName);

    if (error) {
      this.logger.error('deleteOwnGrowthDataForMonth failed', error);
      throw error;
    }
    this.logger.debug('Own growth data deleted for month successfully');
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
    const { error } = await this.client
      .from('growth_data')
      .upsert(growthData, { onConflict: 'email_key,bank_name,year,month' });
    if (error) {
      this.logger.error('saveGrowthData failed', error);
      throw error;
    }
    this.logger.debug('Growth data saved successfully');
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

  async getPersonBankList(): Promise<PersonBankEntry[]> {
    this.logger.debug('Fetching person-bank list');
    // Queries the person_bank_list view which uses DISTINCT ON in SQL,
    // avoiding a full growth_data scan and client-side deduplication.
    const { data, error } = await this.client
      .from('person_bank_list')
      .select('user_id, bank_name, first_name, last_name')
      .order('last_name')
      .order('first_name')
      .order('bank_name');

    if (error) {
      this.logger.error('getPersonBankList failed', error);
      throw error;
    }

    const rows =
      (data as unknown as Array<{
        user_id: string;
        bank_name: string;
        first_name: string | null;
        last_name: string | null;
      }>) ?? [];

    const entries: PersonBankEntry[] = rows.map((row) => ({
      userId: row.user_id,
      firstName: row.first_name ?? 'Unknown',
      lastName: row.last_name ?? 'Person',
      bankName: row.bank_name,
    }));

    entries.sort((a, b) => {
      const lastCmp = a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase());
      if (lastCmp !== 0) return lastCmp;
      const firstCmp = a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
      if (firstCmp !== 0) return firstCmp;
      return a.bankName.toLowerCase().localeCompare(b.bankName.toLowerCase());
    });

    this.logger.debug(`Resolved ${entries.length} person-bank entries`);
    return entries;
  }

  async getGrowthDataForUserYear(userId: string, year: number): Promise<GrowthData[]> {
    this.logger.debug('Fetching growth data for user year', userId, year);
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('month', { ascending: true })
      .order('bank_name', { ascending: true });

    if (error) {
      this.logger.error('getGrowthDataForUserYear failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} growth records for user year`);
    return (data ?? []) as GrowthData[];
  }

  async getGrowthDataForYearMonth(year: number, month: number): Promise<GrowthData[]> {
    this.logger.debug('Fetching growth data for year/month', year, month);
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('user_id', { ascending: true })
      .order('bank_name', { ascending: true });

    if (error) {
      this.logger.error('getGrowthDataForYearMonth failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} growth records for year/month`);
    return (data ?? []) as GrowthData[];
  }
}
