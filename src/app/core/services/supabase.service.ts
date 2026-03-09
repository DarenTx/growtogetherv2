import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const SUPABASE_CLIENT_TOKEN = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => createClient(environment.supabaseUrl, environment.supabaseKey),
});

// SupabaseService has been split into focused services:
//   AuthService       -> auth.service.ts
//   ProfileService    -> profile.service.ts
//   GrowthDataService -> growth-data.service.ts
//   MarketDataService -> market-data.service.ts
//   AuditService      -> audit.service.ts
//   AdminService      -> admin.service.ts

/** @deprecated Use the individual focused services instead. */
export class SupabaseService {}
