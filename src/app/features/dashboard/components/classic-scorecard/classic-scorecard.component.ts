import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { GrowthData } from '../../../../core/models/growth-data.interface';
import { MarketIndex } from '../../../../core/models/market-index.interface';
import { Profile } from '../../../../core/models/profile.interface';
import { AuthService } from '../../../../core/services/auth.service';
import { GrowthDataService } from '../../../../core/services/growth-data.service';
import { MarketDataService } from '../../../../core/services/market-data.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { TrendLabelComponent } from '../../../../shared/components/trend-label/trend-label.component';

export type ScorecardState = 'loading' | 'error' | 'no-data' | 'historical';

const fmt = (v: number): string => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

@Component({
  selector: 'app-classic-scorecard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendLabelComponent],
  templateUrl: './classic-scorecard.component.html',
  styleUrl: './classic-scorecard.component.css',
})
export class ClassicScorecardComponent implements OnInit {
  // ── Injected services ──────────────────────────────────────────────────────
  private readonly growthDataService = inject(GrowthDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  // ── Inputs ─────────────────────────────────────────────────────────────────
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly uuid = input.required<string>();
  /** Increment to force a data reload without resetting navigation. */
  readonly refreshTrigger = input(0);

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly yearChange = output<number>();

  // ── Writable signals ───────────────────────────────────────────────────────
  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly userMonthlyData = signal<GrowthData[]>([]);
  readonly allPlayersMonth = signal<GrowthData[]>([]);
  readonly marketIndexes = signal<MarketIndex[]>([]);
  readonly allProfiles = signal<Profile[]>([]);

  // ── Navigation offset ─────────────────────────────────────────────────────
  readonly offsetMonths = signal(0);

  // ── In-flight guard ────────────────────────────────────────────────────────
  private _loadInProgress = false;
  // True until the first successful data load; enables auto-navigation to last month with data.
  private _initialLoad = true;

  private matchesProfileGrowthRow(profile: Profile, row: GrowthData): boolean {
    if (row.user_id === profile.id) {
      return true;
    }

    const emailKey = row.email_key.toLowerCase();
    const personalEmail = profile.personal_email?.toLowerCase();
    if (personalEmail && emailKey === personalEmail) {
      return true;
    }

    const workEmail = profile.work_email?.toLowerCase();
    return !!workEmail && emailKey === workEmail;
  }

  // ── Display year/month (base inputs + navigation offset) ──────────────────
  readonly displayYear = computed((): number => {
    const total = this.year() * 12 + (this.month() - 1) + this.offsetMonths();
    return Math.floor(total / 12);
  });

  readonly displayMonth = computed((): number => {
    const total = this.year() * 12 + (this.month() - 1) + this.offsetMonths();
    return (total % 12) + 1;
  });

  readonly canGoNext = computed((): boolean => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const maxMonth = curMonth === 1 ? 12 : curMonth - 1;
    const maxYear = curMonth === 1 ? curYear - 1 : curYear;
    return (
      this.displayYear() < maxYear ||
      (this.displayYear() === maxYear && this.displayMonth() < maxMonth)
    );
  });

  // ── Derived signals ────────────────────────────────────────────────────────

  readonly userGrowthRecord = computed((): GrowthData | null => {
    const m = this.displayMonth();
    const rows = this.userMonthlyData().filter((r) => r.month === m);
    if (rows.length === 0) return null;
    return rows.sort((a, b) => a.bank_name.localeCompare(b.bank_name))[0];
  });

  readonly userGrowthPct = computed(
    (): number | null => this.userGrowthRecord()?.growth_pct ?? null,
  );

  readonly ytdDataString = computed((): string => {
    const targetMonth = this.displayMonth();
    const sorted = this.userMonthlyData()
      .filter((r) => r.month <= targetMonth)
      .sort((a, b) => a.month - b.month);

    // One value per month, first by bank_name ASC
    const byMonth = new Map<number, number>();
    for (const r of sorted) {
      if (!byMonth.has(r.month)) {
        byMonth.set(r.month, r.growth_pct);
      }
    }

    return Array.from(byMonth.values()).join(',');
  });

