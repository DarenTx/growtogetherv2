import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuthService } from '../../../../core/services/auth.service';
import { GrowthData } from '../../../../core/models/growth-data.interface';
import { MarketIndex } from '../../../../core/models/market-index.interface';
import { Profile } from '../../../../core/models/profile.interface';
import { GrowthDataService } from '../../../../core/services/growth-data.service';
import { MarketDataService } from '../../../../core/services/market-data.service';
import { ProfileService } from '../../../../core/services/profile.service';
import {
  MOCK_SESSION,
  createMockAuthService,
  createMockGrowthDataService,
  createMockMarketDataService,
  createMockProfileService,
} from '../../../../core/testing/mock-supabase.service';
import { ClassicScorecardComponent } from './classic-scorecard.component';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGrowthRecord(overrides: Partial<GrowthData> = {}): GrowthData {
  return {
    id: 'gd-1',
    email_key: 'user@example.com',
    bank_name: 'Fidelity Investments',
    year: 2026,
    month: 3,
    growth_pct: 2.38,
    user_id: MOCK_SESSION.user.id,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeMarketIndex(overrides: Partial<MarketIndex> = {}): MarketIndex {
  return {
    id: 'mi-1',
    index_name: 'Dow Jones',
    year: 2026,
    month: 3,
    growth_pct: 1.5,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: MOCK_SESSION.user.id,
    first_name: 'John',
    last_name: 'Doe',
    email: MOCK_SESSION.user.email,
    phone: null,
    is_admin: false,
    email_verified: true,
    phone_verified: false,
    registration_complete: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ─── Test Setup ────────────────────────────────────────────────────────────────

describe('ClassicScorecardComponent', () => {
  let fixture: ComponentFixture<ClassicScorecardComponent>;
  let component: ClassicScorecardComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuth: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGrowthData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMarketData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProfile: Record<string, any>;

  async function setupComponent(
    year = 2025,
    month = 6,
    uuid = MOCK_SESSION.user.id,
  ): Promise<void> {
    fixture = TestBed.createComponent(ClassicScorecardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('year', year);
    fixture.componentRef.setInput('month', month);
    fixture.componentRef.setInput('uuid', uuid);
    fixture.detectChanges();
    await flushPromises();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockAuth = createMockAuthService();
    mockGrowthData = createMockGrowthDataService();
    mockMarketData = createMockMarketDataService();
    mockProfile = createMockProfileService();

    await TestBed.configureTestingModule({
      imports: [ClassicScorecardComponent],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: GrowthDataService, useValue: mockGrowthData },
        { provide: MarketDataService, useValue: mockMarketData },
        { provide: ProfileService, useValue: mockProfile },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Basic creation ──────────────────────────────────────────────────────────

  it('creates the component', async () => {
    await setupComponent();
    expect(component).toBeTruthy();
  });

  // ── Loading state ───────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('starts in loading state', async () => {
      // Block getGrowthDataForUserYear so it stays in loading state
      let resolve!: (v: GrowthData[]) => void;
      mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockReturnValue(
        new Promise<GrowthData[]>((r) => {
          resolve = r;
        }),
      );

      fixture = TestBed.createComponent(ClassicScorecardComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('year', 2025);
      fixture.componentRef.setInput('month', 6);
      fixture.componentRef.setInput('uuid', MOCK_SESSION.user.id);
      fixture.detectChanges();

      expect(component.isLoading()).toBe(true);
      expect(component.state()).toBe('loading');

      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent?.toLowerCase()).toContain('loading');

      resolve([]);
    });
  });

  // ── Historical state ────────────────────────────────────────────────────────

  describe('historical state (past month)', () => {
    beforeEach(async () => {
      mockGrowthData['getGrowthDataForUserYear'] = vi
        .fn()
        .mockResolvedValue([makeGrowthRecord({ month: 6, growth_pct: 2.38 })]);
      mockMarketData['getMarketIndexesForMonth'] = vi
        .fn()
        .mockResolvedValue([
          makeMarketIndex({ index_name: 'Dow Jones', growth_pct: 1.5 }),
          makeMarketIndex({ id: 'mi-2', index_name: 'S&P 500', growth_pct: 2.1 }),
        ]);
      mockProfile['getRegisteredProfiles'] = vi.fn().mockResolvedValue([makeProfile()]);
      mockGrowthData['getGrowthDataForYearMonth'] = vi
        .fn()
        .mockResolvedValue([makeGrowthRecord({ month: 6, growth_pct: 2.38 })]);

      // Use a clearly historical month (past)
      await setupComponent(2025, 6);
    });

    it('renders historical state', () => {
      expect(component.state()).toBe('historical');
    });

    it('shows card title', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('2025 - Thru June');
    });

    it('displays growth percentage', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('+2.38%');
    });

    it('shows Dow vs label', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('vs Dow');
    });

    it('shows S&P 500 vs label', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('vs S&P 500');
    });

    it('shows rank', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Rank:');
    });

    it('does NOT show waiting message in historical state', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).not.toContain('Waiting on');
    });

    it('does NOT show partial label in historical state', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).not.toContain('(partial)');
    });
  });

  // ── Current-data state ──────────────────────────────────────────────────────

  describe('current-data state (current month, data exists)', () => {
    const CURRENT_YEAR = new Date().getFullYear();
    const CURRENT_MONTH = new Date().getMonth() + 1;

    beforeEach(async () => {
      // Only run this block when we're currently within the entry window (day <= 20)
      const today = new Date().getDate();
      if (today >= 21) return;

      const ownRecord = makeGrowthRecord({
        year: CURRENT_YEAR,
        month: CURRENT_MONTH,
        growth_pct: 3.5,
      });
      const other = makeGrowthRecord({
        id: 'gd-2',
        user_id: 'other-uuid',
        year: CURRENT_YEAR,
        month: CURRENT_MONTH,
        growth_pct: 1.0,
      });
      mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue([ownRecord]);
      mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue([ownRecord, other]);
      mockProfile['getRegisteredProfiles'] = vi
        .fn()
        .mockResolvedValue([
          makeProfile(),
          makeProfile({ id: 'other-uuid', first_name: 'Jane', last_name: 'Smith' }),
          makeProfile({ id: 'third-uuid', first_name: 'Bob', last_name: 'Jones' }),
        ]);
      mockMarketData['getMarketIndexesForMonth'] = vi.fn().mockResolvedValue([]);

      await setupComponent(CURRENT_YEAR, CURRENT_MONTH);
    });

    it('renders current-data state when within entry window and data exists', () => {
      const today = new Date().getDate();
      if (today >= 21) {
        // Can't test this state when past cutoff
        expect(component.state()).toBe('historical');
        return;
      }
      expect(component.state()).toBe('current-data');
    });

    it('shows partial label in current-data state', () => {
      const today = new Date().getDate();
      if (today >= 21) return;
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('(partial)');
    });

    it('shows cutoff date label', () => {
      const today = new Date().getDate();
      if (today >= 21) return;
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Final Data Available on the 21st');
    });

    it('shows waiting on X of Y players', () => {
      const today = new Date().getDate();
      if (today >= 21) return;
      const el = fixture.nativeElement as HTMLElement;
      // 3 registered, 2 submitted → waiting on 1
      expect(el.textContent).toContain('Waiting on 1 of 3 players');
    });
  });

  // ── Current-entry state ─────────────────────────────────────────────────────

  describe('current-entry state (current month, no data, own card)', () => {
    const CURRENT_YEAR = new Date().getFullYear();
    const CURRENT_MONTH = new Date().getMonth() + 1;

    beforeEach(async () => {
      const today = new Date().getDate();
      if (today >= 21) return;

      mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue([]);
      mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue([]);
      mockProfile['getRegisteredProfiles'] = vi.fn().mockResolvedValue([makeProfile()]);
      mockMarketData['getMarketIndexesForMonth'] = vi.fn().mockResolvedValue([]);

      await setupComponent(CURRENT_YEAR, CURRENT_MONTH);
    });

    it('renders current-entry state when no data in entry window', () => {
      const today = new Date().getDate();
      if (today >= 21) {
        expect(component.state()).toBe('historical');
        return;
      }
      expect(component.state()).toBe('current-entry');
    });

    it('shows entry form with input and bank dropdown', () => {
      const today = new Date().getDate();
      if (today >= 21) return;
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('input')).toBeTruthy();
      expect(el.querySelector('select')).toBeTruthy();
    });

    it('shows Save button', () => {
      const today = new Date().getDate();
      if (today >= 21) return;
      const el = fixture.nativeElement as HTMLElement;
      const btn = el.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn?.textContent?.trim()).toBe('Save');
    });

    it('shows "Enter Growth / Loss" label', () => {
      const today = new Date().getDate();
      if (today >= 21) return;
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Enter Growth / Loss');
    });
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error banner when data load fails', async () => {
      mockGrowthData['getGrowthDataForUserYear'] = vi
        .fn()
        .mockRejectedValue(new Error('DB timeout'));

      await setupComponent(2025, 1);

      const el = fixture.nativeElement as HTMLElement;
      expect(component.state()).toBe('error');
      expect(el.textContent).toContain('DB timeout');
    });

    it('shows not authenticated error when no session', async () => {
      mockAuth['getSession'] = vi.fn().mockResolvedValue(null);

      await setupComponent(2025, 1);

      expect(component.state()).toBe('error');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Not authenticated');
    });
  });

  // ── Computed signals ────────────────────────────────────────────────────────

  describe('computed signals', () => {
    describe.skip('isPastCutoff (not yet implemented)', () => {
      it('returns true for clearly historical month', async () => {
        await setupComponent(2025, 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).isPastCutoff()).toBe(true);
      });

      it('returns true for future year', async () => {
        await setupComponent(2030, 6);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).isPastCutoff()).toBe(true);
      });
    });

    describe('cardTitle', () => {
      it('formats title correctly for March 2026', async () => {
        await setupComponent(2026, 3);
        expect(component.cardTitle()).toBe('2026 - Thru March');
      });

      it('formats title correctly for January 2025', async () => {
        await setupComponent(2025, 1);
        expect(component.cardTitle()).toBe('2025 - Thru January');
      });
    });

    describe('userGrowthRecord', () => {
      it('returns null when no data', async () => {
        await setupComponent(2025, 6);
        expect(component.userGrowthRecord()).toBeNull();
      });

      it('returns matching record for the target month', async () => {
        const record = makeGrowthRecord({ month: 6, growth_pct: 2.38 });
        mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue([record]);
        await setupComponent(2025, 6);
        expect(component.userGrowthRecord()?.growth_pct).toBe(2.38);
      });

      it('returns first record by bank_name ASC when multiple banks', async () => {
        const edward = makeGrowthRecord({ bank_name: 'Edward Jones', growth_pct: 1.0, month: 6 });
        const fidelity = makeGrowthRecord({
          bank_name: 'Fidelity Investments',
          growth_pct: 2.0,
          month: 6,
        });
        mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue([fidelity, edward]);
        await setupComponent(2025, 6);
        // Edward Jones < Fidelity Investments alphabetically
        expect(component.userGrowthRecord()?.bank_name).toBe('Edward Jones');
      });
    });

    describe('ytdDataString', () => {
      it('returns empty string when no data', async () => {
        await setupComponent(2025, 6);
        expect(component.ytdDataString()).toBe('');
      });

      it('builds comma-separated string for months up to target', async () => {
        const records = [
          makeGrowthRecord({ month: 1, growth_pct: 1.0 }),
          makeGrowthRecord({ month: 2, growth_pct: 2.0 }),
          makeGrowthRecord({ month: 3, growth_pct: 3.0 }),
        ];
        mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue(records);
        await setupComponent(2025, 3);
        expect(component.ytdDataString()).toBe('1,2,3');
      });

      it('excludes months after target month', async () => {
        const records = [
          makeGrowthRecord({ month: 1, growth_pct: 1.0 }),
          makeGrowthRecord({ month: 4, growth_pct: 4.0 }),
          makeGrowthRecord({ month: 5, growth_pct: 5.0 }),
        ];
        mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue(records);
        await setupComponent(2025, 3);
        expect(component.ytdDataString()).toBe('1');
      });

      it('skips months with no submission instead of substituting 0', async () => {
        const records = [
          makeGrowthRecord({ month: 1, growth_pct: 1.0 }),
          makeGrowthRecord({ month: 3, growth_pct: 3.0 }),
          // month 2 missing
        ];
        mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockResolvedValue(records);
        await setupComponent(2025, 3);
        expect(component.ytdDataString()).toBe('1,3');
      });
    });

    describe('perUserMonthData', () => {
      it('returns empty map when no data', async () => {
        await setupComponent(2025, 6);
        expect(component.perUserMonthData().size).toBe(0);
      });

      it('de-duplicates by user_id taking first by bank_name', async () => {
        const rows = [
          makeGrowthRecord({ user_id: 'u1', bank_name: 'Edward Jones', growth_pct: 1.0 }),
          makeGrowthRecord({ user_id: 'u1', bank_name: 'Fidelity Investments', growth_pct: 2.0 }),
          makeGrowthRecord({ user_id: 'u2', bank_name: 'Fidelity Investments', growth_pct: 3.0 }),
        ];
        mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue(rows);
        await setupComponent(2025, 6);
        const map = component.perUserMonthData();
        expect(map.size).toBe(2);
        // Edward Jones < Fidelity, so u1 gets 1.0
        expect(map.get('u1')).toBe(1.0);
        expect(map.get('u2')).toBe(3.0);
      });

      it('filters out rows with null user_id', async () => {
        const rows = [
          makeGrowthRecord({ user_id: null }),
          makeGrowthRecord({ user_id: 'u1', growth_pct: 2.0 }),
        ];
        mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue(rows);
        await setupComponent(2025, 6);
        const map = component.perUserMonthData();
        expect(map.size).toBe(1);
        expect(map.has('u1')).toBe(true);
      });
    });

    describe('playerAvg', () => {
      it('returns null when no data', async () => {
        await setupComponent(2025, 6);
        expect(component.playerAvg()).toBeNull();
      });

      it('calculates mean correctly', async () => {
        const rows = [
          makeGrowthRecord({ user_id: 'u1', growth_pct: 2.0 }),
          makeGrowthRecord({ user_id: 'u2', growth_pct: 4.0 }),
        ];
        mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue(rows);
        await setupComponent(2025, 6);
        expect(component.playerAvg()).toBe(3.0);
      });
    });

    describe('userRank', () => {
      it('returns null when user has no data', async () => {
        await setupComponent(2025, 6);
        expect(component.userRank()).toBeNull();
      });

      it('returns 1 for highest growth', async () => {
        const rows = [
          makeGrowthRecord({ user_id: MOCK_SESSION.user.id, growth_pct: 5.0 }),
          makeGrowthRecord({ user_id: 'u2', growth_pct: 3.0 }),
          makeGrowthRecord({ user_id: 'u3', growth_pct: 1.0 }),
        ];
        mockGrowthData['getGrowthDataForUserYear'] = vi
          .fn()
          .mockResolvedValue([makeGrowthRecord({ growth_pct: 5.0, month: 6 })]);
        mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue(rows);
        await setupComponent(2025, 6);
        expect(component.userRank()).toBe(1);
      });

      it('returns correct rank for middle position', async () => {
        const rows = [
          makeGrowthRecord({ user_id: 'u1', growth_pct: 5.0 }),
          makeGrowthRecord({ user_id: MOCK_SESSION.user.id, growth_pct: 3.0 }),
          makeGrowthRecord({ user_id: 'u3', growth_pct: 1.0 }),
        ];
        mockGrowthData['getGrowthDataForUserYear'] = vi
          .fn()
          .mockResolvedValue([makeGrowthRecord({ growth_pct: 3.0, month: 6 })]);
        mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue(rows);
        await setupComponent(2025, 6);
        expect(component.userRank()).toBe(2);
      });
    });

    describe.skip('waitingCount (not yet implemented)', () => {
      it('clamps to 0 when data count exceeds profile count', async () => {
        const profiles = [makeProfile()];
        const rows = Array.from({ length: 3 }, (_, i) =>
          makeGrowthRecord({ user_id: `u${i}`, growth_pct: i + 1.0 }),
        );
        mockProfile['getRegisteredProfiles'] = vi.fn().mockResolvedValue(profiles);
        mockGrowthData['getGrowthDataForYearMonth'] = vi.fn().mockResolvedValue(rows);
        await setupComponent(2025, 6);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((component as any).waitingCount()).toBe(0);
      });
    });

    describe('dowGrowthPct and sp500GrowthPct', () => {
      it('extracts Dow Jones growth pct', async () => {
        mockMarketData['getMarketIndexesForMonth'] = vi
          .fn()
          .mockResolvedValue([
            makeMarketIndex({ index_name: 'Dow Jones Industrial Average', growth_pct: 1.23 }),
          ]);
        await setupComponent(2025, 6);
        expect(component.dowGrowthPct()).toBe(1.23);
      });

      it('extracts S&P 500 growth pct', async () => {
        mockMarketData['getMarketIndexesForMonth'] = vi
          .fn()
          .mockResolvedValue([makeMarketIndex({ index_name: 'S&P 500', growth_pct: 2.45 })]);
        await setupComponent(2025, 6);
        expect(component.sp500GrowthPct()).toBe(2.45);
      });

      it('returns null when market index not found', async () => {
        mockMarketData['getMarketIndexesForMonth'] = vi.fn().mockResolvedValue([]);
        await setupComponent(2025, 6);
        expect(component.dowGrowthPct()).toBeNull();
        expect(component.sp500GrowthPct()).toBeNull();
      });
    });

    describe('formattedGrowthPct', () => {
      it('returns — when null', async () => {
        await setupComponent(2025, 6);
        expect(component.formattedGrowthPct()).toBe('—');
      });

      it('formats positive value with + prefix and two decimals', async () => {
        mockGrowthData['getGrowthDataForUserYear'] = vi
          .fn()
          .mockResolvedValue([makeGrowthRecord({ month: 6, growth_pct: 3.75 })]);
        await setupComponent(2025, 6);
        expect(component.formattedGrowthPct()).toBe('+3.75%');
      });

      it('formats negative value with − prefix', async () => {
        mockGrowthData['getGrowthDataForUserYear'] = vi
          .fn()
          .mockResolvedValue([makeGrowthRecord({ month: 6, growth_pct: -1.5 })]);
        await setupComponent(2025, 6);
        expect(component.formattedGrowthPct()).toBe('-1.50%');
      });
    });

    describe('viewedUserProfile', () => {
      it('finds the profile matching the uuid', async () => {
        mockProfile['getRegisteredProfiles'] = vi
          .fn()
          .mockResolvedValue([makeProfile({ first_name: 'Alice' })]);
        await setupComponent(2025, 6);
        expect(component.viewedUserProfile()?.first_name).toBe('Alice');
      });

      it('returns null when uuid not in profiles', async () => {
        mockProfile['getRegisteredProfiles'] = vi
          .fn()
          .mockResolvedValue([makeProfile({ id: 'other-uuid' })]);
        await setupComponent(2025, 6);
        expect(component.viewedUserProfile()).toBeNull();
      });
    });

    describe('cardAriaLabel', () => {
      it('returns Scorecard when profile not found', async () => {
        await setupComponent(2025, 6);
        expect(component.cardAriaLabel()).toBe('Scorecard');
      });

      it('includes name and month/year when profile found', async () => {
        mockProfile['getRegisteredProfiles'] = vi
          .fn()
          .mockResolvedValue([makeProfile({ first_name: 'Jane', last_name: 'Smith' })]);
        await setupComponent(2025, 6);
        expect(component.cardAriaLabel()).toContain('Jane Smith');
        expect(component.cardAriaLabel()).toContain('2025');
      });
    });
  });

  // ── onSave ──────────────────────────────────────────────────────────────────

  describe.skip('onSave (not yet implemented)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (): any => component;

    it('shows validation error for non-numeric input', async () => {
      await setupComponent(2025, 6);
      c().growthPctControl.setValue('abc');
      await c().onSave();
      expect(c().saveError()).toBe('Please enter a valid number.');
    });

    it('calls saveGrowthData with correct payload for numeric input', async () => {
      await setupComponent(2025, 6);
      c().growthPctControl.setValue('3.75');
      await c().onSave();
      expect(mockGrowthData['saveGrowthData']).toHaveBeenCalledWith(
        expect.objectContaining({
          email_key: MOCK_SESSION.user.email.toLowerCase(),
          bank_name: 'Fidelity Investments',
          year: 2025,
          month: 6,
          growth_pct: 3.75,
          user_id: MOCK_SESSION.user.id,
        }),
      );
      expect(c().saveSuccess()).toBe('Growth saved.');
    });

    it('calls deleteOwnGrowthDataForMonth when input is empty', async () => {
      await setupComponent(2025, 6);
      c().growthPctControl.setValue('');
      await c().onSave();
      expect(mockGrowthData['deleteOwnGrowthDataForMonth']).toHaveBeenCalledWith(
        2025,
        6,
        'Fidelity Investments',
      );
      expect(c().saveSuccess()).toBe('Growth cleared.');
    });

    it('shows error banner when save fails', async () => {
      mockGrowthData['saveGrowthData'] = vi.fn().mockRejectedValue(new Error('Save failed'));
      await setupComponent(2025, 6);
      c().growthPctControl.setValue('2.5');
      await c().onSave();
      expect(c().saveError()).toBe('Save failed');
    });

    it('shows not-authenticated error when no session during save', async () => {
      mockAuth['getSession'] = vi
        .fn()
        .mockResolvedValueOnce(MOCK_SESSION) // first call in loadData
        .mockResolvedValueOnce(null); // second call in onSave
      await setupComponent(2025, 6);
      c().growthPctControl.setValue('2.5');
      await c().onSave();
      expect(c().saveError()).toBe('Not authenticated');
    });

    it('clears saveSuccess and saveError when growthPct changes', async () => {
      await setupComponent(2025, 6);
      c().saveSuccess.set('Previous success');
      c().saveError.set('Previous error');
      c().growthPctControl.setValue('1.0');
      expect(c().saveSuccess()).toBe('');
      expect(c().saveError()).toBe('');
    });

    it('clears saveSuccess and saveError when bank changes', async () => {
      await setupComponent(2025, 6);
      c().saveSuccess.set('Previous success');
      c().saveError.set('Previous error');
      c().bankControl.setValue('Edward Jones');
      expect(c().saveSuccess()).toBe('');
      expect(c().saveError()).toBe('');
    });
  });

  // ── _loadInProgress guard ───────────────────────────────────────────────────

  describe('_loadInProgress guard', () => {
    it('prevents duplicate concurrent loads', async () => {
      let resolveLoad!: (v: GrowthData[]) => void;
      mockGrowthData['getGrowthDataForUserYear'] = vi.fn().mockReturnValue(
        new Promise<GrowthData[]>((r) => {
          resolveLoad = r;
        }),
      );

      fixture = TestBed.createComponent(ClassicScorecardComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('year', 2025);
      fixture.componentRef.setInput('month', 6);
      fixture.componentRef.setInput('uuid', MOCK_SESSION.user.id);
      fixture.detectChanges();
      await flushPromises();

      // Call loadData a second time while first is still in flight
      component.loadData();

      // getGrowthDataForUserYear should still only have been called once
      expect(mockGrowthData['getGrowthDataForUserYear']).toHaveBeenCalledTimes(1);

      resolveLoad([]);
    });
  });

  // ── Month navigation ────────────────────────────────────────────────────────

  describe('month navigation', () => {
    describe('displayYear / displayMonth', () => {
      it('equals the input year/month at offset 0', async () => {
        await setupComponent(2025, 6);
        expect(component.displayYear()).toBe(2025);
        expect(component.displayMonth()).toBe(6);
      });

      it('goes back one month correctly within a year', async () => {
        await setupComponent(2025, 6);
        component.goToPrevMonth();
        expect(component.displayYear()).toBe(2025);
        expect(component.displayMonth()).toBe(5);
      });

      it('wraps year boundary correctly when going back from January', async () => {
        await setupComponent(2025, 1);
        component.goToPrevMonth();
        expect(component.displayYear()).toBe(2024);
        expect(component.displayMonth()).toBe(12);
      });

      it('goes forward one month correctly within a year', async () => {
        await setupComponent(2025, 3);
        // Make sure canGoNext is true by starting on a clearly past month
        component.offsetMonths.set(0);
        component.goToNextMonth();
        expect(component.displayMonth()).toBe(4);
      });

      it('wraps year boundary correctly when going forward from December', async () => {
        await setupComponent(2024, 12);
        component.goToNextMonth();
        expect(component.displayYear()).toBe(2025);
        expect(component.displayMonth()).toBe(1);
      });
    });

    describe('canGoNext', () => {
      it('returns false when already at the previous calendar month', async () => {
        const now = new Date();
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        await setupComponent(prevYear, prevMonth);
        expect(component.canGoNext()).toBe(false);
      });

      it('returns true for a clearly historical month', async () => {
        await setupComponent(2020, 6);
        expect(component.canGoNext()).toBe(true);
      });

      it('goToNextMonth does nothing when canGoNext is false', async () => {
        const now = new Date();
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        await setupComponent(prevYear, prevMonth);
        component.goToNextMonth();
        expect(component.displayMonth()).toBe(prevMonth);
        expect(component.displayYear()).toBe(prevYear);
      });
    });

    describe('navigationLabel', () => {
      it('shows the initial month label', async () => {
        await setupComponent(2025, 6);
        expect(component.navigationLabel()).toBe('June 2025');
      });

      it('updates after navigating back', async () => {
        await setupComponent(2025, 6);
        component.goToPrevMonth();
        expect(component.navigationLabel()).toBe('May 2025');
      });
    });

    describe('no-data state', () => {
      it('shows no-data state when allPlayersMonth is empty after load', async () => {
        // Default mock returns [] for getGrowthDataForYearMonth
        await setupComponent(2020, 1);
        expect(component.state()).toBe('no-data');
      });

      it('renders no-data message in DOM', async () => {
        await setupComponent(2020, 1);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('No data found for this month.');
      });

      it('does not show no-data when allPlayersMonth has entries', async () => {
        mockGrowthData['getGrowthDataForYearMonth'] = vi
          .fn()
          .mockResolvedValue([makeGrowthRecord({ month: 6, growth_pct: 2.38 })]);
        await setupComponent(2025, 6);
        expect(component.state()).toBe('historical');
      });
    });

    describe('navigation buttons in DOM', () => {
      it('renders prev and next buttons', async () => {
        await setupComponent(2025, 6);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const buttons = el.querySelectorAll('button[aria-label]');
        const ariaLabels = Array.from(buttons).map((b) => b.getAttribute('aria-label'));
        expect(ariaLabels).toContain('Previous month');
        expect(ariaLabels).toContain('Next month');
      });

      it('next button is hidden when at the most recent allowed month', async () => {
        const now = new Date();
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        await setupComponent(prevYear, prevMonth);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const nextBtn = el.querySelector('button[aria-label="Next month"]');
        expect(nextBtn).toBeNull();
      });

      it('next button is visible for a historical month', async () => {
        await setupComponent(2020, 6);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const nextBtn = el.querySelector('button[aria-label="Next month"]');
        expect(nextBtn).not.toBeNull();
      });
    });
  });
});
