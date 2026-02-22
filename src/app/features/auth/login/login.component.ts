import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  isEmail,
  isValidPhone,
  normalizeEmail,
  normalizeToE164,
} from '../../../core/utils/phone.utils';

type LoginState = 'idle' | 'loading' | 'sent' | 'error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly state = signal<LoginState>('idle');
  readonly errorMessage = signal<string>('');
  readonly sentTo = signal<string>('');
  readonly phoneError = signal<string>('');

  readonly form = new FormGroup({
    identifier: new FormControl('', [Validators.required]),
  });

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

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
    this.state.set('loading');
    this.errorMessage.set('');

    try {
      if (isEmail(rawValue)) {
        const email = normalizeEmail(rawValue);
        await this.supabase.signInWithEmail(email);
        this.sentTo.set(email);
        this.state.set('sent');
      } else {
        const e164 = normalizeToE164(rawValue);
        if (!e164) {
          this.phoneError.set('Invalid phone number. Please enter a valid phone number.');
          this.state.set('idle');
          return;
        }
        await this.supabase.signInWithPhone(e164);
        this.sentTo.set(e164);
        this.state.set('sent');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      this.errorMessage.set(message);
      this.state.set('error');
    }
  }

  tryAgain(): void {
    this.state.set('idle');
    this.errorMessage.set('');
    this.form.reset();
  }
}