  readonly perUserMonthData = computed((): Map<string, number> => {
    const result = new Map<string, number>();
    const rows = [...this.allPlayersMonth()].sort((a, b) => a.bank_name.localeCompare(b.bank_name));
    const profiles = this.allProfiles();

    const personalEmailToProfileId = new Map<string, string>();
    const workEmailToProfileId = new Map<string, string>();
    for (const profile of profiles) {
      const personalEmail = profile.personal_email?.toLowerCase();
      if (personalEmail) {
        personalEmailToProfileId.set(personalEmail, profile.id);
      }

      const workEmail = profile.work_email?.toLowerCase();
      if (workEmail) {
        workEmailToProfileId.set(workEmail, profile.id);
      }
    }

    for (const r of rows) {
      const profileId = r.user_id
        ? r.user_id
        : (personalEmailToProfileId.get(r.email_key.toLowerCase()) ??
          workEmailToProfileId.get(r.email_key.toLowerCase()));
      if (!profileId) {
        continue;
      }

      if (!result.has(profileId)) {
        result.set(profileId, r.growth_pct);
      }
    }
    return result;
  });

  readonly playerAvg = computed((): number | null => {
    const map = this.perUserMonthData();
    if (map.size === 0) return null;
    const values = Array.from(map.values());
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  });

  readonly playerAvgDiff = computed((): number | null => {
    const pct = this.userGrowthPct();
    const avg = this.playerAvg();
    if (pct === null || avg === null) return null;
    return pct - avg;
  });

  readonly userRank = computed((): number | null => {
    const map = this.perUserMonthData();
    const profile = this.viewedUserProfile();
    if (!profile?.id) return null;
    const userId = profile.id;
    if (!map.has(userId)) return null;

    const userPct = map.get(userId)!;
    const sorted = Array.from(map.values()).sort((a, b) => b - a);
    return sorted.indexOf(userPct) + 1;
  });

  readonly totalPlayerCount = computed(() => this.perUserMonthData().size);

  readonly dowGrowthPct = computed((): number | null => {
    const idx = this.marketIndexes().find((m) => m.index_name.toLowerCase().startsWith('dow'));
    return idx?.growth_pct ?? null;
  });

  readonly sp500GrowthPct = computed((): number | null => {
    const idx = this.marketIndexes().find((m) => m.index_name.toLowerCase().startsWith('s&p'));
    return idx?.growth_pct ?? null;
  });

