import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SelectYearComponent } from '../select-year/select-year.component';
import { TrendLabelComponent } from '../../../../shared/components/trend-label/trend-label.component';
import { DashboardRow } from '../../dashboard.component';

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
  imports: [SelectYearComponent, TrendLabelComponent],
  templateUrl: './growth-grid.component.html',
  styleUrl: './growth-grid.component.css',
})
export class GrowthGridComponent {
  readonly rows = input.required<DashboardRow[]>();
  readonly selectedYear = input.required<number>();

  readonly yearChange = output<number>();

  readonly months = MONTHS;

  readonly sortColumn = signal<SortColumn>('name');
  readonly sortDirection = signal<SortDirection>('asc');

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
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  onYearChange(year: number): void {
    this.yearChange.emit(year);
  }
}
