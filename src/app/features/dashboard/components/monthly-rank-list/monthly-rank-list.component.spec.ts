import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthlyRankListComponent, MonthlyRankRow } from './monthly-rank-list.component';

const MOCK_ROWS: MonthlyRankRow[] = [
  { rank: 1, playerName: 'Adams, Bob', trendData: '1.2,2.4,3.1', growthPct: 3.1 },
  { rank: 2, playerName: 'Smith, Alice', trendData: '-0.6,0.5,2.4', growthPct: 2.4 },
];

describe('MonthlyRankListComponent', () => {
  let fixture: ComponentFixture<MonthlyRankListComponent>;
  let component: MonthlyRankListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyRankListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MonthlyRankListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedYear', 2026);
    fixture.componentRef.setInput('selectedMonth', 3);
    fixture.componentRef.setInput('rows', MOCK_ROWS);
    fixture.componentRef.setInput('playerAveragePct', 2.75);
    fixture.componentRef.setInput('dowGrowthPct', 1.5);
    fixture.componentRef.setInput('sp500GrowthPct', 2.1);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders heading with selected month and year', () => {
    const heading = fixture.nativeElement.querySelector('.gt-rank-title') as HTMLElement;
    expect(heading.textContent).toContain('March 2026 Rankings');
  });

  it('renders list rows instead of a table', () => {
    const table = fixture.nativeElement.querySelector('table') as HTMLElement | null;
    const items = fixture.nativeElement.querySelectorAll(
      '.gt-rank-item',
    ) as NodeListOf<HTMLElement>;

    expect(table).toBeNull();
    expect(items.length).toBe(2);
  });

  it('formats positive percentage with + sign', () => {
    expect(component.formatPct(3.1)).toBe('+3.10%');
  });

  it('renders summary metrics at the end of the list', () => {
    const summary = fixture.nativeElement.querySelector('.gt-rank-summary') as HTMLElement;
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain('Player Avg');
    expect(summary.textContent).toContain('+2.75%');
    expect(summary.textContent).toContain('Dow');
    expect(summary.textContent).toContain('+1.50%');
    expect(summary.textContent).toContain('S&P 500');
    expect(summary.textContent).toContain('+2.10%');
  });
});
