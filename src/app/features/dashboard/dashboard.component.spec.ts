import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { GrowthDataService } from '../../core/services/growth-data.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { ProfileService } from '../../core/services/profile.service';
import { GrowthData } from '../../core/models/growth-data.interface';
import {
  MOCK_PROFILE_COMPLETE,
  createMockAdminService,
  createMockAuthService,
  createMockGrowthDataService,
  createMockMarketDataService,
  createMockProfileService,
} from '../../core/testing/mock-supabase.service';
import { DashboardComponent } from './dashboard.component';

function createGrowthRow(overrides: Partial<GrowthData> = {}): GrowthData {
  return {
    id: 'row-1',
    email_key: MOCK_PROFILE_COMPLETE.personal_email,
    bank_name: 'Bank A',
    year: new Date().getFullYear(),
    month: Math.max(1, new Date().getMonth()),
    growth_pct: 3.5,
    user_id: MOCK_PROFILE_COMPLETE.id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;
  let router: Router;

  beforeEach(async () => {
    // Combine all service mocks into one object for convenience
    mockService = {
      ...createMockAuthService(),
      ...createMockProfileService(),
      ...createMockAdminService(),
      ...createMockGrowthDataService(),
      ...createMockMarketDataService(),
    };
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    mockService['getAvailableYears'] = vi.fn().mockResolvedValue([2026, 2025, 2024]);
    mockService['getMarketIndexesForMonth'] = vi.fn().mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([{ path: 'login', component: DashboardComponent }]),
        { provide: AuthService, useValue: mockService },
        { provide: ProfileService, useValue: mockService },
        { provide: AdminService, useValue: mockService },
        { provide: GrowthDataService, useValue: mockService },
        { provide: MarketDataService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    // In a zoneless/Vitest environment whenStable() can resolve before the
    // component's Promise.all completes. The setTimeout(0) flushes the
    // microtask queue so all signal writes from ngOnInit are committed before
    // the final detectChanges re-renders the OnPush view.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads and displays the user profile', () => {
    expect(component.profile()).toEqual(MOCK_PROFILE_COMPLETE);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(MOCK_PROFILE_COMPLETE.first_name);
  });

  it('shows loading state before data loads', async () => {
    // Reset and start fresh – block both parallel calls
    let resolveAll!: () => void;
    const pending = new Promise<void>((res) => {
      resolveAll = res;
    });
    mockService['getProfile'] = vi.fn().mockReturnValue(pending.then(() => MOCK_PROFILE_COMPLETE));
    mockService['getGrowthDataForYear'] = vi.fn().mockReturnValue(pending.then(() => []));
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.toLowerCase()).toContain('loading');
    resolveAll();
  });

  it('shows the month/year selector', () => {
    const selector = fixture.nativeElement.querySelector('app-month-year-selector') as HTMLElement;
    expect(selector).toBeTruthy();
  });

  it('reloads growth data when year changes', async () => {
    mockService['getGrowthDataForYear'] = vi.fn().mockResolvedValue([]);
    await component.onSelectedYearChange(2024);
    expect(component.selectedYear()).toBe(2024);
    expect(mockService['getGrowthDataForYear']).toHaveBeenCalledWith(2024);
  });

  it('calls signOut and navigates to /login on sign out', async () => {
    mockService['signOut'] = vi.fn().mockResolvedValue(undefined);
    await component.signOut();
    expect(mockService['signOut']).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not show monthly growth entry for the current month when data is missing', () => {
    component.profile.set(MOCK_PROFILE_COMPLETE);
    component.selectedYear.set(new Date().getFullYear());
    component.selectedMonth.set(new Date().getMonth() + 1);
    component['growthData'].set([]);

    expect(component.showGrowthEntry()).toBe(false);
  });

  it('does not show monthly growth entry for a future month when data is missing', () => {
    component.profile.set(MOCK_PROFILE_COMPLETE);

    const now = new Date();
    if (now.getMonth() + 1 === 12) {
      component.selectedYear.set(now.getFullYear() + 1);
      component.selectedMonth.set(1);
    } else {
      component.selectedYear.set(now.getFullYear());
      component.selectedMonth.set(now.getMonth() + 2);
    }

    component['growthData'].set([]);
    expect(component.showGrowthEntry()).toBe(false);
  });

  it('shows monthly growth entry for a past month when data is missing', () => {
    component.profile.set(MOCK_PROFILE_COMPLETE);

    const now = new Date();
    if (now.getMonth() + 1 === 1) {
      component.selectedYear.set(now.getFullYear() - 1);
      component.selectedMonth.set(12);
    } else {
      component.selectedYear.set(now.getFullYear());
      component.selectedMonth.set(now.getMonth());
    }

    component['growthData'].set([]);
    expect(component.showGrowthEntry()).toBe(true);
  });

  it('keeps monthly growth entry visible when one of multiple banks is still missing', () => {
    const now = new Date();
    const selectedYear = now.getMonth() + 1 === 1 ? now.getFullYear() - 1 : now.getFullYear();
    const selectedMonth = now.getMonth() + 1 === 1 ? 12 : now.getMonth();

    component.profile.set(MOCK_PROFILE_COMPLETE);
    component.selectedYear.set(selectedYear);
    component.selectedMonth.set(selectedMonth);
    component['ownBankNames'].set(['Bank A', 'Bank B']);
    component['growthData'].set([
      createGrowthRow({ year: selectedYear, month: selectedMonth, bank_name: 'Bank A' }),
    ]);

    expect(component.showGrowthEntry()).toBe(true);
  });

  it('hides monthly growth entry when all known banks have selected-month data', () => {
    const now = new Date();
    const selectedYear = now.getMonth() + 1 === 1 ? now.getFullYear() - 1 : now.getFullYear();
    const selectedMonth = now.getMonth() + 1 === 1 ? 12 : now.getMonth();

    component.profile.set(MOCK_PROFILE_COMPLETE);
    component.selectedYear.set(selectedYear);
    component.selectedMonth.set(selectedMonth);
    component['ownBankNames'].set(['Bank A', 'Bank B']);
    component['growthData'].set([
      createGrowthRow({
        id: 'row-1',
        year: selectedYear,
        month: selectedMonth,
        bank_name: 'Bank A',
      }),
      createGrowthRow({
        id: 'row-2',
        year: selectedYear,
        month: selectedMonth,
        bank_name: 'Bank B',
      }),
    ]);

    expect(component.showGrowthEntry()).toBe(false);
  });

  it('creates separate monthly ranking rows when one player has multiple banks', () => {
    const now = new Date();
    const selectedYear = now.getMonth() + 1 === 1 ? now.getFullYear() - 1 : now.getFullYear();
    const selectedMonth = now.getMonth() + 1 === 1 ? 12 : now.getMonth();

    component.selectedYear.set(selectedYear);
    component.selectedMonth.set(selectedMonth);
    component['allProfiles'].set([
      {
        ...MOCK_PROFILE_COMPLETE,
        first_name: 'John',
        last_name: 'Doe',
      },
    ]);
    component['growthData'].set([
      createGrowthRow({
        id: 'row-bank-a-current',
        year: selectedYear,
        month: selectedMonth,
        bank_name: 'Bank A',
        growth_pct: 3.2,
      }),
      createGrowthRow({
        id: 'row-bank-a-prior',
        year: selectedYear,
        month: Math.max(1, selectedMonth - 1),
        bank_name: 'Bank A',
        growth_pct: 1.1,
      }),
      createGrowthRow({
        id: 'row-bank-b-current',
        year: selectedYear,
        month: selectedMonth,
        bank_name: 'Bank B',
        growth_pct: 4.4,
      }),
      createGrowthRow({
        id: 'row-bank-b-prior',
        year: selectedYear,
        month: Math.max(1, selectedMonth - 1),
        bank_name: 'Bank B',
        growth_pct: 2.2,
      }),
    ]);

    const rows = component.monthlyRankRows();

    expect(rows.length).toBe(2);
    expect(rows[0].playerName).toContain('Doe');
    expect(rows[0].bankName).toBe('Bank B');
    expect(rows[1].bankName).toBe('Bank A');
  });
});
