import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { MOCK_SESSION, createMockSupabaseService } from '../testing/mock-supabase.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(() => {
    mockService = createMockSupabaseService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    });
  });

  it('returns true when a session exists', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects to /login when no session', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
    expect(result instanceof UrlTree).toBe(true);
  });
});
