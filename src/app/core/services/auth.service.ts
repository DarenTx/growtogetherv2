import { inject, Injectable } from '@angular/core';
import { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`[AuthService] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`[AuthService] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[AuthService] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[AuthService] ${msg}`, ...args),
  };

  /** Redirect URL used by Magic Link emails */
  readonly authCallbackUrl = `${window.location.origin}/auth/callback`;

  async getSession(): Promise<Session | null> {
    this.logger.debug('Getting session');
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      this.logger.error('getSession failed', error);
      throw error;
    }
    this.logger.debug('Session retrieved', data.session ? 'authenticated' : 'unauthenticated');
    return data.session;
  }

  async signInWithEmail(email: string): Promise<void> {
    this.logger.info('Sending magic link to email', email.trim().toLowerCase());
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: this.authCallbackUrl },
    });
    if (error) {
      this.logger.error('signInWithEmail failed', error);
      throw error;
    }
    this.logger.info('Magic link sent successfully');
  }

  async signInWithGooglePopup(): Promise<void> {
    this.logger.info('Starting Google OAuth popup sign-in');
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.authCallbackUrl,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      this.logger.error('signInWithGooglePopup failed to create OAuth URL', error);
      throw error;
    }

    const oauthUrl = data?.url;
    if (!oauthUrl) {
      const urlError = new Error('Google sign-in URL was not returned by Supabase.');
      this.logger.error('signInWithGooglePopup missing OAuth URL', urlError);
      throw urlError;
    }

    const popup = window.open(
      oauthUrl,
      'grow-together-google-login',
      'popup=yes,width=520,height=680,left=100,top=100',
    );

    if (!popup) {
      const popupError = new Error('Google sign-in popup was blocked by your browser.');
      this.logger.warn('signInWithGooglePopup popup blocked');
      throw popupError;
    }

    popup.focus();
    this.logger.info('Google OAuth popup opened successfully');
  }

  async signInWithGoogleIdToken(idToken: string): Promise<void> {
    this.logger.info('Signing in with Google ID token');
    const { error } = await this.client.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      this.logger.error('signInWithGoogleIdToken failed', error);
      throw error;
    }

    this.logger.info('Google ID token sign-in successful');
  }

  async signInWithGoogleRedirect(): Promise<void> {
    this.logger.info('Starting Google OAuth redirect sign-in');
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.authCallbackUrl,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      this.logger.error('signInWithGoogleRedirect failed', error);
      throw error;
    }
  }

  async signInWithPhone(phone: string): Promise<void> {
    this.logger.info('Sending OTP to phone', phone);
    const { error } = await this.client.auth.signInWithOtp({ phone });
    if (error) {
      this.logger.error('signInWithPhone failed', error);
      throw error;
    }
    this.logger.info('Phone OTP sent successfully');
  }

  async signOut(): Promise<void> {
    this.logger.info('Signing out');
    const { error } = await this.client.auth.signOut();
    if (error) {
      this.logger.error('signOut failed', error);
      throw error;
    }
    this.logger.info('Signed out successfully');
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): Subscription {
    this.logger.debug('Subscribing to auth state changes');
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      this.logger.info('Auth state changed', event, session?.user?.email ?? 'no session');
      callback(event, session);
    });
    return data.subscription;
  }
}
