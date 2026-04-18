import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TrendLabelComponent } from '../../../../shared/components/trend-label/trend-label.component';
import { DashboardRow } from '../../dashboard-row.interface';

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type SortColumn = 'name' | `month-${number}`;
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-growth-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendLabelComponent],
  templateUrl: './growth-grid.component.html',
  styleUrl: './growth-grid.component.css',
})
export class GrowthGridComponent {
  readonly rows = input.required<DashboardRow[]>();
  readonly selectedYear = input.required<number>();
  readonly dowMonths = input<(number | null)[]>([]);
  readonly sp500Months = input<(number | null)[]>([]);

  readonly months = MONTHS;

  readonly sortColumn = signal<SortColumn>('name');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly monthAverages = computed<(number | null)[]>(() => {
    const rows = this.rows();
    return this.months.map((_, i) => {
      const vals = rows.map((r) => r.months[i]).filter((v): v is number => v !== null);
      if (vals.length === 0) return null;
      return vals.reduce((sum, v) => sum + v, 0) / vals.length;
    });
  });

  readonly monthBest = computed<(number | null)[]>(() => {
    const rows = this.rows();
    return this.months.map((_, i) => {
      const vals = rows.map((r) => r.months[i]).filter((v): v is number => v !== null);
      if (vals.length === 0) return null;
      return Math.max(...vals);
    });
  });

  isBest(val: number | null, monthIndex: number): boolean {
    if (val === null) return false;
    return val === this.monthBest()[monthIndex];
  }

  isAboveAvg(val: number | null, monthIndex: number): boolean {
    if (val === null) return false;
    const avg = this.monthAverages()[monthIndex];
    if (avg === null) return false;
    return val > avg && val !== this.monthBest()[monthIndex];
  }

  readonly sortedRows = computed<DashboardRow[]>(() => {
    const rows = [...this.rows()];
    const col = this.sortColumn();
    const dir = this.sortDirection();

    rows.sort((a, b) => {
      let cmp = 0;
      if (col === 'name') {
        const la = a.lastName.toLowerCase();
        const lb = b.lastName.toLowerCase();
        cmp = la < lb ? -1 : la > lb ? 1 : 0;
        if (cmp === 0) {
          const fa = a.firstName.toLowerCase();
          const fb = b.firstName.toLowerCase();
          cmp = fa < fb ? -1 : fa > fb ? 1 : 0;
        }
      } else {
        const idx = parseInt(col.replace('month-', ''), 10);
        const va = a.months[idx];
        const vb = b.months[idx];
        if (va === null && vb === null) cmp = 0;
        else if (va === null)
          cmp = 1; // nulls last
        else if (vb === null) cmp = -1;
        else cmp = va - vb;
      }
      return dir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  sortBy(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  monthSortId(index: number): SortColumn {
    return `month-${index}` as SortColumn;
  }

  sortIndicator(col: SortColumn): string {
    if (this.sortColumn() !== col) return '';
    return this.sortDirection() === 'asc' ? ' ▲' : ' ▼';
  }

  trendData(months: (number | null)[]): string {
    return months.filter((v): v is number => v !== null).join(',');
  }

  formatPct(value: number | null): string {
    if (value === null) return '';
    return `${value.toFixed(2)}%`;
  }
}
