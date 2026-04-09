import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { GrowthData } from '../../core/models/growth-data.interface';
import { Profile } from '../../core/models/profile.interface';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { GrowthDataService } from '../../core/services/growth-data.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { MarketIndex } from '../../core/models/market-index.interface';
import { ProfileService } from '../../core/services/profile.service';
import { ClassicScorecardComponent } from './components/classic-scorecard/classic-scorecard.component';
import { DashboardHeader } from './components/dashboard-header/dashboard-header';
import { GrowthGridComponent } from './components/growth-grid/growth-grid.component';
import { MonthlyGrowthEntryComponent } from './monthly-growth-entry/monthly-growth-entry.component';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const PREV_MONTH = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
const PREV_MONTH_YEAR = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;

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
  imports: [
    DashboardHeader,
    ClassicScorecardComponent,
    GrowthGridComponent,
    MonthlyGrowthEntryComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly adminService = inject(AdminService);
  private readonly growthDataService = inject(GrowthDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly router = inject(Router);

  readonly selectedYear = signal<number>(CURRENT_YEAR);
  readonly currentYear = CURRENT_YEAR;
  readonly currentMonth = CURRENT_MONTH;
  readonly scorecardYear = signal<number>(PREV_MONTH_YEAR);
  readonly scorecardMonth = signal<number>(PREV_MONTH);
  readonly scorecardRefreshKey = signal(0);

  readonly profile = signal<Profile | null>(null);
  readonly isAdmin = computed(() => this.profile()?.is_admin ?? false);

  private readonly allProfiles = signal<Profile[]>([]);
  private readonly growthData = signal<GrowthData[]>([]);
  private readonly marketData = signal<MarketIndex[]>([]);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // Only populated when PREV_MONTH_YEAR !== CURRENT_YEAR (i.e. in January)
  private readonly prevYearGrowthData = signal<GrowthData[]>([]);

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

  readonly hasPrevMonthData = computed(() => {
    const profile = this.profile();
    if (!profile?.id) return false;
    const source = PREV_MONTH_YEAR === CURRENT_YEAR ? this.growthData() : this.prevYearGrowthData();
    return source.some(
      (d) =>
        this.matchesProfileGrowthRow(profile, d) &&
        d.year === PREV_MONTH_YEAR &&
        d.month === PREV_MONTH,
    );
  });

  readonly showGrowthEntry = computed(() => !this.hasPrevMonthData());

  private marketMonths(indexName: string): (number | null)[] {
    const data = this.marketData();
    return Array.from({ length: 12 }, (_, i) => {
      const entry = data.find((m) => m.index_name === indexName && m.month === i + 1);
      return entry?.growth_pct ?? null;
    });
  }

  readonly dowMonths = computed<(number | null)[]>(() => this.marketMonths('Dow'));
  readonly sp500Months = computed<(number | null)[]>(() => this.marketMonths('S&P 500'));

  readonly rows = computed<DashboardRow[]>(() => {
    const profiles = this.allProfiles();
    const growthData = this.growthData();

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

    // Build lookup: profile id → month index (0-based) → first growth_pct seen
    const lookup = new Map<string, Map<number, number>>();
    for (const gd of growthData) {
      const key = gd.user_id
        ? gd.user_id
        : (personalEmailToProfileId.get(gd.email_key.toLowerCase()) ??
          workEmailToProfileId.get(gd.email_key.toLowerCase()));
      if (!key) {
        continue;
      }

      if (!lookup.has(key)) {
        lookup.set(key, new Map<number, number>());
      }
      const monthMap = lookup.get(key)!;
      const idx = gd.month - 1; // convert 1-based month to 0-based index
      if (!monthMap.has(idx)) monthMap.set(idx, gd.growth_pct);
    }

    return profiles.map((p) => ({
      profileId: p.id,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      months: Array.from({ length: 12 }, (_, i) => {
        const key = p.id;
        return lookup.get(key)?.get(i) ?? null;
      }),
    }));
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [ownProfile, profiles, growthData, marketData] = await Promise.all([
        this.profileService.getProfile(),
        this.adminService.getAllProfiles(),
        this.growthDataService.getGrowthDataForYear(this.selectedYear()),
        this.marketDataService.getMarketIndexesForYear(this.selectedYear()),
      ]);
      this.profile.set(ownProfile);
      this.allProfiles.set(profiles);
      this.growthData.set(growthData);
      this.marketData.set(marketData);
      if (PREV_MONTH_YEAR !== CURRENT_YEAR) {
        const prevYearData = await this.growthDataService.getGrowthDataForYear(PREV_MONTH_YEAR);
        this.prevYearGrowthData.set(prevYearData);
      }
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      this.loading.set(false);
    }
  }

  async onYearChange(year: number): Promise<void> {
    this.selectedYear.set(year);
    this.scorecardYear.set(year);
    this.scorecardMonth.set(12);
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [growthData, marketData] = await Promise.all([
        this.growthDataService.getGrowthDataForYear(year),
        this.marketDataService.getMarketIndexesForYear(year),
      ]);
      this.growthData.set(growthData);
      this.marketData.set(marketData);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load growth data.');
    } finally {
      this.loading.set(false);
    }
  }

  async onScorecardYearChange(year: number): Promise<void> {
    this.selectedYear.set(year);
    // Do NOT set loading here — that would destroy and recreate the scorecard,
    // losing the user's navigation position.
    try {
      const [growthData, marketData] = await Promise.all([
        this.growthDataService.getGrowthDataForYear(year),
        this.marketDataService.getMarketIndexesForYear(year),
      ]);
      this.growthData.set(growthData);
      this.marketData.set(marketData);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load growth data.');
    }
  }

  async onGrowthEntrySaved(): Promise<void> {
    try {
      const year = this.selectedYear();
      const [growthData, marketData] = await Promise.all([
        this.growthDataService.getGrowthDataForYear(year),
        this.marketDataService.getMarketIndexesForYear(year),
      ]);
      this.growthData.set(growthData);
      this.marketData.set(marketData);
      if (PREV_MONTH_YEAR !== CURRENT_YEAR) {
        const prevYearData = await this.growthDataService.getGrowthDataForYear(PREV_MONTH_YEAR);
        this.prevYearGrowthData.set(prevYearData);
      }
      this.scorecardRefreshKey.update((k) => k + 1);
    } catch (err: unknown) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Failed to refresh dashboard data.',
      );
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
