import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import {
  MOCK_PROFILE_COMPLETE,
  MOCK_PROFILE_INCOMPLETE,
  MOCK_SESSION,
  createMockAuthService,
  createMockProfileService,
} from '../testing/mock-supabase.service';
import { registrationGuard } from './registration.guard';

describe('registrationGuard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuth: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProfile: Record<string, any>;

  beforeEach(() => {
    mockAuth = createMockAuthService();
    mockProfile = createMockProfileService();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        { provide: ProfileService, useValue: mockProfile },
      ],
    });
  });

  it('returns true when session exists and registration is complete', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockProfile['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to /login when no session', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('redirects to /register when registration is incomplete', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockProfile['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_INCOMPLETE);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/register']));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('redirects to /register when profile is null', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockProfile['getProfile'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/register']));
    expect(result instanceof UrlTree).toBe(true);
  });
});
