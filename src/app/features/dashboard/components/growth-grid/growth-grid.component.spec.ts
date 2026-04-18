import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardRow } from '../../dashboard-row.interface';
import { GrowthGridComponent } from './growth-grid.component';

const MOCK_ROWS: DashboardRow[] = [
  {
    profileId: 'p1',
    firstName: 'Alice',
    lastName: 'Smith',
    months: [1.5, null, 2.0, null, null, null, null, null, null, null, null, null],
  },
  {
    profileId: 'p2',
    firstName: 'Bob',
    lastName: 'Adams',
    months: [null, -0.5, null, 3.0, null, null, null, null, null, null, null, null],
  },
];

describe('GrowthGridComponent', () => {
  let fixture: ComponentFixture<GrowthGridComponent>;
  let component: GrowthGridComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrowthGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GrowthGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rows', MOCK_ROWS);
    fixture.componentRef.setInput('selectedYear', 2026);
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the grid title with the selected year', () => {
    const title = fixture.nativeElement.querySelector('.gt-grid-title') as HTMLElement;
    expect(title.textContent).toContain('2026');
  });

  it('renders all rows', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>;
    expect(rows.length).toBe(2);
  });

  it('renders month headers', () => {
    const headers = fixture.nativeElement.querySelectorAll(
      'th.col-month',
    ) as NodeListOf<HTMLElement>;
    expect(headers.length).toBe(12);
    expect(headers[0].textContent).toContain('Jan');
    expect(headers[11].textContent).toContain('Dec');
  });

  it('sorts rows by name ascending by default', () => {
    const cells = fixture.nativeElement.querySelectorAll(
      'tbody td.col-name',
    ) as NodeListOf<HTMLElement>;
    // Adams should come before Smith
    expect(cells[0].textContent).toContain('Adams');
    expect(cells[1].textContent).toContain('Smith');
  });

  it('toggles sort direction when clicking the same column', () => {
    component.sortBy('name');
    fixture.detectChanges();
    expect(component.sortDirection()).toBe('desc');
    const cells = fixture.nativeElement.querySelectorAll(
      'tbody td.col-name',
    ) as NodeListOf<HTMLElement>;
    expect(cells[0].textContent).toContain('Smith');
    expect(cells[1].textContent).toContain('Adams');
  });

  it('sorts by a different column', () => {
    // Sort by month-0 (Jan): Adams has null, Smith has 1.5 → nulls last → Smith first
    component.sortBy('month-0');
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll(
      'tbody td.col-name',
    ) as NodeListOf<HTMLElement>;
    expect(cells[0].textContent).toContain('Smith');
    expect(cells[1].textContent).toContain('Adams');
  });

  it('formats positive percentages without a plus sign', () => {
    expect(component.formatPct(1.5)).toBe('1.50%');
  });

  it('formats negative percentages without a plus sign', () => {
    expect(component.formatPct(-0.5)).toBe('-0.50%');
  });

  it('returns empty string for null percentage', () => {
    expect(component.formatPct(null)).toBe('');
  });

  it('returns trend data as comma-separated non-null values', () => {
    expect(component.trendData([1.5, null, 2.0])).toBe('1.5,2');
  });

  it('shows sort indicator on active column', () => {
    expect(component.sortIndicator('name')).toBe(' ▲');
    component.sortBy('name');
    expect(component.sortIndicator('name')).toBe(' ▼');
  });

  it('shows no sort indicator on inactive column', () => {
    expect(component.sortIndicator('month-0')).toBe('');
  });
});
