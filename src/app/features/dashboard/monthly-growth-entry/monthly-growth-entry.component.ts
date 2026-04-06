import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Session } from '@supabase/supabase-js';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-monthly-growth-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './monthly-growth-entry.component.html',
  styleUrl: './monthly-growth-entry.component.css',
})
export class MonthlyGrowthEntryComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly growthDataService = inject(GrowthDataService);
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  // Private state
  private session: Session | null = null;

  // Readonly computed values (set once on init)
  prevMonth!: number;
  prevYear!: number;
  displayLabel!: string;

  // Writable signals
  readonly isLoading = signal(false);
  readonly loadFailed = signal(false);
  readonly isSaving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  // Writable signal for dynamically-loaded bank names
  readonly bankOptions = signal<string[]>([]);

  // Outputs
  readonly saved = output<void>();

  // Form controls
  readonly bankControl = new FormControl<string>('', { nonNullable: true });
  readonly growthPctControl = new FormControl<string>('', { nonNullable: true });

  async ngOnInit(): Promise<void> {
    // Compute previous month / year
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    this.prevMonth = prevDate.getMonth() + 1;
    this.prevYear = prevDate.getFullYear();
    this.displayLabel = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(prevDate);

    // Load session
    this.session = await this.auth.getSession();
    if (!this.session) {
      this.errorMessage.set('Unable to load session. Please sign in again.');
      return;
    }

    // Fetch the user's historical bank names and populate the selector
    try {
      const names = await this.growthDataService.getOwnBankNames();
      this.bankOptions.set(names);
      if (names.length > 0) {
        // Set without emitting so the subscription below doesn't fire prematurely
        this.bankControl.setValue(names[0], { emitEvent: false });
      }
    } catch (err: unknown) {
      console.error('[MonthlyGrowthEntry] getOwnBankNames failed', err);
    }

    // Clear banners when growth % is edited
    this.growthPctControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.successMessage.set('');
      this.errorMessage.set('');
    });

    // Re-fetch when bank changes
    this.bankControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadExistingRecord();
    });

    // Initial load for the selected bank
    await this.loadExistingRecord();
  }

  async loadExistingRecord(): Promise<void> {
    this.growthPctControl.setValue('');
    this.isLoading.set(true);
    this.loadFailed.set(false);
    try {
      const record = await this.growthDataService.getOwnGrowthDataForMonth(
        this.prevYear,
        this.prevMonth,
        this.bankControl.value,
      );
      if (record) {
        this.growthPctControl.setValue(record.growth_pct.toFixed(2));
      }
    } catch (err: unknown) {
      console.error('[MonthlyGrowthEntry] loadExistingRecord failed', err);
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSave(event?: Event): Promise<void> {
    event?.preventDefault();
    const rawValue = this.growthPctControl.value.trim();
    this.successMessage.set('');
    this.errorMessage.set('');

    if (rawValue !== '') {
      const parsed = parseFloat(rawValue);
      if (isNaN(parsed)) {
        this.errorMessage.set('Please enter a valid number.');
        return;
      }
    }

    const userEmail =
      (await this.profileService.getProfile())?.work_email ?? this.session?.user.email;
    if (!userEmail) {
      this.errorMessage.set('Growth data requires a work email address on your profile.');
      return;
    }

    this.isSaving.set(true);
    try {
      if (rawValue === '') {
        await this.growthDataService.deleteOwnGrowthDataForMonth(
          this.prevYear,
          this.prevMonth,
          this.bankControl.value,
        );
        this.successMessage.set('Growth cleared.');
        this.saved.emit();
      } else {
        await this.growthDataService.saveGrowthData({
          email_key: userEmail.toLowerCase(),
          user_id: this.session!.user.id,
          year: this.prevYear,
          month: this.prevMonth,
          bank_name: this.bankControl.value,
          growth_pct: parseFloat(rawValue),
        });
        this.successMessage.set('Growth saved.');
        this.saved.emit();
      }
    } catch (err: unknown) {
      console.error('[MonthlyGrowthEntry] onSave failed', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'An unexpected error occurred.';
      this.errorMessage.set(message);
    } finally {
      this.isSaving.set(false);
    }
  }
}
