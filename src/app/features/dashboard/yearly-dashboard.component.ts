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
import { DashboardRow } from './dashboard-row.interface';
import { DashboardHeader } from './components/dashboard-header/dashboard-header';
import { GrowthGridComponent } from './components/growth-grid/growth-grid.component';
import { MonthYearSelectorComponent } from './components/month-year-selector/month-year-selector.component';

const CURRENT_YEAR = new Date().getFullYear();
const INSTALL_PROMPT_DISMISSED_KEY = 'grow_together_install_prompt_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type OrientationType = 'any' | 'natural' | 'landscape' | 'portrait';

@Component({
  selector: 'app-yearly-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    DashboardHeader,
    MonthYearSelectorComponent,
    GrowthGridComponent,
  ],
  templateUrl: './yearly-dashboard.component.html',
  styleUrl: './yearly-dashboard.component.css',
})
export class YearlyDashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly adminService = inject(AdminService);
  private readonly growthDataService = inject(GrowthDataService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly router = inject(Router);

  readonly selectedYear = signal<number>(CURRENT_YEAR);

  readonly profile = signal<Profile | null>(null);
  readonly isAdmin = computed(() => this.profile()?.is_admin ?? false);

  private readonly allProfiles = signal<Profile[]>([]);
  private readonly growthData = signal<GrowthData[]>([]);
  private readonly marketData = signal<MarketIndex[]>([]);

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

  private orientationLockApplied = false;

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

    // Build lookup: profile id to month index (0-based) to first growth_pct seen
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
      const idx = gd.month - 1;
      if (!monthMap.has(idx)) monthMap.set(idx, gd.growth_pct);
    }

    return profiles.map((p) => ({
      profileId: p.id,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      months: Array.from({ length: 12 }, (_, i) => {
        return lookup.get(p.id)?.get(i) ?? null;
      }),
    }));
  });

  async ngOnInit(): Promise<void> {
    this.initializeInstallPromptState();
    await this.tryLockLandscapeOrientation();

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
    void this.tryUnlockOrientation();
    window.removeEventListener('beforeinstallprompt', this.beforeInstallPromptHandler);
    window.removeEventListener('appinstalled', this.appInstalledHandler);
  }

  async onSelectedYearChange(year: number): Promise<void> {
    this.selectedYear.set(year);
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

  private async tryLockLandscapeOrientation(): Promise<void> {
    if (typeof screen === 'undefined') {
      return;
    }

    const orientation = screen.orientation as
      | { lock?: (orientation: OrientationType) => Promise<void>; unlock?: () => void }
      | undefined;
    if (!orientation?.lock) {
      return;
    }

    try {
      await orientation.lock('landscape');
      this.orientationLockApplied = true;
    } catch {
      this.orientationLockApplied = false;
    }
  }

  private async tryUnlockOrientation(): Promise<void> {
    if (!this.orientationLockApplied || typeof screen === 'undefined') {
      return;
    }

    const orientation = screen.orientation as
      | { lock?: (orientation: OrientationType) => Promise<void>; unlock?: () => void }
      | undefined;

    try {
      if (orientation?.unlock) {
        orientation.unlock();
      } else if (orientation?.lock) {
        await orientation.lock('any');
      }
    } catch {
      // Ignore unlock failures (platform restrictions).
    }
  }
}
