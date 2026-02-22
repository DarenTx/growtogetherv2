import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  MOCK_PROFILE_COMPLETE,
  createMockSupabaseService,
} from '../../../core/testing/mock-supabase.service';
import { EnterHistoricalDataComponent } from './enter-historical-data.component';

const MOCK_PROFILES = [MOCK_PROFILE_COMPLETE];

const MOCK_GROWTH = [
  {
    id: 'g-1',
    email_key: 'john@example.com',
    bank_name: 'Fidelity Investments',
    is_managed: false,
    year: 2024,
    month: 1,
    growth_pct: 4.2,
    user_id: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
];

describe('EnterHistoricalDataComponent', () => {
  let fixture: ComponentFixture<EnterHistoricalDataComponent>;
  let component: EnterHistoricalDataComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    mockService['getAllProfiles'] = vi.fn().mockResolvedValue(MOCK_PROFILES);
    mockService['saveGrowthData'] = vi.fn().mockResolvedValue(undefined);
    mockService['getGrowthDataByEmailKey'] = vi.fn().mockResolvedValue(MOCK_GROWTH);

    await TestBed.configureTestingModule({
      imports: [EnterHistoricalDataComponent],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EnterHistoricalDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads profiles on init', () => {
    expect(mockService['getAllProfiles']).toHaveBeenCalled();
    expect(component.profiles()).toEqual(MOCK_PROFILES);
  });

  it('disables form when profile load fails', async () => {
    mockService['getAllProfiles'] = vi.fn().mockRejectedValue(new Error('DB unreachable'));
    fixture = TestBed.createComponent(EnterHistoricalDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.profileLoadError()).toContain('DB unreachable');
    expect(component.form.disabled).toBe(true);
  });

  it('shows growth data list after profile selection', async () => {
    const event = { target: { value: MOCK_PROFILE_COMPLETE.id } } as unknown as Event;
    await component.onProfileChange(event);
    fixture.detectChanges();
    expect(component.selectedProfile()).toEqual(MOCK_PROFILE_COMPLETE);
    expect(component.showGrowthData()).toBe(true);
    expect(component.growthData()).toEqual(MOCK_GROWTH);
  });

  it('calls saveGrowthData on valid submit and advances month', async () => {
    component.form.patchValue({ profile_id: MOCK_PROFILE_COMPLETE.id });
    component.selectedProfile.set(MOCK_PROFILE_COMPLETE);
    component.form.setValue({
      profile_id: MOCK_PROFILE_COMPLETE.id,
      year: 2024,
      month: 3,
      bank_name: 'Fidelity Investments',
      is_managed: false,
      growth_pct: 5.1,
    });
    await component.onSubmit();
    expect(mockService['saveGrowthData']).toHaveBeenCalledWith(
      expect.objectContaining({
        email_key: 'john@example.com',
        user_id: null,
        year: 2024,
        month: 3,
        bank_name: 'Fidelity Investments',
        is_managed: false,
        growth_pct: 5.1,
      }),
    );
    expect(component.form.controls.month.value).toBe(4);
    expect(component.successMessage()).toBeTruthy();
  });

  it('rolls over month 12 to month 1 of next year', async () => {
    component.selectedProfile.set(MOCK_PROFILE_COMPLETE);
    component.form.setValue({
      profile_id: MOCK_PROFILE_COMPLETE.id,
      year: 2024,
      month: 12,
      bank_name: 'Edward Jones',
      is_managed: true,
      growth_pct: 2.0,
    });
    await component.onSubmit();
    expect(component.form.controls.month.value).toBe(1);
    expect(component.form.controls.year.value).toBe(2025);
  });

  it('shows error on submit failure', async () => {
    mockService['saveGrowthData'] = vi.fn().mockRejectedValue(new Error('Save failed'));
    component.selectedProfile.set(MOCK_PROFILE_COMPLETE);
    component.form.setValue({
      profile_id: MOCK_PROFILE_COMPLETE.id,
      year: 2024,
      month: 1,
      bank_name: 'Fidelity Investments',
      is_managed: false,
      growth_pct: 1.0,
    });
    await component.onSubmit();
    expect(component.errorMessage()).toContain('Save failed');
  });

  it('clearAll resets all fields and hides growth data list', () => {
    component.selectedProfile.set(MOCK_PROFILE_COMPLETE);
    component.form.controls.bank_name.setValue('Edward Jones');
    component.clearAll();
    expect(component.selectedProfile()).toBeNull();
    expect(component.form.controls.bank_name.value).toBe('Fidelity Investments');
    expect(component.form.controls.is_managed.value).toBe(false);
    expect(component.showGrowthData()).toBe(false);
  });
});
