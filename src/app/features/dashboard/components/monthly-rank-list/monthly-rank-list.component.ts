import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TrendLabelComponent } from '../../../../shared/components/trend-label/trend-label.component';

export interface MonthlyRankRow {
  rank: number;
  playerName: string;
  bankName: string;
  trendData: string;
  growthPct: number;
}

@Component({
  selector: 'app-monthly-rank-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendLabelComponent],
  templateUrl: './monthly-rank-list.component.html',
  styleUrl: './monthly-rank-list.component.css',
})
export class MonthlyRankListComponent {
  readonly selectedYear = input.required<number>();
  readonly selectedMonth = input.required<number>();
  readonly rows = input<MonthlyRankRow[]>([]);
  readonly playerAveragePct = input<number | null>(null);
  readonly dowGrowthPct = input<number | null>(null);
  readonly sp500GrowthPct = input<number | null>(null);

  readonly heading = computed(() => {
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(this.selectedYear(), this.selectedMonth() - 1, 1),
    );
    return `${monthName} ${this.selectedYear()} Rankings`;
  });

  formatPct(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
}
