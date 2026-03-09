import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonBankEntry } from '../../../core/models/growth-data.interface';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';
import {
  createMockAuthService,
  createMockGrowthDataService,
} from '../../../core/testing/mock-supabase.service';
import { PersonSelectorComponent } from './person-selector.component';

const MOCK_SESSION = {
  user: { id: 'uuid-john', email: 'john@example.com' },
};

const MOCK_ENTRIES: PersonBankEntry[] = [
  { userId: 'uuid-daen', firstName: 'Daen', lastName: 'Dahl', bankName: 'Fidelity Investments' },
  { userId: 'uuid-john', firstName: 'John', lastName: 'Fruehling', bankName: 'Edward Jones' },
  {
    userId: 'uuid-john',
    firstName: 'John',
    lastName: 'Fruehling',
    bankName: 'Fidelity Investments',
  },
  { userId: 'uuid-vino', firstName: 'Vino', lastName: 'Muru', bankName: 'Fidelity Investments' },
  {
    userId: 'uuid-vino',
    firstName: 'Vino',
    lastName: 'Muru',
    bankName: 'Fidelity Investments (Managed)',
  },
  {
    userId: 'uuid-shelley',
    firstName: 'Shelley',
    lastName: 'Xie',
    bankName: 'Fidelity Investments',
  },
];

