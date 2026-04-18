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
    mockService['getOwnBankNames'] = vi.fn().mockResolvedValue(['Fidelity Investments']);
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

  async function createComponent(year = 2026, month = 2) {
    fixture = TestBed.createComponent(MonthlyGrowthEntryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('year', year);
    fixture.componentRef.setInput('month', month);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  }

  it('creates and renders the selected month/year label', async () => {
    await createComponent(2026, 2);
    expect(component).toBeTruthy();
    expect(component.displayLabel()).toBe('February 2026');
  });

  it('loads existing record using selected year/month', async () => {
    await createComponent(2026, 2);
    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      2026,
      2,
      'Fidelity Investments',
    );
  });

  it('reloads when year changes', async () => {
    await createComponent(2026, 2);
    mockService['getOwnGrowthDataForMonth'].mockClear();

    fixture.componentRef.setInput('year', 2025);
    fixture.detectChanges();
    await flush();

    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      2025,
      2,
      'Fidelity Investments',
    );
  });

  it('saves growth data with selected year/month', async () => {
    await createComponent(2026, 2);
    component.growthPctControl.setValue('5.25');

    await component.onSave();

    expect(mockService['saveGrowthData']).toHaveBeenCalledWith({
      email_key: 'test.personal@example.com',
      user_id: 'user-uuid-123',
      year: 2026,
      month: 2,
      bank_name: 'Fidelity Investments',
      growth_pct: 5.25,
    });
  });

  it('deletes growth data with selected year/month when value is blank', async () => {
    await createComponent(2026, 2);
    component.growthPctControl.setValue('');

    await component.onSave();

    expect(mockService['deleteOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      2026,
      2,
      'Fidelity Investments',
    );
  });

  it('rejects invalid numeric input', async () => {
    await createComponent(2026, 2);
    component.growthPctControl.setValue('abc');

    await component.onSave();

    expect(component.errorMessage()).toContain('valid number');
    expect(mockService['saveGrowthData']).not.toHaveBeenCalled();
  });
});
