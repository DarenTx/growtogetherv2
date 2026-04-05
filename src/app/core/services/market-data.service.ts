import { inject, Injectable } from '@angular/core';
import { MarketIndex } from '../models/market-index.interface';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) =>
      console.debug(`[MarketDataService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[MarketDataService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[MarketDataService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) =>
      console.error(`[MarketDataService] ${msg}`, ...args),
  };

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
    const { error } = await this.client
      .from('market_indexes')
      .upsert(marketIndex, { onConflict: 'index_name,year,month' });
    if (error) {
      this.logger.error('saveMarketIndex failed', error);
      throw error;
    }
    this.logger.debug('Market index saved successfully');
  }

  async getMarketIndexesForYear(year: number): Promise<MarketIndex[]> {
    this.logger.debug('Fetching market indexes for year', year);
    const { data, error } = await this.client
      .from('market_indexes')
      .select('*')
      .eq('year', year)
      .order('month', { ascending: true });

    if (error) {
      this.logger.error('getMarketIndexesForYear failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} market index records for year`);
    return (data ?? []) as MarketIndex[];
  }

  async getMarketIndexesForMonth(year: number, month: number): Promise<MarketIndex[]> {
    this.logger.debug('Fetching market indexes for month', year, month);
    const { data, error } = await this.client
      .from('market_indexes')
      .select('*')
      .eq('year', year)
      .eq('month', month);

    if (error) {
      this.logger.error('getMarketIndexesForMonth failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} market index records for month`);
    return (data ?? []) as MarketIndex[];
  }
}
