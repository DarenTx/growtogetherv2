import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';
import { ProfileService } from './profile.service';

const mockGetSession = vi.fn();
const mockRpc = vi.fn();

const mockSelectChain = {
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
};
Object.keys(mockSelectChain).forEach((key) => {
  const k = key as keyof typeof mockSelectChain;
  mockSelectChain[k].mockReturnValue(mockSelectChain);
});

const mockFrom = vi.fn(() => mockSelectChain);

const mockClient = {
  auth: { getSession: mockGetSession },
  from: mockFrom,
  rpc: mockRpc,
};

const MOCK_SESSION = { user: { id: 'user-uuid-1', email: 'john@example.com' } };
const MOCK_PROFILE = {
  id: 'user-uuid-1',
  first_name: 'John',
  last_name: 'Doe',
  work_email: 'john@example.com',
  personal_email: 'john.personal@example.com',
  is_admin: false,
  work_email_verified: true,
  personal_email_verified: false,
  registration_complete: true,
};

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSelectChain).forEach((key) => {
      const k = key as keyof typeof mockSelectChain;
      mockSelectChain[k].mockReturnValue(mockSelectChain);
    });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(ProfileService);
    // Mock AuthService.getSession via the injected AuthService
    vi.spyOn(TestBed.inject(AuthService), 'getSession').mockImplementation(async () => null);
  });

  describe('getProfile', () => {
    it('returns profile when session and profile exist', async () => {
      vi.spyOn(TestBed.inject(AuthService), 'getSession').mockResolvedValue(MOCK_SESSION as never);
      mockSelectChain.single.mockResolvedValue({ data: MOCK_PROFILE, error: null });
      expect(await service.getProfile()).toEqual(MOCK_PROFILE);
    });

    it('returns null when no session', async () => {
      vi.spyOn(TestBed.inject(AuthService), 'getSession').mockResolvedValue(null);
      expect(await service.getProfile()).toBeNull();
    });

    it('returns null when profile row not found (PGRST116)', async () => {
      vi.spyOn(TestBed.inject(AuthService), 'getSession').mockResolvedValue(MOCK_SESSION as never);
      mockSelectChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      expect(await service.getProfile()).toBeNull();
    });

    it('throws on unexpected DB error', async () => {
      vi.spyOn(TestBed.inject(AuthService), 'getSession').mockResolvedValue(MOCK_SESSION as never);
      mockSelectChain.single.mockResolvedValue({
        data: null,
        error: { code: '500', message: 'DB error' },
      });
      await expect(service.getProfile()).rejects.toBeTruthy();
    });
  });

  describe('completeRegistration', () => {
    it('calls the RPC and returns true', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await service.completeRegistration({
        first_name: 'John',
        last_name: 'Doe',
        work_email: 'john@example.com',
        personal_email: 'john.personal@example.com',
        invitation_code: 'Fruehling',
      });
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        'complete_registration',
        expect.objectContaining({
          p_work_email: 'john@example.com',
          p_personal_email: 'john.personal@example.com',
          p_invitation_code: 'Fruehling',
        }),
      );
    });

    it('throws when invitation code is invalid', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('Invalid invitation code.') });
      await expect(
        service.completeRegistration({
          first_name: 'John',
          last_name: 'Doe',
          work_email: 'john@example.com',
          personal_email: 'john.personal@example.com',
          invitation_code: 'wrong',
        }),
      ).rejects.toThrow('Invalid invitation code.');
    });
  });

  describe('isAdmin', () => {
    it('returns true when profile has is_admin = true', async () => {
      vi.spyOn(TestBed.inject(AuthService), 'getSession').mockResolvedValue(MOCK_SESSION as never);
      mockSelectChain.single.mockResolvedValue({
        data: { ...MOCK_PROFILE, is_admin: true },
        error: null,
      });
      expect(await service.isAdmin()).toBe(true);
    });

    it('returns false when profile has is_admin = false', async () => {
      vi.spyOn(TestBed.inject(AuthService), 'getSession').mockResolvedValue(MOCK_SESSION as never);
      mockSelectChain.single.mockResolvedValue({ data: MOCK_PROFILE, error: null });
      expect(await service.isAdmin()).toBe(false);
    });
  });
});
