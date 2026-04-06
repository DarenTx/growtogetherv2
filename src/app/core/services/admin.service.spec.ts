import { TestBed } from '@angular/core/testing';
import { AdminService } from './admin.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

const mockChain = {
  select: vi.fn(),
  order: vi.fn(),
  insert: vi.fn(),
};
Object.keys(mockChain).forEach((k) =>
  mockChain[k as keyof typeof mockChain].mockReturnValue(mockChain),
);
const mockFrom = vi.fn(() => mockChain);
const mockClient = { from: mockFrom };

const MOCK_PROFILE = {
  id: 'user-1',
  first_name: 'Jane',
  last_name: 'Doe',
  work_email: 'jane@example.com',
  personal_email: null,
  is_admin: false,
  work_email_verified: false,
  personal_email_verified: false,
  registration_complete: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockChain).forEach((k) =>
      mockChain[k as keyof typeof mockChain].mockReturnValue(mockChain),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(AdminService);
  });

  describe('getAllProfiles', () => {
    it('returns list of profiles', async () => {
      mockChain.order.mockResolvedValue({ data: [MOCK_PROFILE], error: null });
      expect(await service.getAllProfiles()).toEqual([MOCK_PROFILE]);
    });

    it('throws on error', async () => {
      mockChain.order.mockResolvedValue({ error: new Error('DB error') });
      await expect(service.getAllProfiles()).rejects.toThrow('DB error');
    });
  });

  describe('adminCreateProfile', () => {
    it('calls insert with profile data', async () => {
      mockChain.insert.mockResolvedValue({ error: null });
      await service.adminCreateProfile({
        first_name: 'Jane',
        last_name: 'Doe',
        work_email: 'jane@example.com',
      });
      expect(mockChain.insert).toHaveBeenCalledWith({
        first_name: 'Jane',
        last_name: 'Doe',
        work_email: 'jane@example.com',
      });
    });

    it('throws on error', async () => {
      mockChain.insert.mockResolvedValue({ error: new Error('Duplicate') });
      await expect(
        service.adminCreateProfile({
          first_name: 'Jane',
          last_name: 'Doe',
          work_email: 'jane@example.com',
        }),
      ).rejects.toThrow('Duplicate');
    });
  });
});
