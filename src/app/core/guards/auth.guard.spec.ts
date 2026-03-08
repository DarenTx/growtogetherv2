import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MOCK_SESSION, createMockAuthService } from '../testing/mock-supabase.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuth: Record<string, any>;

  beforeEach(() => {
    mockAuth = createMockAuthService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuth }],
    });
  });

  it('returns true when a session exists', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects to /login when no session', async () => {
    mockAuth['getSession'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
    expect(result instanceof UrlTree).toBe(true);
  });
});
