import { TestBed } from '@angular/core/testing';
import { SUPABASE_CLIENT_TOKEN, SupabaseService } from './supabase.service';

// Variables starting with "mock" are hoisted by vitest alongside vi.mock
const mockGetSession = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockRpc = vi.fn();

const mockSelectChain = {
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  order: vi.fn(),
};

// Make each chain method return `this` by default
Object.keys(mockSelectChain).forEach((key) => {
  const k = key as keyof typeof mockSelectChain;
  mockSelectChain[k].mockReturnValue(mockSelectChain);
});

const mockFrom = vi.fn(() => mockSelectChain);

const mockClient = {
  auth: {
    getSession: mockGetSession,
    signInWithOtp: mockSignInWithOtp,
    signOut: mockSignOut,
    onAuthStateChange: mockOnAuthStateChange,
  },
  from: mockFrom,
  rpc: mockRpc,
};

const MOCK_SESSION = {
  user: { id: 'user-uuid-1' },
  access_token: 'token',
};

const MOCK_PROFILE = {
  id: 'user-uuid-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '+12125551234',
  is_admin: false,
  email_verified: true,
  phone_verified: false,
  registration_complete: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain stubs
    Object.keys(mockSelectChain).forEach((key) => {
      const k = key as keyof typeof mockSelectChain;
      mockSelectChain[k].mockReturnValue(mockSelectChain);
    });

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(SupabaseService);
  });

  describe('getSession', () => {
    it('returns a session when one exists', async () => {
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
      const session = await service.getSession();
      expect(session).toEqual(MOCK_SESSION);
    });

    it('returns null when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const session = await service.getSession();
      expect(session).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Network error'),
      });
      await expect(service.getSession()).rejects.toThrow('Network error');
    });
  });

  describe('signInWithEmail', () => {
    it('calls signInWithOtp with normalized email and redirect', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });
      await service.signInWithEmail('User@Example.COM');
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
      );
    });

    it('throws when signInWithOtp returns an error', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: new Error('Rate limited') });
      await expect(service.signInWithEmail('user@example.com')).rejects.toThrow('Rate limited');
    });
  });

  describe('signInWithPhone', () => {
    it('calls signInWithOtp with the provided phone', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });
      await service.signInWithPhone('+12125551234');
      expect(mockSignInWithOtp).toHaveBeenCalledWith({ phone: '+12125551234' });
    });

    it('throws on error', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: new Error('Invalid phone') });
      await expect(service.signInWithPhone('+12125551234')).rejects.toThrow('Invalid phone');
    });
  });

  describe('signOut', () => {
    it('calls supabase signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      await service.signOut();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      mockSignOut.mockResolvedValue({ error: new Error('Sign out failed') });
      await expect(service.signOut()).rejects.toThrow('Sign out failed');
    });
  });

  describe('onAuthStateChange', () => {
    it('returns a subscription', () => {
      const mockSubscription = { unsubscribe: vi.fn() };
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } });
      const sub = service.onAuthStateChange(vi.fn());
      expect(sub).toBe(mockSubscription);
    });
  });

  describe('getProfile', () => {
    it('returns profile when session and profile exist', async () => {
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
      mockSelectChain.single.mockResolvedValue({ data: MOCK_PROFILE, error: null });

      const profile = await service.getProfile();
      expect(profile).toEqual(MOCK_PROFILE);
    });

    it('returns null when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const profile = await service.getProfile();
      expect(profile).toBeNull();
    });

    it('returns null when profile row not found (PGRST116)', async () => {
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
      mockSelectChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const profile = await service.getProfile();
      expect(profile).toBeNull();
    });

    it('throws on unexpected DB error', async () => {
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
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
        email: 'john@example.com',
        phone: '+12125551234',
        invitation_code: 'Fruehling',
      });
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        'complete_registration',
        expect.objectContaining({ p_invitation_code: 'Fruehling' }),
      );
    });

    it('throws when invitation code is invalid', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('Invalid invitation code.') });
      await expect(
        service.completeRegistration({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+12125551234',
          invitation_code: 'wrong',
        }),
      ).rejects.toThrow('Invalid invitation code.');
    });
  });

  describe('isAdmin', () => {
    it('returns true when profile has is_admin = true', async () => {
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
      mockSelectChain.single.mockResolvedValue({
        data: { ...MOCK_PROFILE, is_admin: true },
        error: null,
      });
      expect(await service.isAdmin()).toBe(true);
    });

    it('returns false when profile has is_admin = false', async () => {
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });
      mockSelectChain.single.mockResolvedValue({ data: MOCK_PROFILE, error: null });
      expect(await service.isAdmin()).toBe(false);
    });
  });
});
