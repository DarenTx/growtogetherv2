import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';
import {
  MOCK_SESSION,
  createMockAuthService,
  createMockProfileService,
} from '../testing/mock-supabase.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
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

  it('returns true when user is an admin', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockProfile['isAdmin'] = vi.fn().mockResolvedValue(true);
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects to /dashboard when user is not an admin', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockProfile['isAdmin'] = vi.fn().mockResolvedValue(false);
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/dashboard']));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('redirects to /login when no session', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
    expect(result instanceof UrlTree).toBe(true);
  });
});
