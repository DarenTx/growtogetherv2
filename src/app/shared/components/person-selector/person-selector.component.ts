import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { PersonBankEntry } from '../../../core/models/growth-data.interface';
import { AuthService } from '../../../core/services/auth.service';
import { GrowthDataService } from '../../../core/services/growth-data.service';

interface DisplayEntry {
  /** Composite key: userId + '|' + bankName */
  key: string;
  /** Human-readable label: "First Last" or "First Last - Bank" */
  label: string;
  entry: PersonBankEntry;
}

@Component({
  selector: 'app-person-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-selector.component.html',
  styleUrl: './person-selector.component.css',
})
export class PersonSelectorComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly growthDataService = inject(GrowthDataService);

  readonly entries = signal<PersonBankEntry[]>([]);
  readonly selectedKey = signal<string>('');
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  readonly personSelected = output<PersonBankEntry>();

  readonly selectedEntry = computed<PersonBankEntry | undefined>(() => {
    const key = this.selectedKey();
    return this.entries().find((e) => `${e.userId}|${e.bankName}` === key);
  });

  readonly displayEntries = computed<DisplayEntry[]>(() => {
    const all = this.entries();

    // Group by userId to apply bank-name display rule
    const countByUser = new Map<string, number>();
    const allFidelityByUser = new Map<string, boolean>();
    for (const e of all) {
      countByUser.set(e.userId, (countByUser.get(e.userId) ?? 0) + 1);
      const prev = allFidelityByUser.get(e.userId) ?? true;
      allFidelityByUser.set(e.userId, prev && e.bankName.startsWith('Fidelity Investments'));
    }

    return all.map((e) => {
      const count = countByUser.get(e.userId) ?? 0;
      const allFidelity = allFidelityByUser.get(e.userId) ?? false;
      const omitBank = count === 1 && allFidelity;
      const label = omitBank
        ? `${e.firstName} ${e.lastName}`
        : `${e.firstName} ${e.lastName} - ${e.bankName}`;
      return { key: `${e.userId}|${e.bankName}`, label, entry: e };
    });
  });

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [entries, session] = await Promise.all([
        this.growthDataService.getPersonBankList(),
        this.auth.getSession(),
      ]);

      this.entries.set(entries);

      if (entries.length > 0) {
        const currentUserId = session?.user?.id;
        const defaultEntry =
          (currentUserId ? entries.find((e) => e.userId === currentUserId) : null) ?? entries[0];
        this.selectedKey.set(`${defaultEntry.userId}|${defaultEntry.bankName}`);
        this.personSelected.emit(defaultEntry);
      }
    } catch (err) {
      this.errorMessage.set((err as Error)?.message ?? 'Failed to load members');
    } finally {
      this.isLoading.set(false);
    }
  }

  onSelectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    this.selectedKey.set(key);
    const entry = this.entries().find((e) => `${e.userId}|${e.bankName}` === key);
    if (entry) {
      this.personSelected.emit(entry);
    }
  }
}
