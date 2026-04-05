import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GrowthDataService } from '../../../../core/services/growth-data.service';
import { createMockGrowthDataService } from '../../../../core/testing/mock-supabase.service';
import { SelectYearComponent } from './select-year.component';

describe('SelectYearComponent', () => {
  let component: SelectYearComponent;
  let fixture: ComponentFixture<SelectYearComponent>;
  let mockGrowthDataService: ReturnType<typeof createMockGrowthDataService>;

  beforeEach(async () => {
    mockGrowthDataService = createMockGrowthDataService();
    mockGrowthDataService['getAvailableYears'].mockResolvedValue([2026, 2025, 2024]);

    await TestBed.configureTestingModule({
      imports: [SelectYearComponent],
      providers: [{ provide: GrowthDataService, useValue: mockGrowthDataService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectYearComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load all available years when no userId is provided', async () => {
    expect(mockGrowthDataService['getAvailableYears']).toHaveBeenCalled();
    expect(component.years()).toEqual([2026, 2025, 2024]);
  });

  it('should default currentValue to current year', () => {
    expect(component.currentValue()).toBe(new Date().getFullYear());
  });

  it('should default to selectedYear input when provided', async () => {
    fixture.componentRef.setInput('selectedYear', 2024);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.currentValue()).toBe(2024);
  });

  it('should fetch user-specific years when userId is set', async () => {
    mockGrowthDataService['getAvailableYearsForUser'].mockResolvedValue([2025, 2024]);
    fixture.componentRef.setInput('userId', 'user-uuid-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockGrowthDataService['getAvailableYearsForUser']).toHaveBeenCalledWith('user-uuid-1');
    expect(component.years()).toEqual([2025, 2024]);
  });

  it('should emit yearChange on selection', () => {
    const spy = vi.fn();
    component.yearChange.subscribe(spy);

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '2024';
    select.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith(2024);
    expect(component.currentValue()).toBe(2024);
  });

  it('should render a <select> element with correct options', () => {
    const options = fixture.nativeElement.querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[0].textContent.trim()).toBe('2026');
    expect(options[1].textContent.trim()).toBe('2025');
    expect(options[2].textContent.trim()).toBe('2024');
  });
});
