import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { GrowthDataService } from '../../../core/services/growth-data.service';

const CURRENT_YEAR = new Date().getFullYear();

@Component({
  selector: 'app-select-year',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-year.component.html',
  styleUrl: './select-year.component.css',
})
export class SelectYearComponent {
  private readonly growthDataService = inject(GrowthDataService);

  /** Optional user ID – when set, only years with data for this user are shown. */
  readonly userId = input<string | undefined>();

  /** Optional pre-selected year. Defaults to the current year. */
  readonly selectedYear = input<number>(CURRENT_YEAR);

  /** Emits whenever the user picks a different year. */
  readonly yearChange = output<number>();

  readonly years = signal<number[]>([]);
  readonly currentValue = signal<number>(CURRENT_YEAR);

  readonly displayValue = computed(() => this.currentValue());

  constructor() {
    // Sync the local value whenever the parent changes selectedYear
    effect(() => {
      this.currentValue.set(this.selectedYear());
    });

    // Re-fetch available years when userId changes
    effect(() => {
      const uid = this.userId();
      void this.loadYears(uid);
    });
  }

  private async loadYears(userId: string | undefined): Promise<void> {
    try {
      const years = userId
        ? await this.growthDataService.getAvailableYearsForUser(userId)
        : await this.growthDataService.getAvailableYears();
      this.years.set(years);
    } catch {
      this.years.set([CURRENT_YEAR]);
    }
  }

  onYearChange(event: Event): void {
    const value = +(event.target as HTMLSelectElement).value;
    this.currentValue.set(value);
    this.yearChange.emit(value);
  }
}
