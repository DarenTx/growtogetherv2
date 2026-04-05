import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { GrowthDataService } from './growth-data.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

const mockChain = {
  select: vi.fn(),
  eq: vi.fn(),
  limit: vi.fn(),
  delete: vi.fn(),
  order: vi.fn(),
  upsert: vi.fn(),
  not: vi.fn(),
};
Object.keys(mockChain).forEach((k) =>
  mockChain[k as keyof typeof mockChain].mockReturnValue(mockChain),
);

const mockFrom = vi.fn(() => mockChain);
const mockClient = { from: mockFrom };

const MOCK_SESSION = { user: { id: 'u1', email: 'test@example.com' } };
const MOCK_RECORD = {
  id: 'g1',
  email_key: 'test@example.com',
  bank_name: 'Fidelity Investments',
  year: 2025,
  month: 12,
  growth_pct: 3.5,
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('GrowthDataService', () => {
  let service: GrowthDataService;
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockChain).forEach((k) =>
      mockChain[k as keyof typeof mockChain].mockReturnValue(mockChain),
    );

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(GrowthDataService);
    authService = TestBed.inject(AuthService);
    vi.spyOn(authService, 'getSession').mockResolvedValue(MOCK_SESSION as never);
  });

  describe('saveGrowthData', () => {
    it('calls upsert with onConflict', async () => {
      mockChain.upsert.mockResolvedValue({ error: null });
      await service.saveGrowthData(MOCK_RECORD);
      expect(mockChain.upsert).toHaveBeenCalledWith(
        MOCK_RECORD,
        expect.objectContaining({ onConflict: 'email_key,bank_name,year,month' }),
      );
    });

    it('throws on error', async () => {
      mockChain.upsert.mockResolvedValue({ error: new Error('DB error') });
      await expect(service.saveGrowthData(MOCK_RECORD)).rejects.toThrow('DB error');
    });
  });

  describe('getOwnGrowthDataForMonth', () => {
    it('returns null when no record found', async () => {
      mockChain.limit.mockResolvedValue({ data: [], error: null });
      expect(await service.getOwnGrowthDataForMonth(2025, 12, 'Fidelity Investments')).toBeNull();
    });

    it('returns the record when found', async () => {
      mockChain.limit.mockResolvedValue({ data: [MOCK_RECORD], error: null });
      expect(await service.getOwnGrowthDataForMonth(2025, 12, 'Fidelity Investments')).toEqual(
        MOCK_RECORD,
      );
    });

    it('returns null when no session', async () => {
      vi.spyOn(authService, 'getSession').mockResolvedValue(null);
      expect(await service.getOwnGrowthDataForMonth(2025, 12, 'Fidelity Investments')).toBeNull();
    });
  });

  describe('deleteOwnGrowthDataForMonth', () => {
    it('performs delete with correct filters', async () => {
      mockChain.delete.mockReturnValue(mockChain);
      mockChain.eq
        .mockReturnValueOnce(mockChain) // eq('email_key', ...)
        .mockReturnValueOnce(mockChain) // eq('year', ...)
        .mockReturnValueOnce(mockChain) // eq('month', ...)
        .mockResolvedValueOnce({ error: null }); // eq('bank_name', ...) - final
      await service.deleteOwnGrowthDataForMonth(2025, 12, 'Fidelity Investments');
      expect(mockFrom).toHaveBeenCalledWith('growth_data');
    });

    it('throws when not authenticated', async () => {
      vi.spyOn(authService, 'getSession').mockResolvedValue(null);
      await expect(
        service.deleteOwnGrowthDataForMonth(2025, 12, 'Fidelity Investments'),
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('getGrowthDataForYear', () => {
    it('returns an array of records', async () => {
      mockChain.order.mockResolvedValue({ data: [MOCK_RECORD], error: null });
      const result = await service.getGrowthDataForYear(2025);
      expect(result).toEqual([MOCK_RECORD]);
    });

    it('throws on error', async () => {
      mockChain.order.mockResolvedValue({ error: new Error('DB error') });
      await expect(service.getGrowthDataForYear(2025)).rejects.toThrow('DB error');
    });
  });

  describe('getPersonBankList', () => {
    const RAW_ROWS = [
      {
        user_id: 'u1',
        bank_name: 'Fidelity Investments',
        profiles: { first_name: 'Alice', last_name: 'Smith' },
      },
      {
        user_id: 'u2',
        bank_name: 'Edward Jones',
        profiles: { first_name: 'Bob', last_name: 'Jones' },
      },
      // duplicate — should be de-duped
      {
        user_id: 'u1',
        bank_name: 'Fidelity Investments',
        profiles: { first_name: 'Alice', last_name: 'Smith' },
      },
      // null names — should be substituted
      {
        user_id: 'u3',
        bank_name: 'Vanguard',
        profiles: { first_name: null, last_name: null },
      },
    ];

    it('de-duplicates (user_id, bank_name) pairs', async () => {
      mockChain.not = vi.fn().mockResolvedValue({ data: RAW_ROWS, error: null });
      mockChain.select.mockReturnValue(mockChain);

      const result = await service.getPersonBankList();
      const u1Entries = result.filter((e) => e.userId === 'u1');
      expect(u1Entries.length).toBe(1);
    });

    it('substitutes "Unknown" for null first_name and "Person" for null last_name', async () => {
      mockChain.not = vi.fn().mockResolvedValue({ data: RAW_ROWS, error: null });
      mockChain.select.mockReturnValue(mockChain);

      const result = await service.getPersonBankList();
      const u3 = result.find((e) => e.userId === 'u3');
      expect(u3?.firstName).toBe('Unknown');
      expect(u3?.lastName).toBe('Person');
    });

    it('sorts by lastName → firstName → bankName ascending', async () => {
      mockChain.not = vi.fn().mockResolvedValue({ data: RAW_ROWS, error: null });
      mockChain.select.mockReturnValue(mockChain);

      const result = await service.getPersonBankList();
      const lastNames = result.map((e) => e.lastName.toLowerCase());
      expect(lastNames).toEqual([...lastNames].sort());
    });

    it('throws on Supabase error', async () => {
      mockChain.not = vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') });
      mockChain.select.mockReturnValue(mockChain);

      await expect(service.getPersonBankList()).rejects.toThrow('DB error');
    });
  });
});
