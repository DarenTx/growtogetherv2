import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from '@supabase/supabase-js';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [],
  templateUrl: './auth-callback.component.html',
})
export class AuthCallbackComponent implements OnInit, OnDestroy {
  readonly status = signal<'loading' | 'error'>('loading');
  readonly errorMessage = signal<string>('');

  private authSubscription: Subscription | null = null;

  private get isPopupContext(): boolean {
    return window.opener !== null && window.opener !== window;
  }

  constructor(
    private readonly auth: AuthService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.authSubscription = this.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        void this.handleSignedIn();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        void this.handleSignedIn();
      } else if (
        event === 'SIGNED_OUT' ||
        // Check for error or no session when expected
        (!session && event !== 'INITIAL_SESSION')
      ) {
        this.handleError('Authentication failed. Your link may have expired.');
      }
    });

    // Also check for an existing session immediately (handles page refresh on callback URL)
    void this.checkExistingSession();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  private async checkExistingSession(): Promise<void> {
    try {
      const session = await this.auth.getSession({ retries: 8, retryDelayMs: 150 });
      if (session) {
        await this.handleSignedIn();
      } else {
        // Check for error params in the URL (e.g. expired magic link)
        const url = window.location.href;
        if (url.includes('error=access_denied') || url.includes('error_code=otp_expired')) {
          await this.router.navigate(['/auth/link-expired']);
        }
      }
    } catch {
      // Let the auth state change listener handle it
    }
  }

  private async handleSignedIn(): Promise<void> {
    try {
      const profile = await this.profileService.getProfile();
      const destination = !profile || !profile.registration_complete ? '/register' : '/dashboard';

      if (this.isPopupContext) {
        this.notifyPopupResult('success', destination);
        return;
      }

      if (!profile || !profile.registration_complete) {
        await this.router.navigate(['/register']);
      } else {
        await this.router.navigate(['/dashboard']);
      }
    } catch {
      this.handleError('Unable to load your profile. Please try again.');
    }
  }

  private handleError(message: string): void {
    if (this.isPopupContext) {
      this.notifyPopupResult('error', '/login', message);
      return;
    }

    // Check if the error is an expired link (Supabase sets specific URL params)
    const url = window.location.href;
    if (
      url.includes('error=access_denied') ||
      url.includes('error_code=otp_expired') ||
      message.toLowerCase().includes('expired')
    ) {
      void this.router.navigate(['/auth/link-expired']);
      return;
    }
    this.errorMessage.set(message);
    this.status.set('error');
  }

  private notifyPopupResult(
    status: 'success' | 'error',
    redirectTo: '/dashboard' | '/register' | '/login',
    message?: string,
  ): void {
    const payload = {
      type: 'gt-auth-popup-result',
      status,
      redirectTo,
      message,
    };

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
    }

    window.close();
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
