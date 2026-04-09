import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  createMockAuthService,
  createMockGrowthDataService,
  createMockProfileService,
} from '../../../core/testing/mock-supabase.service';
import { MonthlyGrowthEntryComponent } from './monthly-growth-entry.component';

const MOCK_SESSION = {
  user: { id: 'user-uuid-123', email: 'test@example.com' },
};

// Helper to flush microtasks/promises
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('MonthlyGrowthEntryComponent', () => {
  let fixture: ComponentFixture<MonthlyGrowthEntryComponent>;
  let component: MonthlyGrowthEntryComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(async () => {
    mockService = {
      ...createMockAuthService(),
      ...createMockGrowthDataService(),
      ...createMockProfileService(),
    };
    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getProfile'] = vi.fn().mockResolvedValue({
      id: 'user-uuid-123',
      first_name: 'Test',
      last_name: 'User',
      work_email: 'test@example.com',
      personal_email: 'test.personal@example.com',
      is_admin: false,
      work_email_verified: true,
      personal_email_verified: false,
      registration_complete: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    mockService['getOwnBankNames'] = vi
      .fn()
      .mockResolvedValue(['Fidelity Investments', 'Edward Jones']);
    mockService['getOwnGrowthDataForMonth'] = vi.fn().mockResolvedValue(null);
    mockService['saveGrowthData'] = vi.fn().mockResolvedValue(undefined);
    mockService['deleteOwnGrowthDataForMonth'] = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [MonthlyGrowthEntryComponent],
      providers: [
        { provide: AuthService, useValue: mockService },
        { provide: GrowthDataService, useValue: mockService },
        { provide: ProfileService, useValue: mockService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createComponent() {
    fixture = TestBed.createComponent(MonthlyGrowthEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  }

  // ─── 1. Component creates ────────────────────────────────────────────────

  it('creates the component', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  // ─── 1b. Populates bankOptions from getOwnBankNames ─────────────────────

  it('populates bankOptions from getOwnBankNames on init', async () => {
    await createComponent();
    expect(component.bankOptions()).toEqual(['Fidelity Investments', 'Edward Jones']);
  });

  it('sets bankControl to first bank name returned by getOwnBankNames', async () => {
    await createComponent();
    expect(component.bankControl.value).toBe('Fidelity Investments');
  });

  it('leaves bankControl empty when getOwnBankNames returns no results', async () => {
    mockService['getOwnBankNames'] = vi.fn().mockResolvedValue([]);
    await createComponent();
    expect(component.bankControl.value).toBe('');
    expect(component.bankOptions()).toEqual([]);
  });

  it('continues loading form when getOwnBankNames rejects', async () => {
    mockService['getOwnBankNames'] = vi.fn().mockRejectedValue(new Error('network error'));
    await createComponent();
    // Form should still be functional (loadFailed is for growth data, not bank names)
    expect(component).toBeTruthy();
    expect(component.bankOptions()).toEqual([]);
  });

  // ─── 2. displayLabel reflects previous month on init (run in March) ─────

  it('displayLabel reflects previous month (February 2026) when current date is March 2026', async () => {
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
    await createComponent();
    expect(component.displayLabel).toBe('February 2026');
  });

  // ─── 3. January boundary ─────────────────────────────────────────────────

  it('displayLabel shows December of previous year when current date is January', async () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    await createComponent();
    expect(component.displayLabel).toBe('December 2025');
  });

  // ─── 4. Initial load calls getOwnGrowthDataForMonth for default bank ─────

  it('calls getOwnGrowthDataForMonth for Fidelity Investments on init', async () => {
    await createComponent();
    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      component.prevYear,
      component.prevMonth,
      'Fidelity Investments',
    );
  });

  // ─── 5. Existing record pre-fills growthPctControl ───────────────────────

  it('pre-fills growthPctControl with toFixed(2) when record exists', async () => {
    mockService['getOwnGrowthDataForMonth'] = vi.fn().mockResolvedValue({ growth_pct: 3.75 });
    await createComponent();
    expect(component.growthPctControl.value).toBe('3.75');
  });

  // ─── 6. No existing record leaves growthPctControl empty ─────────────────

  it('leaves growthPctControl empty when no record exists', async () => {
    mockService['getOwnGrowthDataForMonth'] = vi.fn().mockResolvedValue(null);
    await createComponent();
    expect(component.growthPctControl.value).toBe('');
  });

  // ─── 7. Load failure sets loadFailed; form remains enabled ───────────────

  it('sets loadFailed to true on fetch error; form control remains enabled', async () => {
    mockService['getOwnGrowthDataForMonth'] = vi.fn().mockRejectedValue(new Error('network error'));
    await createComponent();
    expect(component.loadFailed()).toBe(true);
    expect(component.growthPctControl.enabled).toBe(true);
  });

  // ─── 8. Changing bank clears growthPctControl and re-fetches ─────────────

  it('clears growthPctControl and re-fetches when bank changes', async () => {
    // First call (Fidelity) returns a record
    mockService['getOwnGrowthDataForMonth'] = vi
      .fn()
      .mockResolvedValueOnce({ growth_pct: 3.75 })
      .mockResolvedValueOnce(null);

    await createComponent();
    expect(component.growthPctControl.value).toBe('3.75');

    component.bankControl.setValue('Edward Jones');
    await flush();

    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      component.prevYear,
      component.prevMonth,
      'Edward Jones',
    );
    expect(component.growthPctControl.value).toBe('');
  });

  // ─── 9. Valid decimal save calls saveGrowthData with 7-field payload ─────

  it('calls saveGrowthData with all 7 required fields on valid save', async () => {
    await createComponent();
    component.growthPctControl.setValue('5.25');
    await component.onSave();

    expect(mockService['saveGrowthData']).toHaveBeenCalledWith({
      email_key: 'test.personal@example.com',
      user_id: 'user-uuid-123',
      year: component.prevYear,
      month: component.prevMonth,
      bank_name: 'Fidelity Investments',
      growth_pct: 5.25,
    });
  });

  // ─── 10. Successful save sets successMessage ─────────────────────────────

  it('sets successMessage to "Growth saved." on successful save', async () => {
    await createComponent();
    component.growthPctControl.setValue('3.00');
    await component.onSave();
    expect(component.successMessage()).toBe('Growth saved.');
  });

  // ─── 11. Blank save calls deleteOwnGrowthDataForMonth ────────────────────

  it('calls deleteOwnGrowthDataForMonth with correct args on blank save', async () => {
    await createComponent();
    component.growthPctControl.setValue('');
    await component.onSave();

    expect(mockService['deleteOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      component.prevYear,
      component.prevMonth,
      component.bankControl.value,
    );
  });

  // ─── 12. Successful delete sets successMessage ───────────────────────────

  it('sets successMessage to "Growth cleared." on successful delete', async () => {
    await createComponent();
    component.growthPctControl.setValue('');
    await component.onSave();
    expect(component.successMessage()).toBe('Growth cleared.');
  });

  // ─── 13. Non-numeric input does not call saveGrowthData ──────────────────

  it('does not call saveGrowthData and sets errorMessage for non-numeric input', async () => {
    await createComponent();
    component.growthPctControl.setValue('abc');
    await component.onSave();

    expect(mockService['saveGrowthData']).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBeTruthy();
  });

  // ─── 14. Save failure sets errorMessage ──────────────────────────────────

  it('sets errorMessage on save failure', async () => {
    mockService['saveGrowthData'] = vi.fn().mockRejectedValue(new Error('DB error'));
    await createComponent();
    component.growthPctControl.setValue('2.00');
    await component.onSave();

    expect(component.errorMessage()).toBe('DB error');
  });

  // ─── 15. Editing growthPctControl clears both banners ────────────────────

  it('clears successMessage and errorMessage when growthPctControl changes', async () => {
    await createComponent();
    component.successMessage.set('Growth saved.');
    component.errorMessage.set('Some error');

    component.growthPctControl.setValue('1.00');
    await flush();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toBe('');
  });

  // ─── 16. isSaving is true during save and false after ────────────────────

  it('sets isSaving to true during save and false after', async () => {
    let resolveSave!: () => void;
    mockService['saveGrowthData'] = vi.fn().mockReturnValue(
      new Promise<void>((res) => {
        resolveSave = res;
      }),
    );

    await createComponent();
    component.growthPctControl.setValue('1.00');

    const savePromise = component.onSave();
    expect(component.isSaving()).toBe(true);

    resolveSave();
    await savePromise;
    expect(component.isSaving()).toBe(false);
  });
});
