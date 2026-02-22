import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import {
  MOCK_PROFILE_COMPLETE,
  createMockSupabaseService,
} from '../../core/testing/mock-supabase.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;
  let router: Router;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    mockService['getProfile'] = vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([{ path: 'login', component: DashboardComponent }]),
        { provide: SupabaseService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
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

  it('shows loading state before profile loads', async () => {
    // Reset and start fresh
    let resolveProfile!: (v: typeof MOCK_PROFILE_COMPLETE) => void;
    mockService['getProfile'] = vi.fn().mockImplementation(
      () =>
        new Promise<typeof MOCK_PROFILE_COMPLETE>((res) => {
          resolveProfile = res;
        }),
    );
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.toLowerCase()).toContain('loading');
    resolveProfile(MOCK_PROFILE_COMPLETE);
  });

  it('calls signOut and navigates to /login on sign out', async () => {
    mockService['signOut'] = vi.fn().mockResolvedValue(undefined);
    await component.signOut();
    expect(mockService['signOut']).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
