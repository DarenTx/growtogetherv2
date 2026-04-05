import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { GrowthDataService } from '../../core/services/growth-data.service';
import { ProfileService } from '../../core/services/profile.service';
import {
  MOCK_PROFILE_COMPLETE,
  createMockAdminService,
  createMockAuthService,
  createMockGrowthDataService,
  createMockProfileService,
} from '../../core/testing/mock-supabase.service';
import { DashboardComponent } from './dashboard.component';

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
    };
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);
    mockService['getAvailableYears'] = vi.fn().mockResolvedValue([2026, 2025, 2024]);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([{ path: 'login', component: DashboardComponent }]),
        { provide: AuthService, useValue: mockService },
        { provide: ProfileService, useValue: mockService },
        { provide: AdminService, useValue: mockService },
        { provide: GrowthDataService, useValue: mockService },
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
    // Reset and start fresh – block all three parallel calls
    let resolveAll!: () => void;
    const pending = new Promise<void>((res) => {
      resolveAll = res;
    });
    mockService['getProfile'] = vi.fn().mockReturnValue(pending.then(() => MOCK_PROFILE_COMPLETE));
    mockService['getAllProfiles'] = vi.fn().mockReturnValue(pending.then(() => []));
    mockService['getGrowthDataForYear'] = vi.fn().mockReturnValue(pending.then(() => []));
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.toLowerCase()).toContain('loading');
    resolveAll();
  });

  it('displays growth grid title with current year', () => {
    const title = fixture.nativeElement.querySelector('.gt-grid-title') as HTMLElement;
    expect(title.textContent).toContain(String(new Date().getFullYear()));
  });

  it('reloads growth data when year changes', async () => {
    mockService['getGrowthDataForYear'] = vi.fn().mockResolvedValue([]);
    await component.onYearChange(2024);
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
