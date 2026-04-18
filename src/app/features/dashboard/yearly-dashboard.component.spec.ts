import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { GrowthDataService } from '../../core/services/growth-data.service';
import { MarketDataService } from '../../core/services/market-data.service';
import { ProfileService } from '../../core/services/profile.service';
import {
  MOCK_PROFILE_COMPLETE,
  createMockAdminService,
  createMockAuthService,
  createMockGrowthDataService,
  createMockMarketDataService,
  createMockProfileService,
} from '../../core/testing/mock-supabase.service';
import { YearlyDashboardComponent } from './yearly-dashboard.component';

describe('YearlyDashboardComponent', () => {
  let fixture: ComponentFixture<YearlyDashboardComponent>;
  let component: YearlyDashboardComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;
  let router: Router;

  beforeEach(async () => {
    mockService = {
      ...createMockAuthService(),
      ...createMockProfileService(),
      ...createMockAdminService(),
      ...createMockGrowthDataService(),
      ...createMockMarketDataService(),
      getMarketIndexesForYear: vi.fn().mockResolvedValue([]),
    };
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    mockService['getAvailableYears'] = vi.fn().mockResolvedValue([2026, 2025, 2024]);

    await TestBed.configureTestingModule({
      imports: [YearlyDashboardComponent],
      providers: [
        provideRouter([{ path: 'login', component: YearlyDashboardComponent }]),
        { provide: AuthService, useValue: mockService },
        { provide: ProfileService, useValue: mockService },
        { provide: AdminService, useValue: mockService },
        { provide: GrowthDataService, useValue: mockService },
        { provide: MarketDataService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(YearlyDashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders growth grid title', () => {
    const title = fixture.nativeElement.querySelector('.gt-grid-title') as HTMLElement;
    expect(title.textContent).toContain('Growth Grid');
  });

  it('reloads yearly data when selected year changes', async () => {
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
});
