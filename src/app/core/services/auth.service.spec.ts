import { TestBed } from '@angular/core/testing';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';
import { AuthService } from './auth.service';

const mockGetSession = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();

const mockClient = {
  auth: {
    getSession: mockGetSession,
    signInWithOtp: mockSignInWithOtp,
    signOut: mockSignOut,
    onAuthStateChange: mockOnAuthStateChange,
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(AuthService);
  });

  describe('getSession', () => {
    it('returns a session when one exists', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
      const session = await service.getSession();
      expect(session).toEqual({ user: { id: 'u1' } });
    });

    it('returns null when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      expect(await service.getSession()).toBeNull();
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
});
