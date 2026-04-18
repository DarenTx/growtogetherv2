import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';
import {
  createMockAuthService,
  createMockGrowthDataService,
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
    };

    mockService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);
    mockService['getOwnBankNames'] = vi
      .fn()
      .mockResolvedValue(['Edward Jones', 'Fidelity Investments']);
    mockService['getOwnGrowthDataForMonth'] = vi
      .fn()
      .mockImplementation(async (_year: number, _month: number, bankName: string) => {
        if (bankName === 'Fidelity Investments') {
          return {
            id: 'row-fidelity',
            email_key: null,
            user_id: 'user-uuid-123',
            year: 2026,
            month: 2,
            bank_name: 'Fidelity Investments',
            growth_pct: 2.25,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          };
        }
        return null;
      });
    mockService['saveGrowthData'] = vi.fn().mockResolvedValue(undefined);
    mockService['deleteOwnGrowthDataForMonth'] = vi.fn().mockResolvedValue(undefined);
    mockService['saveOwnGrowthDataForMonth'] = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [MonthlyGrowthEntryComponent],
      providers: [
        { provide: AuthService, useValue: mockService },
        { provide: GrowthDataService, useValue: mockService },
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
    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(2026, 2, 'Edward Jones');
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

    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(2025, 2, 'Edward Jones');
    expect(mockService['getOwnGrowthDataForMonth']).toHaveBeenCalledWith(
      2025,
      2,
      'Fidelity Investments',
    );
  });

  it('prefills existing values by bank', async () => {
    await createComponent(2026, 2);

    expect(component.growthByBank()['Fidelity Investments']).toBe('2.25');
    expect(component.growthByBank()['Edward Jones']).toBe('');
  });

  it('does not submit until all visible banks have values', async () => {
    await createComponent(2026, 2);

    component.onGrowthInput('Fidelity Investments', {
      target: { value: '5.25' },
    } as unknown as Event);

    await component.onSave();

    expect(component.errorMessage()).toContain('all listed banks');
    expect(mockService['saveOwnGrowthDataForMonth']).not.toHaveBeenCalled();
  });

  it('saves all bank values together with selected year/month', async () => {
    await createComponent(2026, 2);
    component.onGrowthInput('Fidelity Investments', {
      target: { value: '5.25' },
    } as unknown as Event);
    component.onGrowthInput('Edward Jones', { target: { value: '1.10' } } as unknown as Event);

    await component.onSave();

    expect(mockService['saveOwnGrowthDataForMonth']).toHaveBeenCalledWith(2026, 2, [
      {
        bank_name: 'Edward Jones',
        growth_pct: 1.1,
      },
      {
        bank_name: 'Fidelity Investments',
        growth_pct: 5.25,
      },
    ]);
  });

  it('rejects invalid numeric input for any bank', async () => {
    await createComponent(2026, 2);
    component.onGrowthInput('Fidelity Investments', {
      target: { value: 'abc' },
    } as unknown as Event);
    component.onGrowthInput('Edward Jones', { target: { value: '1.10' } } as unknown as Event);

    await component.onSave();

    expect(component.errorMessage()).toContain('Fidelity Investments');
    expect(mockService['saveOwnGrowthDataForMonth']).not.toHaveBeenCalled();
  });

  it('clears banners on input edits', async () => {
    await createComponent(2026, 2);
    component.errorMessage.set('Some error');
    component.successMessage.set('Some success');

    component.onGrowthInput('Fidelity Investments', {
      target: { value: '3.00' },
    } as unknown as Event);

    expect(component.errorMessage()).toBe('');
    expect(component.successMessage()).toBe('');
  });

  it('enables submission only when all bank inputs are non-empty', async () => {
    await createComponent(2026, 2);

    expect(component.canSubmit()).toBe(false);

    component.onGrowthInput('Fidelity Investments', {
      target: { value: '5.25' },
    } as unknown as Event);
    expect(component.canSubmit()).toBe(false);

    component.onGrowthInput('Edward Jones', { target: { value: '1.10' } } as unknown as Event);
    expect(component.canSubmit()).toBe(true);
  });

  it('does not call legacy per-bank save or delete on submit', async () => {
    await createComponent(2026, 2);
    component.onGrowthInput('Fidelity Investments', {
      target: { value: '5.25' },
    } as unknown as Event);
    component.onGrowthInput('Edward Jones', { target: { value: '1.10' } } as unknown as Event);

    await component.onSave();

    expect(mockService['saveGrowthData']).not.toHaveBeenCalled();
    expect(mockService['deleteOwnGrowthDataForMonth']).not.toHaveBeenCalled();
  });

  it('keeps manual rows off email_key by delegating to batch service', async () => {
    await createComponent(2026, 2);
    component.onGrowthInput('Fidelity Investments', {
      target: { value: '5.25' },
    } as unknown as Event);
    component.onGrowthInput('Edward Jones', { target: { value: '1.10' } } as unknown as Event);

    await component.onSave();

    expect(mockService['saveOwnGrowthDataForMonth']).toHaveBeenCalledWith(2026, 2, [
      {
        bank_name: 'Edward Jones',
        growth_pct: 1.1,
      },
      {
        bank_name: 'Fidelity Investments',
        growth_pct: 5.25,
      },
    ]);
    expect(mockService['saveGrowthData']).not.toHaveBeenCalledWith(
      expect.objectContaining({
        email_key: expect.any(String),
      }),
    );
  });

  it('handles empty bank list by preventing submit', async () => {
    mockService['getOwnBankNames'].mockResolvedValueOnce([]);
    await createComponent(2026, 2);

    await component.onSave();

    expect(component.errorMessage()).toContain('No banks available');
    expect(component.canSubmit()).toBe(false);
  });

  it('passes year and month unchanged to batch save', async () => {
    await createComponent(2024, 12);
    component.onGrowthInput('Fidelity Investments', {
      target: { value: '5.25' },
    } as unknown as Event);
    component.onGrowthInput('Edward Jones', { target: { value: '1.10' } } as unknown as Event);

    await component.onSave();

    expect(mockService['saveOwnGrowthDataForMonth']).toHaveBeenCalledWith(2024, 12, [
      {
        bank_name: 'Edward Jones',
        growth_pct: 1.1,
      },
      {
        bank_name: 'Fidelity Investments',
        growth_pct: 5.25,
      },
    ]);
  });
});
