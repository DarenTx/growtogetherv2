import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Profile } from '../../../core/models/profile.interface';
import { normalizeEmail } from '../../../core/utils/email.utils';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

type RegistrationState = 'loading' | 'ready' | 'submitting' | 'error';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.css',
})
export class RegistrationComponent implements OnInit {
  readonly state = signal<RegistrationState>('loading');
  readonly errorMessage = signal<string>('');

  readonly form = new FormGroup({
    first_name: new FormControl('', [Validators.required]),
    last_name: new FormControl('', [Validators.required]),
    work_email: new FormControl('', [Validators.required, Validators.email]),
    personal_email: new FormControl('', [Validators.required, Validators.email]),
    invitation_code: new FormControl('', [Validators.required]),
  });

  private existingProfile: Profile | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
  ) {}

  get firstNameControl(): FormControl {
    return this.form.get('first_name') as FormControl;
  }
  get lastNameControl(): FormControl {
    return this.form.get('last_name') as FormControl;
  }
  get workEmailControl(): FormControl {
    return this.form.get('work_email') as FormControl;
  }
  get personalEmailControl(): FormControl {
    return this.form.get('personal_email') as FormControl;
  }
  get invitationCodeControl(): FormControl {
    return this.form.get('invitation_code') as FormControl;
  }

  async ngOnInit(): Promise<void> {
    try {
      const session = await this.auth.getSession();
      if (!session) {
        await this.router.navigate(['/login']);
        return;
      }

      this.existingProfile = await this.profileService.getProfile();
      this.preFillForm(session.user);
      this.state.set('ready');
    } catch {
      this.errorMessage.set('Unable to load your profile. Please try again.');
      this.state.set('error');
    }
  }

  private preFillForm(user: { email?: string }): void {
    if (this.existingProfile) {
      this.form.patchValue({
        first_name: this.existingProfile.first_name ?? '',
        last_name: this.existingProfile.last_name ?? '',
        work_email: this.existingProfile.work_email ?? user.email ?? '',
        personal_email: this.existingProfile.personal_email ?? '',
      });
    } else {
      // New user: pre-fill the work email from the authenticated account.
      this.form.patchValue({
        work_email: user.email ?? '',
      });
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.state.set('submitting');
    this.errorMessage.set('');

    try {
      await this.profileService.completeRegistration({
        first_name: (this.firstNameControl.value as string).trim(),
        last_name: (this.lastNameControl.value as string).trim(),
        work_email: normalizeEmail(this.workEmailControl.value as string),
        personal_email: normalizeEmail(this.personalEmailControl.value as string),
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
