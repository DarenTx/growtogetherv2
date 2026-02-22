import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../core/testing/mock-supabase.service';
import { EnterMarketDataComponent } from './enter-market-data.component';

const MOCK_INDEXES = [
  {
    id: 'idx-1',
    index_name: 'S&P 500',
    year: 2024,
    month: 1,
    growth_pct: 3.5,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
];

describe('EnterMarketDataComponent', () => {
  let fixture: ComponentFixture<EnterMarketDataComponent>;
  let component: EnterMarketDataComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(async () => {
    mockService = createMockSupabaseService();
    mockService['getMarketIndexes'] = vi.fn().mockResolvedValue(MOCK_INDEXES);
    mockService['saveMarketIndex'] = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [EnterMarketDataComponent],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EnterMarketDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads market indexes on init', () => {
    expect(mockService['getMarketIndexes']).toHaveBeenCalled();
    expect(component.indexes()).toHaveLength(1);
  });

  it('calls saveMarketIndex on valid submit and advances month', async () => {
    component.form.setValue({
      index_name: 'S&P 500',
      year: 2024,
      month: 6,
      growth_pct: 2.5,
    });
    await component.onSubmit();
    expect(mockService['saveMarketIndex']).toHaveBeenCalledWith({
      index_name: 'S&P 500',
      year: 2024,
      month: 6,
      growth_pct: 2.5,
    });
    expect(component.form.controls.month.value).toBe(7);
    expect(component.successMessage()).toBeTruthy();
  });

  it('rolls over month 12 to month 1 of next year', async () => {
    component.form.setValue({
      index_name: 'Dow Jones',
      year: 2024,
      month: 12,
      growth_pct: 1.0,
    });
    await component.onSubmit();
    expect(component.form.controls.month.value).toBe(1);
    expect(component.form.controls.year.value).toBe(2025);
  });

  it('shows error message on saveMarketIndex failure', async () => {
    mockService['saveMarketIndex'] = vi.fn().mockRejectedValue(new Error('Network error'));
    component.form.setValue({
      index_name: 'S&P 500',
      year: 2024,
      month: 1,
      growth_pct: 1.0,
    });
    await component.onSubmit();
    expect(component.errorMessage()).toContain('Network error');
  });

  it('clearAll resets all form fields', () => {
    component.form.setValue({
      index_name: 'Dow Jones',
      year: 2005,
      month: 5,
      growth_pct: 9.9,
    });
    component.clearAll();
    expect(component.form.controls.index_name.value).toBe('S&P 500');
    expect(component.form.controls.growth_pct.value).toBeNull();
  });

  it('shows validation error for month > 12', async () => {
    component.form.controls.month.setValue(13);
    component.form.controls.month.markAsTouched();
    await component.onSubmit();
    expect(component.form.controls.month.invalid).toBe(true);
  });
});
