import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';

interface MonthlyBankEntry {
  bank_name: string;
  growth_pct: number;
}

@Component({
  selector: 'app-monthly-growth-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './monthly-growth-entry.component.html',
  styleUrl: './monthly-growth-entry.component.css',
})
export class MonthlyGrowthEntryComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly growthDataService = inject(GrowthDataService);

  // Private state
  private session: Session | null = null;

  readonly year = input.required<number>();
  readonly month = input.required<number>();

  readonly displayLabel = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(this.year(), this.month() - 1, 1));
  });

  // Writable signals
  readonly isLoading = signal(false);
  readonly loadFailed = signal(false);
  readonly isSaving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  // Writable signal for dynamically-loaded bank names
  readonly bankOptions = signal<string[]>([]);
  readonly growthByBank = signal<Record<string, string>>({});

  readonly canSubmit = computed(() => {
    if (this.isSaving()) {
      return false;
    }

    const banks = this.bankOptions();
    if (banks.length === 0) {
      return false;
    }

    const values = this.growthByBank();
    return banks.every((bankName) => (values[bankName] ?? '').trim() !== '');
  });

  // Outputs
  readonly saved = output<void>();

  constructor() {
    effect(() => {
      this.year();
      this.month();
      void this.loadExistingRecord();
    });
  }

  async ngOnInit(): Promise<void> {
    // Load session
    this.session = await this.auth.getSession();
    if (!this.session) {
      this.errorMessage.set('Unable to load session. Please sign in again.');
      return;
    }

    // Fetch the user's historical bank names and populate one input per bank
    try {
      const names = await this.growthDataService.getOwnBankNames();
      this.bankOptions.set(names);

      const initialValues: Record<string, string> = {};
      for (const bankName of names) {
        initialValues[bankName] = '';
      }
      this.growthByBank.set(initialValues);
    } catch (err: unknown) {
      console.error('[MonthlyGrowthEntry] getOwnBankNames failed', err);
      this.errorMessage.set('Failed to load your bank list.');
      return;
    }

    // Initial load for all visible banks
    await this.loadExistingRecord();
  }

  async loadExistingRecord(): Promise<void> {
    if (!this.session) {
      return;
    }

    const banks = this.bankOptions();
    if (banks.length === 0) {
      return;
    }

    this.isLoading.set(true);
    this.loadFailed.set(false);

    try {
      const records = await Promise.all(
        banks.map((bankName) =>
          this.growthDataService.getOwnGrowthDataForMonth(this.year(), this.month(), bankName),
        ),
      );

      const nextValues: Record<string, string> = {};
      for (let idx = 0; idx < banks.length; idx++) {
        const bankName = banks[idx];
        const record = records[idx];
        nextValues[bankName] = record ? record.growth_pct.toFixed(2) : '';
      }
      this.growthByBank.set(nextValues);
    } catch (err: unknown) {
      console.error('[MonthlyGrowthEntry] loadExistingRecord failed', err);
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  onGrowthInput(bankName: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const nextValue = target.value;
    this.growthByBank.update((current) => ({
      ...current,
      [bankName]: nextValue,
    }));
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  async onSave(event?: Event): Promise<void> {
    event?.preventDefault();
    this.successMessage.set('');
    this.errorMessage.set('');

    const banks = this.bankOptions();
    if (banks.length === 0) {
      this.errorMessage.set('No banks available to submit for this month.');
      return;
    }

    const growthByBank = this.growthByBank();
    const missingBanks = banks.filter((bankName) => (growthByBank[bankName] ?? '').trim() === '');
    if (missingBanks.length > 0) {
      this.errorMessage.set('Enter growth data for all listed banks before saving.');
      return;
    }

    const entries: MonthlyBankEntry[] = [];
    for (const bankName of banks) {
      const rawValue = (growthByBank[bankName] ?? '').trim();
      const parsed = parseFloat(rawValue);
      if (Number.isNaN(parsed)) {
        this.errorMessage.set(`Please enter a valid number for ${bankName}.`);
        return;
      }

      entries.push({
        bank_name: bankName,
        growth_pct: parsed,
      });
    }

    this.isSaving.set(true);
    try {
      await this.growthDataService.saveOwnGrowthDataForMonth(this.year(), this.month(), entries);
      this.successMessage.set('Growth saved for all banks.');
      this.saved.emit();
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
