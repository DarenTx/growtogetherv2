import { inject, Injectable } from '@angular/core';
import { AuditLog } from '../models/audit-log.interface';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`[AuditService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[AuditService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[AuditService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[AuditService] ${msg}`, ...args),
  };

  async getAuditLogPage(
    page: number,
    pageSize: number,
  ): Promise<{ rows: AuditLog[]; total: number }> {
    this.logger.debug('Fetching audit log page', page);
    const from = page * pageSize;
    const { data, error } = await this.client.rpc('get_audit_log_page', {
      p_offset: from,
      p_limit: pageSize,
    });

    if (error) {
      this.logger.error('getAuditLogPage failed', error);
      throw error;
    }
    const result = data as { rows: AuditLog[]; total: number };
    return { rows: result.rows ?? [], total: result.total ?? 0 };
  }
}
