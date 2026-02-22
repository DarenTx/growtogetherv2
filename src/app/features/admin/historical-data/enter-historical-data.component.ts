import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GrowthData } from '../../../core/models/growth-data.interface';
import { Profile } from '../../../core/models/profile.interface';
import { SupabaseService } from '../../../core/services/supabase.service';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const DEFAULT_BANK = 'Fidelity Investments';

@Component({
  selector: 'app-enter-historical-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './enter-historical-data.component.html',
  styleUrl: './enter-historical-data.component.css',
})
export class EnterHistoricalDataComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  readonly profiles = signal<Profile[]>([]);
  readonly growthData = signal<GrowthData[]>([]);
  readonly loadingProfiles = signal(false);
  readonly profileLoadError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  readonly selectedProfile = signal<Profile | null>(null);
  readonly showGrowthData = computed(() => this.selectedProfile() !== null);

  readonly bankOptions = ['Fidelity Investments', 'Edward Jones'] as const;

  readonly form = this.fb.nonNullable.group({
    profile_id: ['', Validators.required],
    year: [CURRENT_YEAR, [Validators.required, Validators.min(2001), Validators.max(2100)]],
    month: [CURRENT_MONTH, [Validators.required, Validators.min(1), Validators.max(12)]],
    bank_name: [DEFAULT_BANK, Validators.required],
    is_managed: [false],
    growth_pct: [
      null as number | null,
      [Validators.required, Validators.min(-999.99), Validators.max(999.99)],
    ],
  });

  async ngOnInit(): Promise<void> {
    this.loadingProfiles.set(true);
    this.profileLoadError.set(null);
    try {
      const list = await this.supabase.getAllProfiles();
      this.profiles.set(list);
    } catch (err: unknown) {
      this.profileLoadError.set(err instanceof Error ? err.message : 'Failed to load profiles.');
      this.form.disable();
    } finally {
      this.loadingProfiles.set(false);
    }
  }

  async onProfileChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const profileId = select.value;
    const profile = this.profiles().find((p) => p.id === profileId) ?? null;
    this.selectedProfile.set(profile);
    this.form.controls.profile_id.setValue(profileId);

    if (profile?.email) {
      const data = await this.supabase.getGrowthDataByEmailKey(profile.email);
      this.growthData.set(data);
    } else {
      this.growthData.set([]);
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

    const { profile_id, year, month, bank_name, is_managed, growth_pct } = this.form.getRawValue();
    const profile = this.profiles().find((p) => p.id === profile_id) ?? null;
    const email_key = profile?.email ?? '';

    try {
      await this.supabase.saveGrowthData({
        email_key,
        user_id: null,
        year,
        month,
        bank_name,
        is_managed,
        growth_pct: growth_pct!,
      });
      this.successMessage.set('Growth data saved.');

      // Advance month/year
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      this.form.patchValue({ growth_pct: null, month: nextMonth, year: nextYear });

      // Refresh growth data list for the selected profile
      if (email_key) {
        const data = await this.supabase.getGrowthDataByEmailKey(email_key);
        this.growthData.set(data);
      }
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  clearAll(): void {
    this.form.reset({
      profile_id: '',
      year: CURRENT_YEAR,
      month: CURRENT_MONTH,
      bank_name: DEFAULT_BANK,
      is_managed: false,
      growth_pct: null,
    });
    this.selectedProfile.set(null);
    this.growthData.set([]);
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }
}