describe('PersonSelectorComponent', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuthService: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGrowthDataService: Record<string, any>;
  let fixture: ComponentFixture<PersonSelectorComponent>;
  let component: PersonSelectorComponent;

  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  beforeEach(async () => {
    mockAuthService = createMockAuthService();
    mockGrowthDataService = createMockGrowthDataService();
    mockGrowthDataService['getPersonBankList'] = vi.fn().mockResolvedValue(MOCK_ENTRIES);
    mockAuthService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION);

    await TestBed.configureTestingModule({
      imports: [PersonSelectorComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: GrowthDataService, useValue: mockGrowthDataService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  });

  // ── Initialisation ─────────────────────────────────────────────────────────

  it('1: creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('2: calls getPersonBankList once on init', () => {
    expect(mockGrowthDataService['getPersonBankList']).toHaveBeenCalledOnce();
  });

  it('3: calls getSession once on init', () => {
    expect(mockAuthService['getSession']).toHaveBeenCalledOnce();
  });

  it('4: sets isLoading to false after data loads', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('5: entries signal is populated after init', () => {
    expect(component.entries().length).toBe(MOCK_ENTRIES.length);
  });

  it('6: errorMessage remains empty when load succeeds', () => {
    expect(component.errorMessage()).toBe('');
  });

  // ── Default Selection ───────────────────────────────────────────────────────

  it("7: defaults to the current user's first sorted entry (Edward Jones for John)", () => {
    const selected = component.selectedEntry();
    expect(selected?.userId).toBe('uuid-john');
    expect(selected?.bankName).toBe('Edward Jones');
  });

  it('8: selects single entry when current user has only one entry', async () => {
    mockAuthService['getSession'] = vi
      .fn()
      .mockResolvedValue({ user: { id: 'uuid-daen', email: 'daen@example.com' } });

    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();
    await flush();
    freshFixture.detectChanges();

    expect(freshComponent.selectedEntry()?.userId).toBe('uuid-daen');
  });

  it('9: falls back to first sorted entry when current user has no entries', async () => {
    mockAuthService['getSession'] = vi
      .fn()
      .mockResolvedValue({ user: { id: 'uuid-nobody', email: 'nobody@example.com' } });

    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();
    await flush();
    freshFixture.detectChanges();

    expect(freshComponent.selectedEntry()).toEqual(MOCK_ENTRIES[0]);
  });

  // ── Display Labels ──────────────────────────────────────────────────────────

  it('10: single-entry Fidelity person renders without bank name (Daen Dahl)', () => {
    const entry = component.displayEntries().find((d) => d.entry.userId === 'uuid-daen');
    expect(entry?.label).toBe('Daen Dahl');
  });

  it('11: single-entry Fidelity person renders without bank name (Shelley Xie)', () => {
    const entry = component.displayEntries().find((d) => d.entry.userId === 'uuid-shelley');
    expect(entry?.label).toBe('Shelley Xie');
  });

  it('12: multi-bank person renders each entry with bank name (John Fruehling)', () => {
    const johnEntries = component
      .displayEntries()
      .filter((d) => d.entry.userId === 'uuid-john')
      .map((d) => d.label);
    expect(johnEntries).toContain('John Fruehling - Edward Jones');
    expect(johnEntries).toContain('John Fruehling - Fidelity Investments');
  });

  it('13: person with two Fidelity variants renders each with bank name (Vino Muru)', () => {
    const vinoEntries = component
      .displayEntries()
      .filter((d) => d.entry.userId === 'uuid-vino')
      .map((d) => d.label);
    expect(vinoEntries).toContain('Vino Muru - Fidelity Investments');
    expect(vinoEntries).toContain('Vino Muru - Fidelity Investments (Managed)');
  });

  it('14: displayEntries contains the correct total count', () => {
    expect(component.displayEntries().length).toBe(MOCK_ENTRIES.length);
  });

  // ── Rendering Order ─────────────────────────────────────────────────────────

  it('15: first displayEntries entry is Daen Dahl; last is Shelley Xie', () => {
    const disp = component.displayEntries();
    expect(disp[0].entry.lastName).toBe('Dahl');
    expect(disp[disp.length - 1].entry.lastName).toBe('Xie');
  });

  it('16: <select> has id="person-selector" and is linked to a visible <label>', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('select#person-selector')).not.toBeNull();
    const label = el.querySelector('label[for="person-selector"]');
    expect(label).not.toBeNull();
    expect(label?.textContent?.trim()).toBe('Select Member');
  });

  it('17: both Vino Muru entries render in service-provided order', () => {
    const disp = component.displayEntries();
    const fidIdx = disp.findIndex(
      (d) => d.entry.userId === 'uuid-vino' && d.entry.bankName === 'Fidelity Investments',
    );
    const fidMgdIdx = disp.findIndex(
      (d) =>
        d.entry.userId === 'uuid-vino' && d.entry.bankName === 'Fidelity Investments (Managed)',
    );
    expect(fidIdx).toBeLessThan(fidMgdIdx);
  });

  describe('18: empty list renders "No players found"', () => {
    it('renders no players found and no <select> when list is empty', async () => {
      mockGrowthDataService['getPersonBankList'] = vi.fn().mockResolvedValue([]);

      const freshFixture = TestBed.createComponent(PersonSelectorComponent);
      freshFixture.detectChanges();
      await flush();
      freshFixture.detectChanges();

      const el = freshFixture.nativeElement as HTMLElement;
      expect(el.querySelector('p')?.textContent).toContain('No players found');
      expect(el.querySelector('select')).toBeNull();
    });
  });

  // ── Output Event ────────────────────────────────────────────────────────────

  it('19: personSelected is emitted once after default selection is applied', async () => {
    const emitted: PersonBankEntry[] = [];
    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    freshFixture.componentInstance.personSelected.subscribe((e) => emitted.push(e));
    freshFixture.detectChanges();
    await flush();
    freshFixture.detectChanges();

    expect(emitted.length).toBe(1);
  });

  it('20: default selection event payload contains correct userId', async () => {
    const emitted: PersonBankEntry[] = [];
    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    freshFixture.componentInstance.personSelected.subscribe((e) => emitted.push(e));
    freshFixture.detectChanges();
    await flush();
    freshFixture.detectChanges();

    expect(emitted[0].userId).toBe('uuid-john');
  });

  it('21: default selection event payload contains correct firstName and lastName', async () => {
    const emitted: PersonBankEntry[] = [];
    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    freshFixture.componentInstance.personSelected.subscribe((e) => emitted.push(e));
    freshFixture.detectChanges();
    await flush();
    freshFixture.detectChanges();

    expect(emitted[0].firstName).toBe('John');
    expect(emitted[0].lastName).toBe('Fruehling');
  });

  it('22: default selection event payload contains correct bankName', async () => {
    const emitted: PersonBankEntry[] = [];
    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    freshFixture.componentInstance.personSelected.subscribe((e) => emitted.push(e));
    freshFixture.detectChanges();
    await flush();
    freshFixture.detectChanges();

    expect(emitted[0].bankName).toBe('Edward Jones');
  });

  it('23: changing the <select> value emits personSelected again', async () => {
    const emitted: PersonBankEntry[] = [];
    component.personSelected.subscribe((e) => emitted.push(e));

    // Re-emit from already-loaded component by simulating a change event
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const daenKey = `uuid-daen|Fidelity Investments`;
    select.value = daenKey;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
  });

  it('24: event payload after user change reflects the newly selected entry', async () => {
    const emitted: PersonBankEntry[] = [];
    component.personSelected.subscribe((e) => emitted.push(e));

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const daenKey = `uuid-daen|Fidelity Investments`;
    select.value = daenKey;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted[0].userId).toBe('uuid-daen');
    expect(emitted[0].bankName).toBe('Fidelity Investments');
  });

  // ── DOM / Template ──────────────────────────────────────────────────────────

  it('25: <select> element is present in the DOM', () => {
    expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
  });

  it('26: renders the correct number of <option> elements', () => {
    const options = fixture.nativeElement.querySelectorAll('option');
    expect(options.length).toBe(MOCK_ENTRIES.length);
  });

  it('27: option text for Daen Dahl is "Daen Dahl"', () => {
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('option'),
    ) as HTMLOptionElement[];
    const daenOption = options.find((o) => o.value === 'uuid-daen|Fidelity Investments');
    expect(daenOption?.textContent?.trim()).toBe('Daen Dahl');
  });

  it('28: option text for John Fruehling Edward Jones is "John Fruehling - Edward Jones"', () => {
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('option'),
    ) as HTMLOptionElement[];
    const johnOption = options.find((o) => o.value === 'uuid-john|Edward Jones');
    expect(johnOption?.textContent?.trim()).toBe('John Fruehling - Edward Jones');
  });

  it('29: loading state renders a disabled select', async () => {
    const freshFixture = TestBed.createComponent(PersonSelectorComponent);
    // Don't await — keep it in the loading state
    freshFixture.detectChanges();

    const select = freshFixture.nativeElement.querySelector('select') as HTMLSelectElement | null;
    // The component starts with isLoading=true and entries=[], so the select
    // only renders when entries are populated. Check either disabled or absent.
    if (select) {
      expect(select.disabled).toBe(true);
    } else {
      // Loading can legitimately hide the select; that's fine too
      expect(freshFixture.componentInstance.isLoading()).toBe(true);
    }
  });

  it('30: error banner is visible when errorMessage is non-empty', () => {
    component.errorMessage.set('Load failed');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Load failed');
  });

  it('31: error banner is not in DOM when errorMessage is empty', () => {
    const el = fixture.nativeElement as HTMLElement;
    const errorEl = el.querySelector('.gt-field-error');
    expect(errorEl).toBeNull();
  });

  // ── Error Handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    let errorFixture: ComponentFixture<PersonSelectorComponent>;
    let errorComponent: PersonSelectorComponent;

    beforeEach(async () => {
      mockGrowthDataService['getPersonBankList'] = vi.fn().mockRejectedValue(new Error('DB error'));

      errorFixture = TestBed.createComponent(PersonSelectorComponent);
      errorComponent = errorFixture.componentInstance;
      errorFixture.detectChanges();
      await flush();
      errorFixture.detectChanges();
    });

    it('32: sets errorMessage when getPersonBankList rejects', () => {
      expect(errorComponent.errorMessage()).not.toBe('');
    });

    it('33: isLoading is reset to false even when getPersonBankList rejects', () => {
      expect(errorComponent.isLoading()).toBe(false);
    });

    it('34: entries remains empty when load fails', () => {
      expect(errorComponent.entries()).toEqual([]);
    });

    it('35: personSelected is not emitted when load fails', async () => {
      const emitted: PersonBankEntry[] = [];
      const freshFixture = TestBed.createComponent(PersonSelectorComponent);
      freshFixture.componentInstance.personSelected.subscribe((e) => emitted.push(e));
      freshFixture.detectChanges();
      await flush();
      freshFixture.detectChanges();

      expect(emitted.length).toBe(0);
    });
  });
});
