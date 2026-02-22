import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import {
  MOCK_PROFILE_ADMIN,
  MOCK_PROFILE_COMPLETE,
  MOCK_SESSION,
  createMockSupabaseService,
} from '../testing/mock-supabase.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(() => {
    mockService = createMockSupabaseService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    });
  });

  it('returns true when user is an admin', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_ADMIN);
    mockService['isAdmin'] = vi.fn().mockResolvedValue(true);
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects to /dashboard when user is not an admin', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    mockService['isAdmin'] = vi.fn().mockResolvedValue(false);
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/dashboard']));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('redirects to /login when no session', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
    expect(result instanceof UrlTree).toBe(true);
  });
});
