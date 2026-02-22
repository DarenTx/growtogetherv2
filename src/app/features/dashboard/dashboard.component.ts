import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GrowthData } from '../../core/models/growth-data.interface';
import { Profile } from '../../core/models/profile.interface';
import { SupabaseService } from '../../core/services/supabase.service';

const CURRENT_YEAR = new Date().getFullYear();

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

export interface DashboardRow {
  profileId: string;
  firstName: string;
  lastName: string;
  /** 12 elements, index 0 = Jan … index 11 = Dec. Null means no data. */
  months: (number | null)[];
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly currentYear = CURRENT_YEAR;
  readonly months = MONTHS;

  readonly profile = signal<Profile | null>(null);
  readonly isAdmin = computed(() => this.profile()?.is_admin ?? false);

  private readonly allProfiles = signal<Profile[]>([]);
  private readonly growthData = signal<GrowthData[]>([]);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly sortColumn = signal<SortColumn>('name');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly rows = computed<DashboardRow[]>(() => {
    const profiles = this.allProfiles();
    const growthData = this.growthData();
    const col = this.sortColumn();
    const dir = this.sortDirection();

    // Build lookup: lowercased email_key → month index (0-based) → first growth_pct seen
    const lookup = new Map<string, Map<number, number>>();
    for (const gd of growthData) {
      const key = gd.email_key.toLowerCase();
      if (!lookup.has(key)) lookup.set(key, new Map<number, number>());
      const monthMap = lookup.get(key)!;
      const idx = gd.month - 1; // convert 1-based month to 0-based index
      if (!monthMap.has(idx)) monthMap.set(idx, gd.growth_pct);
    }

    const rows: DashboardRow[] = profiles.map((p) => ({
      profileId: p.id,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      months: Array.from({ length: 12 }, (_, i) => {
        const key = (p.email ?? '').toLowerCase();
        return lookup.get(key)?.get(i) ?? null;
      }),
    }));

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

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [ownProfile, profiles, growthData] = await Promise.all([
        this.supabase.getProfile(),
        this.supabase.getAllProfiles(),
        this.supabase.getGrowthDataForYear(CURRENT_YEAR),
      ]);
      this.profile.set(ownProfile);
      this.allProfiles.set(profiles);
      this.growthData.set(growthData);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      this.loading.set(false);
    }
  }

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

  formatPct(value: number | null): string {
    if (value === null) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/login']);
  }
}
