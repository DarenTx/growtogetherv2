import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/services/supabase.service';

const BANK_OPTIONS = ['Fidelity Investments', 'Edward Jones'] as const;

@Component({
  selector: 'app-monthly-growth-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './monthly-growth-entry.component.html',
  styleUrl: './monthly-growth-entry.component.css',
})
export class MonthlyGrowthEntryComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
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

  // Form controls
  readonly bankControl = new FormControl<string>('Fidelity Investments', { nonNullable: true });
  readonly isManagedControl = new FormControl<boolean>(false, { nonNullable: true });
  readonly growthPctControl = new FormControl<string>('', { nonNullable: true });

  // Constants exposed to template
  readonly bankOptions = BANK_OPTIONS;

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
    this.session = await this.supabase.getSession();
    if (!this.session) {
      this.errorMessage.set('Unable to load session. Please sign in again.');
      return;
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

    // Initial load for default bank
    await this.loadExistingRecord();
  }

  async loadExistingRecord(): Promise<void> {
    this.growthPctControl.setValue('');
    this.isLoading.set(true);
    this.loadFailed.set(false);
    try {
      const record = await this.supabase.getOwnGrowthDataForMonth(
        this.prevYear,
        this.prevMonth,
        this.bankControl.value,
      );
      if (record) {
        this.growthPctControl.setValue(record.growth_pct.toFixed(2));
      }
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSave(): Promise<void> {
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

    this.isSaving.set(true);
    try {
      if (rawValue === '') {
        await this.supabase.deleteOwnGrowthDataForMonth(
          this.prevYear,
          this.prevMonth,
          this.bankControl.value,
        );
        this.successMessage.set('Growth cleared.');
      } else {
        await this.supabase.saveGrowthData({
          email_key: this.session!.user.email!.toLowerCase(),
          user_id: this.session!.user.id,
          year: this.prevYear,
          month: this.prevMonth,
          bank_name: this.bankControl.value,
          is_managed: this.isManagedControl.value,
          growth_pct: parseFloat(rawValue),
        });
        this.successMessage.set('Growth saved.');
      }
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
