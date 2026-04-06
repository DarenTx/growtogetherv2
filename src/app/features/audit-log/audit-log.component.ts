import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AuditLog } from '../../core/models/audit-log.interface';
import { AuditService } from '../../core/services/audit.service';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

@Component({
  selector: 'app-audit-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent implements OnInit {
  // Injected services
  private readonly auditService = inject(AuditService);
  private readonly location = inject(Location);

  // Signals
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<AuditLog[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(0);

  // Constants
  readonly PAGE_SIZE = 100;

  // Computed
  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.PAGE_SIZE));
  readonly isFirstPage = computed(() => this.currentPage() === 0);
  readonly isLastPage = computed(() => this.currentPage() >= this.totalPages() - 1);

  ngOnInit(): void {
    this.goToPage(0);
  }

  async goToPage(page: number): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const { rows, total } = await this.auditService.getAuditLogPage(page, this.PAGE_SIZE);
      this.rows.set(rows);
      this.totalCount.set(total);
      this.currentPage.set(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  buildDescription(log: AuditLog): string {
    const { table_name, action, old_data, new_data } = log;

    try {
      if (table_name === 'profiles') {
        const data = action === 'DELETE' ? old_data : new_data;
        if (!data) return `${action} on ${table_name}.`;
        const first = data['first_name'] as string;
        const last = data['last_name'] as string;
        const email = (data['work_email'] as string | undefined) ?? (data['email'] as string);
        if (!first && !last && !email) return `${action} on ${table_name}.`;
        if (action === 'INSERT') return `Added a new profile for ${first} ${last} (${email}).`;
        if (action === 'UPDATE') return `Updated the profile for ${first} ${last} (${email}).`;
        if (action === 'DELETE') return `Deleted the profile for ${first} ${last} (${email}).`;
      }

      if (table_name === 'growth_data') {
        const srcData = action === 'DELETE' ? old_data : new_data;
        if (!srcData) return `${action} on ${table_name}.`;
        const emailKey = srcData['email_key'] as string;
        const year = srcData['year'] as number;
        const month = srcData['month'] as number;
        const monthName = MONTH_NAMES[month - 1];
        const growthPct = srcData['growth_pct'] as number;

        if (action === 'INSERT') {
          return `Added growth data for ${emailKey} — ${monthName} ${year}: ${growthPct.toFixed(2)}%.`;
        }
        if (action === 'UPDATE') {
          const oldPct = (old_data?.['growth_pct'] as number | undefined) ?? growthPct;
          return `Updated growth data for ${emailKey} — ${monthName} ${year}: ${oldPct.toFixed(2)}% → ${growthPct.toFixed(2)}%.`;
        }
        if (action === 'DELETE') {
          return `Deleted growth data for ${emailKey} — ${monthName} ${year}: ${growthPct.toFixed(2)}%.`;
        }
      }

      if (table_name === 'market_indexes') {
        const srcData = action === 'DELETE' ? old_data : new_data;
        if (!srcData) return `${action} on ${table_name}.`;
        const indexName = srcData['index_name'] as string;
        const year = srcData['year'] as number;
        const month = srcData['month'] as number;
        const monthName = MONTH_NAMES[month - 1];
        const growthPct = srcData['growth_pct'] as number;

        if (action === 'INSERT') {
          return `Added market index ${indexName} — ${monthName} ${year}: ${growthPct.toFixed(2)}%.`;
        }
        if (action === 'UPDATE') {
          const oldPct = (old_data?.['growth_pct'] as number | undefined) ?? growthPct;
          return `Updated market index ${indexName} — ${monthName} ${year}: ${oldPct.toFixed(2)}% → ${growthPct.toFixed(2)}%.`;
        }
        if (action === 'DELETE') {
          return `Deleted market index ${indexName} — ${monthName} ${year}: ${growthPct.toFixed(2)}%.`;
        }
      }
    } catch {
      return `${action} on ${table_name}.`;
    }

    return `${action} on ${table_name}.`;
  }

  formatDateTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  resolvePerformerName(log: AuditLog): string {
    const name = `${log.performer_first_name ?? ''} ${log.performer_last_name ?? ''}`.trim();
    return name || 'System';
  }

  goBack(): void {
    this.location.back();
  }
}
