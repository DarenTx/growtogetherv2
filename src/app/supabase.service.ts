import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async isConnected(): Promise<boolean> {
    const { error } = await this.client.auth.getSession();
    return !error;
  }
}