  readonly cardTitle = computed((): string => {
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(this.displayYear(), this.displayMonth() - 1, 1),
    );
    return `${this.displayYear()} YTD · ${monthName}`;
  });

  readonly navigationLabel = computed((): string => {
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(this.displayYear(), this.displayMonth() - 1, 1),
    );
    return `${monthName} ${this.displayYear()}`;
  });

  readonly viewedUserProfile = computed((): Profile | null => {
    return this.allProfiles().find((p) => p.id === this.uuid()) ?? null;
  });

  readonly state = computed((): ScorecardState => {
    if (this.isLoading()) return 'loading';
    if (this.loadError()) return 'error';
    if (this.allPlayersMonth().length === 0) return 'no-data';
    return 'historical';
  });

  readonly cardAriaLabel = computed((): string => {
    const profile = this.viewedUserProfile();
    if (!profile) return 'Scorecard';
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(this.displayYear(), this.displayMonth() - 1, 1),
    );
    return `Scorecard for ${profile.first_name} ${profile.last_name}, ${monthName} ${this.displayYear()}`;
  });

  readonly momDelta = computed((): number | null => {
    const values = this.ytdDataString()
      .split(',')
      .map(Number)
      .filter((v) => !isNaN(v));
    if (values.length < 2) return null;
    return values[values.length - 1] - values[values.length - 2];
  });

  readonly momTrend = computed((): 'up' | 'down' | 'flat' => {
    const d = this.momDelta();
    if (d === null || d === 0) return 'flat';
    return d > 0 ? 'up' : 'down';
  });

  readonly formattedMomDelta = computed((): string => {
    const d = this.momDelta();
    if (d === null) return '';
    return d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`;
  });

  // ── Formatting helpers ─────────────────────────────────────────────────────

  readonly formattedGrowthPct = computed((): string => {
    const v = this.userGrowthPct();
    if (v === null) return '—';
    return fmt(v);
  });

  readonly dowDiff = computed((): number | null => {
    const user = this.userGrowthPct();
    const dow = this.dowGrowthPct();
    if (user === null || dow === null) return null;
    return user - dow;
  });

  readonly sp500Diff = computed((): number | null => {
    const user = this.userGrowthPct();
    const sp = this.sp500GrowthPct();
    if (user === null || sp === null) return null;
    return user - sp;
  });

  readonly formattedDowPct = computed((): string => {
    const v = this.dowDiff();
    return v !== null ? fmt(v) : '';
  });

  readonly formattedSp500Pct = computed((): string => {
    const v = this.sp500Diff();
    return v !== null ? fmt(v) : '';
  });

  readonly formattedPlayerAvgDiff = computed((): string => {
    const v = this.playerAvgDiff();
    return v !== null ? fmt(v) : '';
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  goToPrevMonth(): void {
    const prevYear = this.displayYear();
    this.offsetMonths.update((v) => v - 1);
    if (this.displayYear() !== prevYear) {
      this.yearChange.emit(this.displayYear());
    }
  }

  goToNextMonth(): void {
    if (this.canGoNext()) {
      const prevYear = this.displayYear();
      this.offsetMonths.update((v) => v + 1);
      if (this.displayYear() !== prevYear) {
        this.yearChange.emit(this.displayYear());
      }
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      // Reset navigation offset when parent changes the base year/month
      effect(() => {
        this.year();
        this.month();
        untracked(() => {
          this.offsetMonths.set(0);
          this._initialLoad = true;
        });
      });

      effect(() => {
        const y = this.displayYear();
        const m = this.displayMonth();
        const id = this.uuid();
        this.refreshTrigger(); // subscribe so a bump forces a reload
        if (y && m && id) {
          this.loadData();
        }
      });
    });
  }

  async loadData(): Promise<void> {
    if (this._loadInProgress) return;
    this._loadInProgress = true;
    const loadedYear = this.displayYear();
    const loadedMonth = this.displayMonth();
    this.isLoading.set(true);
    this.loadError.set('');

    try {
      const session = await this.authService.getSession();
      if (!session) {
        this.loadError.set('Not authenticated');
        return;
      }

      // Fetch all year rows + profiles, then resolve the viewed user's rows via
      // user_id first and email-key fallback for null-user placeholder rows.
      const [allYearData, profiles] = await Promise.all([
        this.growthDataService.getGrowthDataForYear(loadedYear),
        this.profileService.getRegisteredProfiles(),
      ]);

      const viewedProfile = profiles.find((p) => p.id === this.uuid()) ?? null;
      const userYearData = viewedProfile
        ? allYearData.filter((row) => this.matchesProfileGrowthRow(viewedProfile, row))
        : [];
      const hasDataForMonth = userYearData.some((d) => d.month === loadedMonth);

      if (!hasDataForMonth && this._initialLoad) {
        // Find the most recent month with data in the same year (before the target month).
        const sameYearMonths = [...new Set(userYearData.map((d) => d.month))].filter(
          (m) => m < loadedMonth,
        );
        if (sameYearMonths.length > 0) {
          const targetMonth = Math.max(...sameYearMonths);
          const base = this.year() * 12 + (this.month() - 1);
          this.offsetMonths.set(loadedYear * 12 + (targetMonth - 1) - base);
          return; // finally + effect will trigger loadData for the new month
        }

        // No earlier data in the same year — try one year back.
        if (loadedYear > 2000) {
          const prevYearDataAll = await this.growthDataService.getGrowthDataForYear(loadedYear - 1);
          const prevYearData = viewedProfile
            ? prevYearDataAll.filter((row) => this.matchesProfileGrowthRow(viewedProfile, row))
            : [];
          const prevYearMonths = [...new Set(prevYearData.map((d) => d.month))];
          if (prevYearMonths.length > 0) {
            const targetMonth = Math.max(...prevYearMonths);
            const base = this.year() * 12 + (this.month() - 1);
            this.offsetMonths.set((loadedYear - 1) * 12 + (targetMonth - 1) - base);
            return; // finally + effect will trigger loadData for the new month
          }
        }
        // No data found anywhere — fall through and display the empty state.
      }

      this._initialLoad = false;

      const [allMonthData, marketData] = await Promise.all([
        this.growthDataService.getGrowthDataForYearMonth(loadedYear, loadedMonth),
        this.marketDataService.getMarketIndexesForMonth(loadedYear, loadedMonth),
      ]);

      this.userMonthlyData.set(userYearData);
      this.allPlayersMonth.set(allMonthData);
      this.marketIndexes.set(marketData);
      this.allProfiles.set(profiles);
    } catch (err: unknown) {
      this.loadError.set(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      this._loadInProgress = false;
      this.isLoading.set(false);
      // If the user navigated while loading was in progress, trigger a fresh load.
      if (this.displayYear() !== loadedYear || this.displayMonth() !== loadedMonth) {
        this.loadData();
      }
    }
  }
}
