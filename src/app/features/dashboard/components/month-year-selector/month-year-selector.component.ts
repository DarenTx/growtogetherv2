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
import { GrowthDataService } from '../../../../core/services/growth-data.service';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

@Component({
  selector: 'app-month-year-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-year-selector.component.html',
  styleUrl: './month-year-selector.component.css',
})
export class MonthYearSelectorComponent {
  private readonly growthDataService = inject(GrowthDataService);

  readonly userId = input<string | undefined>();
  readonly selectedYear = input<number>(CURRENT_YEAR);
  readonly selectedMonth = input<number>(CURRENT_MONTH);
  readonly showMonth = input(true);

  readonly yearChange = output<number>();
  readonly monthChange = output<number>();

  readonly years = signal<number[]>([CURRENT_YEAR]);
  readonly currentYear = signal<number>(CURRENT_YEAR);
  readonly currentMonth = signal<number>(CURRENT_MONTH);

  readonly minYear = computed(() => Math.min(...this.years()));
  readonly maxYear = computed(() => Math.max(...this.years()));

  readonly displayLabel = computed(() => {
    if (!this.showMonth()) {
      return `${this.currentYear()}`;
    }

    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(this.currentYear(), this.currentMonth() - 1, 1),
    );
    return `${monthName} ${this.currentYear()}`;
  });

  readonly canGoPrevious = computed(() => {
    if (!this.showMonth()) {
      return this.currentYear() > this.minYear();
    }

    const minIndex = this.minYear() * 12;
    const currentIndex = this.currentYear() * 12 + (this.currentMonth() - 1);
    return currentIndex > minIndex;
  });

  readonly canGoNext = computed(() => {
    if (!this.showMonth()) {
      return this.currentYear() < this.maxYear();
    }

    const maxIndex = this.maxYear() * 12 + 11;
    const currentIndex = this.currentYear() * 12 + (this.currentMonth() - 1);
    return currentIndex < maxIndex;
  });

  constructor() {
    effect(() => {
      this.currentYear.set(this.selectedYear());
    });

    effect(() => {
      this.currentMonth.set(this.selectedMonth());
    });

    effect(() => {
      const uid = this.userId();
      void this.loadYears(uid);
    });
  }

  goPrevious(): void {
    if (!this.canGoPrevious()) {
      return;
    }

    if (!this.showMonth()) {
      const nextYear = this.currentYear() - 1;
      this.currentYear.set(nextYear);
      this.yearChange.emit(nextYear);
      return;
    }

    const total = this.currentYear() * 12 + (this.currentMonth() - 1) - 1;
    const nextYear = Math.floor(total / 12);
    const nextMonth = (total % 12) + 1;

    const didYearChange = nextYear !== this.currentYear();
    this.currentYear.set(nextYear);
    this.currentMonth.set(nextMonth);
    if (didYearChange) {
      this.yearChange.emit(nextYear);
    }
    this.monthChange.emit(nextMonth);
  }

  goNext(): void {
    if (!this.canGoNext()) {
      return;
    }

    if (!this.showMonth()) {
      const nextYear = this.currentYear() + 1;
      this.currentYear.set(nextYear);
      this.yearChange.emit(nextYear);
      return;
    }

    const total = this.currentYear() * 12 + (this.currentMonth() - 1) + 1;
    const nextYear = Math.floor(total / 12);
    const nextMonth = (total % 12) + 1;

    const didYearChange = nextYear !== this.currentYear();
    this.currentYear.set(nextYear);
    this.currentMonth.set(nextMonth);
    if (didYearChange) {
      this.yearChange.emit(nextYear);
    }
    this.monthChange.emit(nextMonth);
  }

  private async loadYears(userId: string | undefined): Promise<void> {
    try {
      const years = userId
        ? await this.growthDataService.getAvailableYearsForUser(userId)
        : await this.growthDataService.getAvailableYears();
      this.years.set(years.length > 0 ? years : [CURRENT_YEAR]);
    } catch {
      this.years.set([CURRENT_YEAR]);
    }
  }
}
