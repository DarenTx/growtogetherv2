import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Profile } from '../../../core/models/profile.interface';
import { isValidPhone, normalizeEmail, normalizeToE164 } from '../../../core/utils/phone.utils';
import { SupabaseService } from '../../../core/services/supabase.service';

type RegistrationState = 'loading' | 'ready' | 'submitting' | 'error';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.scss',
})
export class RegistrationComponent implements OnInit {
  readonly state = signal<RegistrationState>('loading');
  readonly errorMessage = signal<string>('');
  readonly phoneError = signal<string>('');

  readonly form = new FormGroup({
    first_name: new FormControl('', [Validators.required]),
    last_name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required]),
    invitation_code: new FormControl('', [Validators.required]),
  });

  private existingProfile: Profile | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  get firstNameControl(): FormControl {
    return this.form.get('first_name') as FormControl;
  }
  get lastNameControl(): FormControl {
    return this.form.get('last_name') as FormControl;
  }
  get emailControl(): FormControl {
    return this.form.get('email') as FormControl;
  }
  get phoneControl(): FormControl {
    return this.form.get('phone') as FormControl;
  }
  get invitationCodeControl(): FormControl {
    return this.form.get('invitation_code') as FormControl;
  }

  async ngOnInit(): Promise<void> {
    try {
      const session = await this.supabase.getSession();
      if (!session) {
        await this.router.navigate(['/login']);
        return;
      }

      this.existingProfile = await this.supabase.getProfile();
      this.preFillForm(session.user);
      this.state.set('ready');
    } catch {
      this.errorMessage.set('Unable to load your profile. Please try again.');
      this.state.set('error');
    }
  }

  private preFillForm(user: { email?: string; phone?: string }): void {
    if (this.existingProfile) {
      this.form.patchValue({
        first_name: this.existingProfile.first_name ?? '',
        last_name: this.existingProfile.last_name ?? '',
        email: this.existingProfile.email ?? user.email ?? '',
        phone: this.existingProfile.phone ?? user.phone ?? '',
      });
    } else {
      // New user: pre-fill only the identifier used to authenticate
      this.form.patchValue({
        email: user.email ?? '',
        phone: user.phone ?? '',
      });
    }
  }

  onPhoneBlur(): void {
    const value = this.phoneControl.value as string;
    if (!value?.trim()) {
      this.phoneError.set('');
      return;
    }
    if (!isValidPhone(value)) {
      this.phoneError.set('Invalid phone number. Please enter a valid phone number.');
    } else {
      this.phoneError.set('');
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const rawPhone = this.phoneControl.value as string;
    const e164Phone = normalizeToE164(rawPhone);
    if (!e164Phone) {
      this.phoneError.set('Invalid phone number. Please enter a valid phone number.');
      return;
    }

    this.state.set('submitting');
    this.errorMessage.set('');

    try {
      await this.supabase.completeRegistration({
        first_name: (this.firstNameControl.value as string).trim(),
        last_name: (this.lastNameControl.value as string).trim(),
        email: normalizeEmail(this.emailControl.value as string),
        phone: e164Phone,
        invitation_code: (this.invitationCodeControl.value as string).trim(),
      });

      await this.router.navigate(['/dashboard']);
    } catch (err: unknown) {
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      if (raw.toLowerCase().includes('invitation code')) {
        this.errorMessage.set('Invalid invitation code. Please contact the administrator.');
      } else {
        this.errorMessage.set(raw || 'Registration failed. Please try again.');
      }
      this.state.set('error');
    }
  }
}
