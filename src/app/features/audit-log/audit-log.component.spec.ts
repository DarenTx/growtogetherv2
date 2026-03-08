import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditLog } from '../../core/models/audit-log.interface';
import { AuditService } from '../../core/services/audit.service';
import { createMockAuditService } from '../../core/testing/mock-supabase.service';
import { AuditLogComponent } from './audit-log.component';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'test-id',
    table_name: 'profiles',
    record_id: 'rec-1',
    action: 'INSERT',
    performed_by: 'user-1',
    performer_first_name: 'Jane',
    performer_last_name: 'Doe',
    old_data: null,
    new_data: null,
    created_at: '2026-01-05T15:42:00Z',
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuditLogComponent', () => {
  let fixture: ComponentFixture<AuditLogComponent>;
  let component: AuditLogComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockService: Record<string, any>;

  beforeEach(async () => {
    mockService = createMockAuditService();

    await TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [
        { provide: AuditService, useValue: mockService },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogComponent);
    component = fixture.componentInstance;
  });

  it('creates the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ─── buildDescription() ─────────────────────────────────────────────────────

  describe('buildDescription()', () => {
    // profiles
    it('profiles INSERT', () => {
      const log = makeLog({
        table_name: 'profiles',
        action: 'INSERT',
        new_data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
      });
      expect(component.buildDescription(log)).toBe(
        'Added a new profile for Jane Doe (jane@example.com).',
      );
    });

    it('profiles UPDATE', () => {
      const log = makeLog({
        table_name: 'profiles',
        action: 'UPDATE',
        new_data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
      });
      expect(component.buildDescription(log)).toBe(
        'Updated the profile for Jane Doe (jane@example.com).',
      );
    });

    it('profiles DELETE', () => {
      const log = makeLog({
        table_name: 'profiles',
        action: 'DELETE',
        old_data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
      });
      expect(component.buildDescription(log)).toBe(
        'Deleted the profile for Jane Doe (jane@example.com).',
      );
    });

    // growth_data
    it('growth_data INSERT', () => {
      const log = makeLog({
        table_name: 'growth_data',
        action: 'INSERT',
        new_data: { email_key: 'jane@example.com', year: 2025, month: 3, growth_pct: 5.34 },
      });
      expect(component.buildDescription(log)).toBe(
        'Added growth data for jane@example.com — March 2025: 5.34%.',
      );
    });

    it('growth_data UPDATE', () => {
      const log = makeLog({
        table_name: 'growth_data',
        action: 'UPDATE',
        old_data: { growth_pct: 2.0 },
        new_data: { email_key: 'jane@example.com', year: 2025, month: 3, growth_pct: 5.34 },
      });
      expect(component.buildDescription(log)).toBe(
        'Updated growth data for jane@example.com — March 2025: 2.00% → 5.34%.',
      );
    });

    it('growth_data DELETE', () => {
      const log = makeLog({
        table_name: 'growth_data',
        action: 'DELETE',
        old_data: { email_key: 'jane@example.com', year: 2025, month: 3, growth_pct: 5.34 },
      });
      expect(component.buildDescription(log)).toBe(
        'Deleted growth data for jane@example.com — March 2025: 5.34%.',
      );
    });

    // market_indexes
    it('market_indexes INSERT', () => {
      const log = makeLog({
        table_name: 'market_indexes',
        action: 'INSERT',
        new_data: { index_name: 'S&P 500', year: 2025, month: 1, growth_pct: 2.1 },
      });
      expect(component.buildDescription(log)).toBe(
        'Added market index S&P 500 — January 2025: 2.10%.',
      );
    });

    it('market_indexes UPDATE', () => {
      const log = makeLog({
        table_name: 'market_indexes',
        action: 'UPDATE',
        old_data: { growth_pct: 1.0 },
        new_data: { index_name: 'S&P 500', year: 2025, month: 1, growth_pct: 2.1 },
      });
      expect(component.buildDescription(log)).toBe(
        'Updated market index S&P 500 — January 2025: 1.00% → 2.10%.',
      );
    });

    it('market_indexes DELETE', () => {
      const log = makeLog({
        table_name: 'market_indexes',
        action: 'DELETE',
        old_data: { index_name: 'S&P 500', year: 2025, month: 1, growth_pct: 2.1 },
      });
      expect(component.buildDescription(log)).toBe(
        'Deleted market index S&P 500 — January 2025: 2.10%.',
      );
    });

    // Month boundary tests
    it('resolves month 1 to January', () => {
      const log = makeLog({
        table_name: 'growth_data',
        action: 'INSERT',
        new_data: { email_key: 'a@b.com', year: 2025, month: 1, growth_pct: 1.0 },
      });
      expect(component.buildDescription(log)).toContain('January');
    });

    it('resolves month 12 to December', () => {
      const log = makeLog({
        table_name: 'growth_data',
        action: 'INSERT',
        new_data: { email_key: 'a@b.com', year: 2025, month: 12, growth_pct: 1.0 },
      });
      expect(component.buildDescription(log)).toContain('December');
    });

    // Fallback cases
    it('unknown table falls back to action on table_name', () => {
      const log = makeLog({ table_name: 'unknown_table', action: 'UPDATE' });
      expect(component.buildDescription(log)).toBe('UPDATE on unknown_table.');
    });

    it('missing JSONB fields falls back gracefully', () => {
      const log = makeLog({ table_name: 'profiles', action: 'INSERT', new_data: null });
      expect(component.buildDescription(log)).toBe('INSERT on profiles.');
    });
  });

  // ─── resolvePerformerName() ──────────────────────────────────────────────────

  describe('resolvePerformerName()', () => {
    it('returns full name when both names present', () => {
      expect(
        component.resolvePerformerName(
          makeLog({ performer_first_name: 'Jane', performer_last_name: 'Doe' }),
        ),
      ).toBe('Jane Doe');
    });

    it('returns first name only when last name is null', () => {
      expect(
        component.resolvePerformerName(
          makeLog({ performer_first_name: 'Jane', performer_last_name: null }),
        ),
      ).toBe('Jane');
    });

    it('returns System when both names are null', () => {
      expect(
        component.resolvePerformerName(
          makeLog({ performer_first_name: null, performer_last_name: null }),
        ),
      ).toBe('System');
    });

    it('returns System when performed_by is null and both names are null', () => {
      expect(
        component.resolvePerformerName(
          makeLog({ performed_by: null, performer_first_name: null, performer_last_name: null }),
        ),
      ).toBe('System');
    });
  });

  // ─── formatDateTime() ────────────────────────────────────────────────────────

  describe('formatDateTime()', () => {
    it('returns a string containing the year 2026 for a valid ISO date', () => {
      const result = component.formatDateTime('2026-01-05T15:42:00Z');
      expect(result).toContain('2026');
    });

    it('does not throw and returns a non-empty string for midnight UTC', () => {
      const result = component.formatDateTime('2026-01-01T00:00:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  // ─── Pagination computed signals ─────────────────────────────────────────────

  describe('Pagination computed signals', () => {
    it('totalPages rounds up — 101 rows / 100 page size = 2 pages', () => {
      component.totalCount.set(101);
      expect(component.totalPages()).toBe(2);
    });

    it('totalPages exact — 100 rows / 100 page size = 1 page', () => {
      component.totalCount.set(100);
      expect(component.totalPages()).toBe(1);
    });

    it('isFirstPage is true on page 0', () => {
      component.currentPage.set(0);
      expect(component.isFirstPage()).toBe(true);
    });

    it('isFirstPage is false on page 1', () => {
      component.currentPage.set(1);
      expect(component.isFirstPage()).toBe(false);
    });

    it('isLastPage is true on the last page', () => {
      component.totalCount.set(101);
      component.currentPage.set(1);
      expect(component.isLastPage()).toBe(true);
    });

    it('isLastPage is false before the last page', () => {
      component.totalCount.set(101);
      component.currentPage.set(0);
      expect(component.isLastPage()).toBe(false);
    });
  });

  // ─── goToPage() behaviour ────────────────────────────────────────────────────

  describe('goToPage()', () => {
    it('sets loading to true at the start of each call', async () => {
      let resolveCall!: (v: { rows: AuditLog[]; total: number }) => void;
      mockService['getAuditLogPage'] = vi
        .fn()
        .mockReturnValue(new Promise((res) => (resolveCall = res)));

      fixture.detectChanges();
      const pageCall = component.goToPage(0);
      expect(component.loading()).toBe(true);
      resolveCall({ rows: [], total: 0 });
      await pageCall;
    });

    it('sets loading to false on success', async () => {
      mockService['getAuditLogPage'] = vi.fn().mockResolvedValue({ rows: [], total: 0 });
      await component.goToPage(0);
      expect(component.loading()).toBe(false);
    });

    it('sets loading to false and populates errorMessage on error', async () => {
      mockService['getAuditLogPage'] = vi.fn().mockRejectedValue(new Error('fetch failed'));
      await component.goToPage(0);
      expect(component.loading()).toBe(false);
      expect(component.errorMessage()).toBe('fetch failed');
    });

    it('updates rows, totalCount, and currentPage on success', async () => {
      const rows = [makeLog()];
      mockService['getAuditLogPage'] = vi.fn().mockResolvedValue({ rows, total: 1 });
      await component.goToPage(0);
      expect(component.rows()).toEqual(rows);
      expect(component.totalCount()).toBe(1);
      expect(component.currentPage()).toBe(0);
    });

    it('does not update currentPage on error', async () => {
      // Start on page 1
      component.currentPage.set(1);
      mockService['getAuditLogPage'] = vi.fn().mockRejectedValue(new Error('fail'));
      await component.goToPage(2);
      expect(component.currentPage()).toBe(1);
    });
  });

  // ─── Template rendering ───────────────────────────────────────────────────────

  describe('Template rendering', () => {
    it('shows loading paragraph when loading() is true', async () => {
      // Block the fetch so loading stays true
      let resolve!: (v: { rows: AuditLog[]; total: number }) => void;
      mockService['getAuditLogPage'] = vi
        .fn()
        .mockReturnValue(new Promise((res) => (resolve = res)));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.gt-loading')).not.toBeNull();
      resolve({ rows: [], total: 0 });
      await fixture.whenStable();
    });

    it('shows error paragraph when errorMessage() is set', async () => {
      mockService['getAuditLogPage'] = vi.fn().mockRejectedValue(new Error('oops'));
      fixture.detectChanges();
      await new Promise<void>((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.gt-error-page')).not.toBeNull();
    });

    it('shows empty-state message when rows is empty and not loading', async () => {
      mockService['getAuditLogPage'] = vi.fn().mockResolvedValue({ rows: [], total: 0 });
      fixture.detectChanges();
      await new Promise<void>((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('No activity log entries found.');
    });

    it('renders correct number of <tr> rows matching rows().length', async () => {
      const rows = [makeLog({ id: '1' }), makeLog({ id: '2' }), makeLog({ id: '3' })];
      mockService['getAuditLogPage'] = vi.fn().mockResolvedValue({ rows, total: 3 });
      fixture.detectChanges();
      await new Promise<void>((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const trs = el.querySelectorAll('tbody tr');
      expect(trs.length).toBe(3);
    });
  });
});
