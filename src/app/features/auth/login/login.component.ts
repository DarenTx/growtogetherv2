import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  isEmail,
  isValidPhone,
  normalizeEmail,
  normalizeToE164,
} from '../../../core/utils/phone.utils';
import { environment } from '../../../../environments/environment';

type LoginState = 'idle' | 'google-loading' | 'magic-link-loading' | 'sent' | 'error';

type GoogleCredentialResponse = {
  credential: string;
};

type GooglePromptNotification = {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason(): string;
  getSkippedReason(): string;
  getDismissedReason(): string;
};

type GoogleIdentityClient = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    use_fedcm_for_prompt?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
  }): void;
  prompt(listener?: (notification: GooglePromptNotification) => void): void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityClient;
      };
    };
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  readonly state = signal<LoginState>('idle');
  readonly errorMessage = signal<string>('');
  readonly sentTo = signal<string>('');
  readonly phoneError = signal<string>('');
  readonly googleInProgress = signal<boolean>(false);
  readonly oneTapReady = signal<boolean>(false);

  readonly form = new FormGroup({
    identifier: new FormControl('', [Validators.required]),
  });

  constructor(
    private readonly auth: AuthService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    void this.startGoogleOneTap();
  }

  ngOnDestroy(): void {}

  get identifierControl(): FormControl {
    return this.form.get('identifier') as FormControl;
  }

  onIdentifierBlur(): void {
    const value = this.identifierControl.value as string;
    if (!value?.trim()) {
      this.phoneError.set('');
      return;
    }
    if (!isEmail(value) && !isValidPhone(value)) {
      this.phoneError.set('Invalid phone number. Please enter a valid phone number.');
    } else {
      this.phoneError.set('');
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = (this.identifierControl.value as string).trim();
    this.phoneError.set('');
    this.state.set('magic-link-loading');
    this.errorMessage.set('');

    try {
      if (isEmail(rawValue)) {
        const email = normalizeEmail(rawValue);
        await this.auth.signInWithEmail(email);
        this.sentTo.set(email);
        this.state.set('sent');
      } else {
        const e164 = normalizeToE164(rawValue);
        if (!e164) {
          this.phoneError.set('Invalid phone number. Please enter a valid phone number.');
          this.state.set('idle');
          return;
        }
        await this.auth.signInWithPhone(e164);
        this.sentTo.set(e164);
        this.state.set('sent');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      this.errorMessage.set(message);
      this.state.set('error');
    }
  }

  async continueWithGoogle(): Promise<void> {
    if (this.googleInProgress()) {
      return;
    }

    this.googleInProgress.set(true);
    this.errorMessage.set('');
    this.state.set('google-loading');

    try {
      await this.auth.signInWithGoogleRedirect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in could not be started.';
      this.errorMessage.set(message);
      this.state.set('error');
      this.googleInProgress.set(false);
    }
  }

  async startGoogleOneTap(): Promise<void> {
    if (this.googleInProgress()) {
      return;
    }

    this.googleInProgress.set(true);
    this.errorMessage.set('');
    this.state.set('google-loading');

    try {
      const idClient = await this.getGoogleIdentityClient();
      this.oneTapReady.set(true);
      idClient.prompt((notification) => {
        const dismissed = notification.isDismissedMoment();
        const unavailable = notification.isNotDisplayed() || notification.isSkippedMoment();
        const reason = notification.isNotDisplayed()
          ? notification.getNotDisplayedReason()
          : notification.isSkippedMoment()
            ? notification.getSkippedReason()
            : notification.getDismissedReason();

        if (!dismissed && !unavailable) {
          return;
        }

        this.googleInProgress.set(false);

        // Auto One Tap should fail quietly; explicit button click handles direct redirect flow.
        if (!dismissed && reason !== 'unknown_reason' && reason !== 'dismissed_by_user') {
          this.errorMessage.set(`Google One Tap is unavailable right now (${reason}).`);
          this.state.set('error');
          return;
        }

        this.state.set('idle');
      });
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : 'Google sign-in could not be started.';
      this.errorMessage.set(rawMessage);
      this.state.set('error');
      this.googleInProgress.set(false);
    }
  }

  private async getGoogleIdentityClient(): Promise<GoogleIdentityClient> {
    const clientId = environment.googleClientId?.trim();
    if (!clientId) {
      throw new Error('Missing Google client ID. Set environments.googleClientId first.');
    }

    await this.loadGoogleIdentityScript();
    const idClient = window.google?.accounts?.id;
    if (!idClient) {
      throw new Error('Google Identity Services is not available in this browser.');
    }

    idClient.initialize({
      client_id: clientId,
      use_fedcm_for_prompt: true,
      cancel_on_tap_outside: false,
      context: 'signin',
      callback: (response) => {
        void this.handleGoogleCredential(response);
      },
    });

    return idClient;
  }

  private async handleGoogleCredential(response: GoogleCredentialResponse): Promise<void> {
    try {
      await this.auth.signInWithGoogleIdToken(response.credential);
      await this.routeAfterGoogleSignIn();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      this.errorMessage.set(message);
      this.state.set('error');
    } finally {
      this.googleInProgress.set(false);
    }
  }

  private async routeAfterGoogleSignIn(): Promise<void> {
    const profile = await this.profileService.getProfile();
    if (!profile?.registration_complete) {
      await this.router.navigate(['/register']);
      return;
    }

    await this.router.navigate(['/dashboard']);
  }

  private async loadGoogleIdentityScript(): Promise<void> {
    const existingScript = document.getElementById(
      'google-identity-service-script',
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.google?.accounts?.id) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Failed to load GIS script.')),
          {
            once: true,
          },
        );
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'google-identity-service-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.head.appendChild(script);
    });
  }

  tryAgain(): void {
    this.state.set('idle');
    this.errorMessage.set('');
    this.form.reset();
  }
}
