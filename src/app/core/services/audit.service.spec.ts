import { TestBed } from '@angular/core/testing';
import { AuditService } from './audit.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

const mockRpc = vi.fn();
const mockClient = { rpc: mockRpc };

const MOCK_LOG = {
  id: 'log-1',
  table_name: 'profiles',
  record_id: 'rec-1',
  action: 'INSERT',
  performed_by: 'user-1',
  performer_first_name: 'Jane',
  performer_last_name: 'Doe',
  old_data: null,
  new_data: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(AuditService);
  });

  describe('getAuditLogPage', () => {
    it('returns rows and total', async () => {
      mockRpc.mockResolvedValue({ data: { rows: [MOCK_LOG], total: 1 }, error: null });
      const result = await service.getAuditLogPage(0, 100);
      expect(result.rows).toEqual([MOCK_LOG]);
      expect(result.total).toBe(1);
      expect(mockRpc).toHaveBeenCalledWith('get_audit_log_page', { p_offset: 0, p_limit: 100 });
    });

    it('returns empty rows and zero total when data is empty', async () => {
      mockRpc.mockResolvedValue({
        data: { rows: null, total: null },
        error: null,
      });
      const result = await service.getAuditLogPage(0, 100);
      expect(result.rows).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ error: new Error('DB error') });
      await expect(service.getAuditLogPage(0, 100)).rejects.toThrow('DB error');
    });
  });
});
