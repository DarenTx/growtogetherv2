import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';

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

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.authSubscription = this.supabase.onAuthStateChange((event, session) => {
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
      const session = await this.supabase.getSession();
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
      const profile = await this.supabase.getProfile();
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

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
