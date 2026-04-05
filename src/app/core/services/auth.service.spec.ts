import { TestBed } from '@angular/core/testing';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';
import { AuthService } from './auth.service';

const mockGetSession = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignInWithIdToken = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();

const mockClient = {
  auth: {
    getSession: mockGetSession,
    signInWithOtp: mockSignInWithOtp,
    signInWithOAuth: mockSignInWithOAuth,
    signInWithIdToken: mockSignInWithIdToken,
    signOut: mockSignOut,
    onAuthStateChange: mockOnAuthStateChange,
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let openSpy: ReturnType<typeof vi.spyOn>;
  let focusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    focusSpy = vi.fn();
    openSpy = vi.spyOn(window, 'open').mockReturnValue({ focus: focusSpy } as unknown as Window);
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT_TOKEN, useValue: mockClient }],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    openSpy.mockRestore();
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

  describe('signInWithGooglePopup', () => {
    it('opens popup when Supabase returns OAuth URL', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/mock' },
        error: null,
      });

      await service.signInWithGooglePopup();

      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' }),
      );
      expect(window.open).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('throws when popup is blocked', async () => {
      openSpy.mockReturnValue(null);
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/mock' },
        error: null,
      });

      await expect(service.signInWithGooglePopup()).rejects.toThrow('popup was blocked');
    });

    it('throws when Supabase returns an OAuth error', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: new Error('OAuth provider disabled'),
      });

      await expect(service.signInWithGooglePopup()).rejects.toThrow('OAuth provider disabled');
    });
  });

  describe('signInWithGoogleIdToken', () => {
    it('calls signInWithIdToken with google provider and token', async () => {
      mockSignInWithIdToken.mockResolvedValue({ error: null });

      await service.signInWithGoogleIdToken('mock-id-token');

      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'mock-id-token',
      });
    });

    it('throws when Supabase returns an error', async () => {
      mockSignInWithIdToken.mockResolvedValue({ error: new Error('Invalid token') });

      await expect(service.signInWithGoogleIdToken('bad-token')).rejects.toThrow('Invalid token');
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
