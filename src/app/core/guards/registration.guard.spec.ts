import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import {
  MOCK_PROFILE_COMPLETE,
  MOCK_PROFILE_INCOMPLETE,
  MOCK_SESSION,
  createMockSupabaseService,
} from '../testing/mock-supabase.service';
import { registrationGuard } from './registration.guard';

describe('registrationGuard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(() => {
    mockService = createMockSupabaseService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    });
  });

  it('returns true when session exists and registration is complete', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to /login when no session', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('redirects to /register when registration is incomplete', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_INCOMPLETE);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/register']));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('redirects to /register when profile is null', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() =>
      registrationGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/register']));
    expect(result instanceof UrlTree).toBe(true);
  });
});
