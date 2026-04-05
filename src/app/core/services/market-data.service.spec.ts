import { TestBed } from '@angular/core/testing';
import { MarketDataService } from './market-data.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

const mockChain = {
  select: vi.fn(),
  order: vi.fn(),
  upsert: vi.fn(),
};
Object.keys(mockChain).forEach((k) =>
  mockChain[k as keyof typeof mockChain].mockReturnValue(mockChain),
);
const mockFrom = vi.fn(() => mockChain);
const mockClient = { from: mockFrom };

const MOCK_INDEX = {
  id: 'idx-1',
  index_name: 'S&P 500',
  year: 2025,
  month: 12,
  growth_pct: 3.5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockChain).forEach((k) =>
      mockChain[k as keyof typeof mockChain].mockReturnValue(mockChain),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(MarketDataService);
  });

  describe('getMarketIndexes', () => {
    it('returns list of indexes', async () => {
      mockChain.order
        .mockReturnValueOnce(mockChain)
        .mockResolvedValueOnce({ data: [MOCK_INDEX], error: null });
      expect(await service.getMarketIndexes()).toEqual([MOCK_INDEX]);
    });

    it('throws on error', async () => {
      mockChain.order
        .mockReturnValueOnce(mockChain)
        .mockResolvedValueOnce({ error: new Error('DB error') });
      await expect(service.getMarketIndexes()).rejects.toThrow('DB error');
    });
  });

  describe('saveMarketIndex', () => {
    it('calls upsert', async () => {
      mockChain.upsert.mockResolvedValue({ error: null });
      await service.saveMarketIndex(MOCK_INDEX);
      expect(mockChain.upsert).toHaveBeenCalledWith(MOCK_INDEX);
    });

    it('throws on error', async () => {
      mockChain.upsert.mockResolvedValue({ error: new Error('DB error') });
      await expect(service.saveMarketIndex(MOCK_INDEX)).rejects.toThrow('DB error');
    });
  });
});
