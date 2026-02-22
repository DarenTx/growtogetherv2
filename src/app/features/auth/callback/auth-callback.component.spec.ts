import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  MOCK_PROFILE_COMPLETE,
  MOCK_PROFILE_INCOMPLETE,
  MOCK_SESSION,
  createMockSupabaseService,
} from '../../../core/testing/mock-supabase.service';
import { AuthCallbackComponent } from './auth-callback.component';

describe('AuthCallbackComponent', () => {
  let fixture: ComponentFixture<AuthCallbackComponent>;
  let component: AuthCallbackComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;
  let router: Router;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    // Prevent immediate navigation in NgOnInit during setup
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    mockService['onAuthStateChange'] = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });

    await TestBed.configureTestingModule({
      imports: [AuthCallbackComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: AuthCallbackComponent },
          { path: 'register', component: AuthCallbackComponent },
          { path: 'login', component: AuthCallbackComponent },
          { path: 'auth/link-expired', component: AuthCallbackComponent },
        ]),
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCallbackComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('creates the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows loading state initially', () => {
    fixture.detectChanges();
    expect(component.status()).toBe('loading');
    const el = fixture.nativeElement.querySelector('p') as HTMLElement;
    expect(el?.textContent?.toLowerCase()).toContain('signing');
  });

  it('navigates to /dashboard when session exists and registration is complete', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('navigates to /register when registration is incomplete', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_INCOMPLETE);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.navigate).toHaveBeenCalledWith(['/register']);
  });

  it('navigates to /register when profile is null', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(null);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.navigate).toHaveBeenCalledWith(['/register']);
  });

  it('navigates to link-expired when URL contains error=access_denied', async () => {
    // Simulate an expired link URL
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/auth/callback?error=access_denied&error_code=otp_expired' },
      writable: true,
    });
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.navigate).toHaveBeenCalledWith(['/auth/link-expired']);
    // Restore
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/' },
      writable: true,
    });
  });

  it('goToLogin navigates to /login', async () => {
    fixture.detectChanges();
    component.goToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('unsubscribes from auth state on destroy', () => {
    const unsubSpy = vi.fn();
    mockService['onAuthStateChange'] = vi.fn().mockReturnValue({ unsubscribe: unsubSpy });
    fixture.detectChanges();
    fixture.destroy();
    expect(unsubSpy).toHaveBeenCalled();
  });
});
