import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Profile } from '../../../core/models/profile.interface';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-enter-profiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './enter-profiles.component.html',
  styleUrl: './enter-profiles.component.scss',
})
export class EnterProfilesComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  readonly profiles = signal<Profile[]>([]);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  async ngOnInit(): Promise<void> {
    await this.loadProfiles();
  }

  private async loadProfiles(): Promise<void> {
    try {
      const list = await this.supabase.getAllProfiles();
      this.profiles.set(list);
    } catch {
      // non-fatal: list just remains empty
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    try {
      const { first_name, last_name, email } = this.form.getRawValue();
      await this.supabase.adminCreateProfile({ first_name, last_name, email });
      this.successMessage.set('Profile created successfully.');
      this.form.reset();
      await this.loadProfiles();
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
