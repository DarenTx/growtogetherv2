import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { GrowthData } from '../../core/models/growth-data.interface';
import { MarketIndex } from '../../core/models/market-index.interface';
import { Profile } from '../../core/models/profile.interface';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { GrowthDataService } from '../../core/services/growth-data.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { ProfileService } from '../../core/services/profile.service';
import { ClassicScorecardComponent } from './components/classic-scorecard/classic-scorecard.component';
import { DashboardHeader } from './components/dashboard-header/dashboard-header';
import {
  MonthlyRankListComponent,
  MonthlyRankRow,
} from './components/monthly-rank-list/monthly-rank-list.component';
import { MonthYearSelectorComponent } from './components/month-year-selector/month-year-selector.component';
import { MonthlyGrowthEntryComponent } from './monthly-growth-entry/monthly-growth-entry.component';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const PREV_MONTH = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
const PREV_MONTH_YEAR = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;
const INSTALL_PROMPT_DISMISSED_KEY = 'grow_together_install_prompt_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    DashboardHeader,
    MonthYearSelectorComponent,
    ClassicScorecardComponent,
    MonthlyGrowthEntryComponent,
    MonthlyRankListComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly adminService = inject(AdminService);
  private readonly growthDataService = inject(GrowthDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly router = inject(Router);

  readonly selectedYear = signal<number>(PREV_MONTH_YEAR);
  readonly selectedMonth = signal<number>(PREV_MONTH);
  readonly scorecardRefreshKey = signal(0);

  readonly profile = signal<Profile | null>(null);
  readonly isAdmin = computed(() => this.profile()?.is_admin ?? false);

  private readonly allProfiles = signal<Profile[]>([]);
  private readonly growthData = signal<GrowthData[]>([]);
  private readonly ownBankNames = signal<string[]>([]);
  private readonly marketIndexes = signal<MarketIndex[]>([]);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly deferredInstallPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly isStandalone = signal(false);
  readonly isPhone = signal(false);
  readonly isIos = signal(false);
  readonly installPromptDismissed = signal(false);
  readonly showInstallPrompt = computed(
    () =>
      !this.loading() &&
      !this.errorMessage() &&
      this.isPhone() &&
      !this.isStandalone() &&
      !this.installPromptDismissed() &&
      (!!this.deferredInstallPrompt() || this.isIos()),
  );

  private readonly beforeInstallPromptHandler = (event: Event): void => {
    event.preventDefault();
    this.deferredInstallPrompt.set(event as BeforeInstallPromptEvent);
  };

  private readonly appInstalledHandler = (): void => {
    this.isStandalone.set(true);
    this.installPromptDismissed.set(true);
    this.deferredInstallPrompt.set(null);
    this.persistInstallPromptDismissed();
  };

  private matchesProfileGrowthRow(profile: Profile, row: GrowthData): boolean {
    if (row.user_id === profile.id) {
      return true;
    }

    const emailKey = row.email_key?.toLowerCase();
    if (!emailKey) {
      return false;
    }

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
    const source = this.growthData();

    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    return source.some(
      (d) =>
        this.matchesProfileGrowthRow(profile, d) &&
        d.year === selectedYear &&
        d.month === selectedMonth,
    );
  });

  readonly hasAllSelectedMonthBankData = computed(() => {
    const profile = this.profile();
    if (!profile?.id) {
      return false;
    }

    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    const source = this.growthData();

    const recordedBanks = new Set(
      source
        .filter(
          (row) =>
            this.matchesProfileGrowthRow(profile, row) &&
            row.year === selectedYear &&
            row.month === selectedMonth,
        )
        .map((row) => row.bank_name.trim().toLowerCase()),
    );

    const requiredBanks = new Set(
      this.ownBankNames()
        .map((bankName) => bankName.trim().toLowerCase())
        .filter((bankName) => bankName !== ''),
    );

    if (requiredBanks.size === 0) {
      return recordedBanks.size > 0;
    }

    for (const bankName of requiredBanks) {
      if (!recordedBanks.has(bankName)) {
        return false;
      }
    }

    return true;
  });

  readonly isPastSelectedMonth = computed(() => {
    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    if (selectedYear < CURRENT_YEAR) return true;
    if (selectedYear > CURRENT_YEAR) return false;
    return selectedMonth < CURRENT_MONTH;
  });

  readonly showGrowthEntry = computed(
    () => this.isPastSelectedMonth() && !this.hasAllSelectedMonthBankData(),
  );

  readonly monthlyRankRows = computed<MonthlyRankRow[]>(() => {
    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    const growthData = this.growthData();
    const profiles = this.allProfiles();

    const profileById = new Map<string, Profile>();
    const profileByEmail = new Map<string, Profile>();
    for (const profile of profiles) {
      profileById.set(profile.id, profile);
      const personalEmail = profile.personal_email?.toLowerCase();
      if (personalEmail) {
        profileByEmail.set(personalEmail, profile);
      }
      const workEmail = profile.work_email?.toLowerCase();
      if (workEmail) {
        profileByEmail.set(workEmail, profile);
      }
    }

    const perProfileBankRows = new Map<
      string,
      { profile: Profile; bankName: string; rows: GrowthData[] }
    >();
    for (const row of growthData) {
      if (row.year !== selectedYear || row.month > selectedMonth) {
        continue;
      }

      const emailKey = row.email_key?.toLowerCase();
      const profile = row.user_id
        ? profileById.get(row.user_id)
        : emailKey
          ? profileByEmail.get(emailKey)
          : undefined;
      if (!profile) {
        continue;
      }

      const bankName = row.bank_name.trim();
      const profileBankKey = `${profile.id}::${bankName.toLowerCase()}`;
      if (!perProfileBankRows.has(profileBankKey)) {
        perProfileBankRows.set(profileBankKey, {
          profile,
          bankName: bankName || row.bank_name,
          rows: [],
        });
      }
      perProfileBankRows.get(profileBankKey)!.rows.push(row);
    }

    const rowsForSelectedMonth = Array.from(perProfileBankRows.values())
      .map((group) => {
        const monthRows = group.rows.filter((row) => row.month === selectedMonth);
        if (monthRows.length === 0) {
          return null;
        }
        const monthRow = monthRows[0];
        return {
          profile: group.profile,
          bankName: group.bankName,
          monthRow,
          trendRows: group.rows,
        };
      })
      .filter(
        (
          group,
        ): group is {
          profile: Profile;
          bankName: string;
          monthRow: GrowthData;
          trendRows: GrowthData[];
        } => group !== null,
      )
      .sort((a, b) => b.monthRow.growth_pct - a.monthRow.growth_pct);

    return rowsForSelectedMonth.map((group, index) => {
      const displayName = `${group.profile.last_name ?? ''}, ${group.profile.first_name ?? ''}`
        .trim()
        .replace(/^,\s*/, '');

      const monthlyTrendRows = group.trendRows
        .sort((a, b) => a.month - b.month)
        .filter((r) => r.month <= selectedMonth);

      const monthValues = new Map<number, number>();
      for (const monthlyRow of monthlyTrendRows) {
        if (!monthValues.has(monthlyRow.month)) {
          monthValues.set(monthlyRow.month, monthlyRow.growth_pct);
        }
      }

      return {
        rank: index + 1,
        playerName: displayName,
        bankName: group.bankName,
        trendData: Array.from(monthValues.values()).join(','),
        growthPct: group.monthRow.growth_pct,
      };
    });
  });

  readonly monthlyPlayerAveragePct = computed<number | null>(() => {
    const rows = this.monthlyRankRows();
    if (rows.length === 0) {
      return null;
    }
    return rows.reduce((sum, row) => sum + row.growthPct, 0) / rows.length;
  });

  readonly monthlyDowGrowthPct = computed<number | null>(() => {
    return (
      this.marketIndexes().find((index) => index.index_name.toLowerCase().startsWith('dow'))
        ?.growth_pct ?? null
    );
  });

  readonly monthlySp500GrowthPct = computed<number | null>(() => {
    return (
      this.marketIndexes().find((index) => index.index_name.toLowerCase().startsWith('s&p'))
        ?.growth_pct ?? null
    );
  });

  async ngOnInit(): Promise<void> {
    this.initializeInstallPromptState();

    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [ownProfile, allProfiles, growthData, ownBankNames, marketIndexes] = await Promise.all([
        this.profileService.getProfile(),
        this.adminService.getAllProfiles(),
        this.growthDataService.getGrowthDataForYear(this.selectedYear()),
        this.growthDataService.getOwnBankNames(),
        this.marketDataService.getMarketIndexesForMonth(this.selectedYear(), this.selectedMonth()),
      ]);
      this.profile.set(ownProfile);
      this.allProfiles.set(allProfiles);
      this.growthData.set(growthData);
      this.ownBankNames.set([...new Set(ownBankNames)]);
      this.marketIndexes.set(marketIndexes);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('beforeinstallprompt', this.beforeInstallPromptHandler);
    window.removeEventListener('appinstalled', this.appInstalledHandler);
  }

  async onSelectedYearChange(year: number): Promise<void> {
    this.selectedYear.set(year);
    await Promise.all([
      this.reloadGrowthDataForYear(year),
      this.reloadMarketDataForMonth(year, this.selectedMonth()),
    ]);
  }

  async onSelectedMonthChange(month: number): Promise<void> {
    this.selectedMonth.set(month);
    await this.reloadMarketDataForMonth(this.selectedYear(), month);
  }

  async onGrowthEntrySaved(): Promise<void> {
    try {
      await this.reloadGrowthDataForYear(this.selectedYear());
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

  async installShortcut(): Promise<void> {
    const promptEvent = this.deferredInstallPrompt();
    if (!promptEvent) {
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      this.installPromptDismissed.set(true);
      this.persistInstallPromptDismissed();
    }
    this.deferredInstallPrompt.set(null);
  }

  dismissInstallPrompt(): void {
    this.installPromptDismissed.set(true);
    this.persistInstallPromptDismissed();
  }

  private initializeInstallPromptState(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    this.isPhone.set(/iphone|ipod|android|mobile/.test(ua));
    this.isIos.set(/iphone|ipad|ipod/.test(ua));

    const standaloneFromMedia =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const standaloneFromNavigator =
      'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
    this.isStandalone.set(standaloneFromMedia || standaloneFromNavigator);

    this.installPromptDismissed.set(this.readInstallPromptDismissed());

    window.addEventListener('beforeinstallprompt', this.beforeInstallPromptHandler);
    window.addEventListener('appinstalled', this.appInstalledHandler);
  }

  private readInstallPromptDismissed(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private persistInstallPromptDismissed(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
    } catch {
      // Ignore storage failures (private browsing, disabled storage).
    }
  }

  private async reloadGrowthDataForYear(year: number): Promise<void> {
    this.errorMessage.set(null);
    try {
      const growthData = await this.growthDataService.getGrowthDataForYear(year);
      this.growthData.set(growthData);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load growth data.');
    }
  }

  private async reloadMarketDataForMonth(year: number, month: number): Promise<void> {
    this.errorMessage.set(null);
    try {
      const marketIndexes = await this.marketDataService.getMarketIndexesForMonth(year, month);
      this.marketIndexes.set(marketIndexes);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load market data.');
    }
  }
}
