import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  MOCK_PROFILE_COMPLETE,
  MOCK_PROFILE_INCOMPLETE,
  MOCK_SESSION,
  createMockAuthService,
  createMockProfileService,
} from '../../../core/testing/mock-supabase.service';
import { AuthCallbackComponent } from './auth-callback.component';

describe('AuthCallbackComponent', () => {
  let fixture: ComponentFixture<AuthCallbackComponent>;
  let component: AuthCallbackComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // In JSDOM, window.opener is `undefined` (not null), which makes isPopupContext return
    // true (undefined !== null). Set opener to null so the component uses the normal
    // navigation path instead of the popup path (which calls window.close()).
    Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true });

    mockNavigate = vi.fn().mockResolvedValue(true);
    mockService = { ...createMockAuthService(), ...createMockProfileService() };
    // Prevent navigation during setup (checkExistingSession returns early when no session)
    mockService['getSession'] = vi.fn().mockResolvedValue(null);
    mockService['onAuthStateChange'] = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });

    await TestBed.configureTestingModule({
      imports: [AuthCallbackComponent],
      providers: [
        // Mock the Router directly so navigate calls are captured without the Angular
        // router's async initial navigation interfering with the spy.
        { provide: Router, useValue: { navigate: mockNavigate } },
        { provide: AuthService, useValue: mockService },
        { provide: ProfileService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCallbackComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Remove the own property so the prototype's default (undefined) is restored
    try {
      delete (window as any).opener;
    } catch {
      // ignore
    }
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
    await new Promise((r) => setTimeout(r, 0));
    expect(mockNavigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('navigates to /register when registration is incomplete', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_INCOMPLETE);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockNavigate).toHaveBeenCalledWith(['/register']);
  });

  it('navigates to /register when profile is null', async () => {
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue(null);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockNavigate).toHaveBeenCalledWith(['/register']);
  });

  it('navigates to link-expired when URL contains error=access_denied', async () => {
    // Use history.pushState to set the URL without replacing the Location object,
    // which would corrupt JSDOM's internal state for subsequent tests.
    const originalHref = window.location.href;
    window.history.pushState(
      {},
      '',
      '/auth/callback?error=access_denied&error_code=otp_expired',
    );
    try {
      mockService['getSession'] = vi.fn().mockResolvedValue(null);
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
      expect(mockNavigate).toHaveBeenCalledWith(['/auth/link-expired']);
    } finally {
      window.history.pushState({}, '', originalHref);
    }
  });

  it('goToLogin navigates to /login', () => {
    fixture.detectChanges();
    component.goToLogin();
    expect(mockNavigate).toHaveBeenCalledWith(['/login']);
  });

  it('unsubscribes from auth state on destroy', () => {
    const unsubSpy = vi.fn();
    mockService['onAuthStateChange'] = vi.fn().mockReturnValue({ unsubscribe: unsubSpy });
    fixture.detectChanges();
    fixture.destroy();
    expect(unsubSpy).toHaveBeenCalled();
  });
});

