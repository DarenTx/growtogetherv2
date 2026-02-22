import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketIndex } from '../../../core/models/market-index.interface';
import { SupabaseService } from '../../../core/services/supabase.service';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

@Component({
  selector: 'app-enter-market-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './enter-market-data.component.html',
  styleUrl: './enter-market-data.component.css',
})
export class EnterMarketDataComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  readonly indexes = signal<MarketIndex[]>([]);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  readonly indexOptions = ['S&P 500', 'Dow Jones'] as const;

  readonly form = this.fb.nonNullable.group({
    index_name: ['S&P 500', Validators.required],
    year: [CURRENT_YEAR, [Validators.required, Validators.min(2001), Validators.max(2100)]],
    month: [CURRENT_MONTH, [Validators.required, Validators.min(1), Validators.max(12)]],
    growth_pct: [
      null as number | null,
      [Validators.required, Validators.min(-999.99), Validators.max(999.99)],
    ],
  });

  async ngOnInit(): Promise<void> {
    await this.loadIndexes();
  }

  private async loadIndexes(): Promise<void> {
    try {
      const data = await this.supabase.getMarketIndexes();
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      this.indexes.set(sorted);
    } catch {
      // non-fatal
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

    const { index_name, year, month, growth_pct } = this.form.getRawValue();

    try {
      await this.supabase.saveMarketIndex({ index_name, year, month, growth_pct: growth_pct! });
      this.successMessage.set('Market index saved.');

      // Advance month/year
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      this.form.patchValue({ growth_pct: null, month: nextMonth, year: nextYear });

      await this.loadIndexes();
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  clearAll(): void {
    this.form.reset({
      index_name: 'S&P 500',
      year: CURRENT_YEAR,
      month: CURRENT_MONTH,
      growth_pct: null,
    });
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }
}
