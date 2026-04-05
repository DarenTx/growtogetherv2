import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GrowthData } from '../../../core/models/growth-data.interface';
import { MarketIndex } from '../../../core/models/market-index.interface';
import { Profile } from '../../../core/models/profile.interface';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';
import { MarketDataService } from '../../../core/services/market-data.service';
import { ProfileService } from '../../../core/services/profile.service';
import { TrendLabelComponent } from '../trend-label/trend-label.component';

export type ScorecardState = 'loading' | 'error' | 'historical' | 'current-entry' | 'current-data';

const fmt = (v: number): string => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

@Component({
  selector: 'app-classic-scorecard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendLabelComponent, ReactiveFormsModule],
  templateUrl: './classic-scorecard.component.html',
  styleUrl: './classic-scorecard.component.css',
})
export class ClassicScorecardComponent implements OnInit {
  // ── Injected services ──────────────────────────────────────────────────────
  private readonly growthDataService = inject(GrowthDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ── Inputs ─────────────────────────────────────────────────────────────────
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly uuid = input.required<string>();

  // ── Form controls ──────────────────────────────────────────────────────────
  readonly bankControl = new FormControl<string>('Fidelity Investments', { nonNullable: true });
  readonly growthPctControl = new FormControl<string>('', { nonNullable: true });
  readonly bankOptions = ['Fidelity Investments', 'Edward Jones'] as const;
  readonly cutoffDateLabel = 'Final Data Available on the 21st';

  // ── Writable signals ───────────────────────────────────────────────────────
  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly isSaving = signal(false);
  readonly saveSuccess = signal('');
  readonly saveError = signal('');
  readonly userMonthlyData = signal<GrowthData[]>([]);
  readonly allPlayersMonth = signal<GrowthData[]>([]);
  readonly marketIndexes = signal<MarketIndex[]>([]);
  readonly allProfiles = signal<Profile[]>([]);
  readonly currentUserId = signal<string | null>(null);

  // ── In-flight guard ────────────────────────────────────────────────────────
  private _loadInProgress = false;

  // ── Derived signals ────────────────────────────────────────────────────────

  readonly isPastCutoff = computed((): boolean => {
    const t = new Date();
    return !(
      t.getFullYear() === this.year() &&
      t.getMonth() + 1 === this.month() &&
      t.getDate() < 21
    );
  });

  readonly isViewingOwnCard = computed(() => this.currentUserId() === this.uuid());

  readonly userGrowthRecord = computed((): GrowthData | null => {
    const m = this.month();
    const rows = this.userMonthlyData().filter((r) => r.month === m);
    if (rows.length === 0) return null;
    return rows.sort((a, b) => a.bank_name.localeCompare(b.bank_name))[0];
  });

  readonly userGrowthPct = computed(
    (): number | null => this.userGrowthRecord()?.growth_pct ?? null,
  );

  readonly ytdDataString = computed((): string => {
    const targetMonth = this.month();
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
    const rows = [...this.allPlayersMonth()]
      .filter((r) => r.user_id !== null)
      .sort((a, b) => a.bank_name.localeCompare(b.bank_name));

    for (const r of rows) {
      if (!result.has(r.user_id!)) {
        result.set(r.user_id!, r.growth_pct);
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
    const uuid = this.uuid();
    if (!map.has(uuid)) return null;

    const userPct = map.get(uuid)!;
    const sorted = Array.from(map.values()).sort((a, b) => b - a);
    return sorted.indexOf(userPct) + 1;
  });

  readonly totalPlayerCount = computed(() => this.allProfiles().length);

  readonly playersWithData = computed(() => this.perUserMonthData().size);

  readonly waitingCount = computed(() =>
    Math.max(0, this.totalPlayerCount() - this.playersWithData()),
  );

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
      new Date(this.year(), this.month() - 1, 1),
    );
    return `${this.year()} - Thru ${monthName}`;
  });

  readonly viewedUserProfile = computed((): Profile | null => {
    return this.allProfiles().find((p) => p.id === this.uuid()) ?? null;
  });

  readonly state = computed((): ScorecardState => {
    if (this.isLoading()) return 'loading';
    if (this.loadError()) return 'error';
    if (this.isPastCutoff()) return 'historical';
    if (this.isViewingOwnCard() && this.userGrowthPct() === null) return 'current-entry';
    return 'current-data';
  });

  readonly cardAriaLabel = computed((): string => {
    const profile = this.viewedUserProfile();
    if (!profile) return 'Scorecard';
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(this.year(), this.month() - 1, 1),
    );
    return `Scorecard for ${profile.first_name} ${profile.last_name}, ${monthName} ${this.year()}`;
  });

  // ── Formatting helpers ─────────────────────────────────────────────────────

  readonly formattedGrowthPct = computed((): string => {
    const v = this.userGrowthPct();
    if (v === null) return '—';
    return fmt(v) + ' %';
  });

  readonly formattedDowPct = computed((): string => {
    const v = this.dowGrowthPct();
    return v !== null ? fmt(v) : '';
  });

  readonly formattedSp500Pct = computed((): string => {
    const v = this.sp500GrowthPct();
    return v !== null ? fmt(v) : '';
  });

  readonly formattedPlayerAvgDiff = computed((): string => {
    const v = this.playerAvgDiff();
    return v !== null ? fmt(v) : '';
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const y = this.year();
        const m = this.month();
        const id = this.uuid();
        if (y && m && id) {
          this.loadData();
        }
      });
    });

    this.bankControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.saveSuccess.set('');
      this.saveError.set('');
    });

    this.growthPctControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.saveSuccess.set('');
      this.saveError.set('');
    });
  }

  async loadData(): Promise<void> {
    if (this._loadInProgress) return;
    this._loadInProgress = true;
    this.isLoading.set(true);
    this.loadError.set('');

    try {
      const session = await this.authService.getSession();
      if (!session) {
        this.loadError.set('Not authenticated');
        return;
      }
      this.currentUserId.set(session.user.id);

      const [userYearData, allMonthData, marketData, profiles] = await Promise.all([
        this.growthDataService.getGrowthDataForUserYear(this.uuid(), this.year()),
        this.growthDataService.getGrowthDataForYearMonth(this.year(), this.month()),
        this.marketDataService.getMarketIndexesForMonth(this.year(), this.month()),
        this.profileService.getRegisteredProfiles(),
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
    }
  }

  async onSave(): Promise<void> {
    this.isSaving.set(true);
    this.saveSuccess.set('');
    this.saveError.set('');

    try {
      const raw = this.growthPctControl.value.trim();
      if (raw !== '') {
        const parsed = parseFloat(raw);
        if (isNaN(parsed)) {
          this.saveError.set('Please enter a valid number.');
          return;
        }
        const session = await this.authService.getSession();
        if (!session) {
          this.saveError.set('Not authenticated');
          return;
        }
        await this.growthDataService.saveGrowthData({
          email_key: session.user.email!.toLowerCase(),
          bank_name: this.bankControl.value,
          year: this.year(),
          month: this.month(),
          growth_pct: parsed,
          user_id: session.user.id,
        });
        this.saveSuccess.set('Growth saved.');
        await this.loadData();
      } else {
        await this.growthDataService.deleteOwnGrowthDataForMonth(
          this.year(),
          this.month(),
          this.bankControl.value,
        );
        this.saveSuccess.set('Growth cleared.');
      }
    } catch (err: unknown) {
      this.saveError.set(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      this.isSaving.set(false);
    }
  }
}
