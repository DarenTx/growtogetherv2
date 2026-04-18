import { inject, Injectable } from '@angular/core';
import { GrowthData, PersonBankEntry } from '../models/growth-data.interface';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

interface OwnMonthlyGrowthEntry {
  bank_name: string;
  growth_pct: number;
}

@Injectable({ providedIn: 'root' })
export class GrowthDataService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
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

    const emailKeys = await this.getCurrentEmailKeys();
    const ownFilter = this.buildOwnDataOrClause(session.user.id, emailKeys);

    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .or(ownFilter)
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
    const emailKeys = await this.getCurrentEmailKeys();
    const ownFilter = this.buildOwnDataOrClause(session.user.id, emailKeys);
    const { data, error } = await this.client
      .from('growth_data')
      .select('*')
      .or(ownFilter)
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

    const emailKeys = await this.getCurrentEmailKeys();
    const ownFilter = this.buildOwnDataOrClause(session.user.id, emailKeys);

    // Filter by user_id first, with email-key fallback so users can edit rows
    // that have not been backfilled with user_id yet.
    const { error } = await this.client
      .from('growth_data')
      .delete()
      .or(ownFilter)
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

  async saveOwnGrowthDataForMonth(
    year: number,
    month: number,
    entries: OwnMonthlyGrowthEntry[],
  ): Promise<void> {
    this.logger.debug('Saving own growth data for month in batch', year, month, entries.length);

    const session = await this.auth.getSession();
    if (!session) {
      this.logger.error('saveOwnGrowthDataForMonth called without active session');
      throw new Error('Not authenticated');
    }

    if (entries.length === 0) {
      this.logger.warn('saveOwnGrowthDataForMonth called with empty entries');
      return;
    }

    const normalizedEntries = entries
      .map((entry) => ({
        bank_name: entry.bank_name.trim(),
        growth_pct: entry.growth_pct,
      }))
      .filter((entry) => entry.bank_name !== '');

    if (normalizedEntries.length === 0) {
      this.logger.warn('saveOwnGrowthDataForMonth had no valid bank names after normalization');
      return;
    }

    const bankNames = normalizedEntries.map((entry) => entry.bank_name);

    const { error: deleteError } = await this.client
      .from('growth_data')
      .delete()
      .eq('user_id', session.user.id)
      .eq('year', year)
      .eq('month', month)
      .in('bank_name', bankNames);

    if (deleteError) {
      this.logger.error('saveOwnGrowthDataForMonth delete step failed', deleteError);
      throw deleteError;
    }

    const rowsToInsert = normalizedEntries.map((entry) => ({
      email_key: null,
      user_id: session.user.id,
      year,
      month,
      bank_name: entry.bank_name,
      growth_pct: entry.growth_pct,
    }));

    const { error: insertError } = await this.client.from('growth_data').insert(rowsToInsert);
    if (insertError) {
      const insertErrorMessage =
        typeof insertError.message === 'string' ? insertError.message.toLowerCase() : '';
      const isEmailKeyNotNullError =
        insertErrorMessage.includes('null value in column "email_key"') &&
        insertErrorMessage.includes('violates not-null constraint');

      if (isEmailKeyNotNullError) {
        this.logger.error('saveOwnGrowthDataForMonth requires migrated schema', insertError);
        throw new Error(
          'Database schema is out of date: growth_data.email_key must allow NULL for manual entries. Apply the latest migration in src/docs/migrations.',
        );
      }

      this.logger.error('saveOwnGrowthDataForMonth insert step failed', insertError);
      throw insertError;
    }

    this.logger.debug('Own growth data batch save completed successfully');
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

  async getAvailableYears(): Promise<number[]> {
    this.logger.debug('Fetching all available years');
    const { data, error } = await this.client
      .from('growth_data')
      .select('year')
      .order('year', { ascending: false });

    if (error) {
      this.logger.error('getAvailableYears failed', error);
      throw error;
    }
    const years = [...new Set((data ?? []).map((r: { year: number }) => r.year))];
    this.logger.debug(`Available years: ${years.join(', ')}`);
    return years;
  }

  async getAvailableYearsForUser(userId: string): Promise<number[]> {
    this.logger.debug('Fetching available years for user', userId);
    const { data, error } = await this.client
      .from('growth_data')
      .select('year')
      .eq('user_id', userId)
      .order('year', { ascending: false });

    if (error) {
      this.logger.error('getAvailableYearsForUser failed', error);
      throw error;
    }
    const years = [...new Set((data ?? []).map((r: { year: number }) => r.year))];
    this.logger.debug(`Available years for user: ${years.join(', ')}`);
    return years;
  }

  async getOwnBankNames(): Promise<string[]> {
    this.logger.debug('Fetching own bank names');
    const session = await this.auth.getSession();
    if (!session) {
      this.logger.warn('getOwnBankNames called without active session');
      return [];
    }

    const emailKeys = await this.getCurrentEmailKeys();
    const ownFilter = this.buildOwnDataOrClause(session.user.id, emailKeys);

    // Query by user_id first, with email fallback, so rows without user_id
    // remain visible for the current user.
    const { data, error } = await this.client
      .from('growth_data')
      .select('bank_name')
      .or(ownFilter)
      .order('bank_name');

    if (error) {
      this.logger.error('getOwnBankNames failed', error);
      throw error;
    }

    const names = [...new Set((data ?? []).map((r: { bank_name: string }) => r.bank_name))];
    this.logger.debug(`Found ${names.length} distinct bank names`);
    return names;
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

  private async getCurrentEmailKeys(): Promise<string[]> {
    const profile = await this.profileService.getProfile();
    const keys = [profile?.personal_email, profile?.work_email]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => !!value);
    return [...new Set(keys)];
  }

  private buildOwnDataOrClause(userId: string, emailKeys: string[]): string {
    const userClause = `user_id.eq.${userId}`;
    const emailClauses = emailKeys.map((email) => `email_key.eq.${email}`);
    return [userClause, ...emailClauses].join(',');
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
