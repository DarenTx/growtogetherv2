# Activity Log — Product Specification

## 1. Objective

Provide all registered users with a paginated, human-readable view of every data-change event recorded by the application's audit trigger. The page shows who performed each action, when it occurred, and a plain-English description of what changed—without exposing raw database terminology.

---

## 2. Audience

- **Primary users**: All registered members of the Grow Together application.
- **Access control**: Requires an authenticated session with `registration_complete = true`. The route is protected by the existing `registrationGuard`. Admin and non-admin users see the same view.
- **Device context**: Desktop-first layout. On narrow viewports the table scrolls horizontally within a scroll container.

---

## 3. Route

| Path         | Component           | Guard               |
| ------------ | ------------------- | ------------------- |
| `/audit-log` | `AuditLogComponent` | `registrationGuard` |

The component is a lazy-loaded standalone component.

**Route registration:** Add the route as a top-level entry in `src/app/app.routes.ts`, following the same pattern as the `/dashboard` route:

```typescript
{
  path: 'audit-log',
  loadComponent: () =>
    import('./features/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
  canActivate: [registrationGuard],
},
```

---

## 4. Dashboard Navigation Link

**Location**: `DashboardComponent` template, inside the existing `<nav class="gt-dash-nav">` element.

**Visibility**: The **Activity Log** link is visible to **all** authenticated users—it is **not** gated behind `@if (isAdmin())`.

**Implementation notes**:

- Add `<a routerLink="/audit-log" class="gt-nav-link">Activity Log</a>` to the navigation block, positioned after any admin-only links and before the Sign Out button.
- No changes to guards or component signals are required in `DashboardComponent`.

---

## 5. Supported Functionality

### 5.1 Activity Log Table

Displays one row per `audit_logs` record with the following columns:

| Column Header    | Source / Logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date / Time**  | `audit_logs.created_at` formatted as `MMM D, YYYY h:mm a` (e.g. "Jan 5, 2026 3:42 pm") in the user's local timezone                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Performed By** | Full name (First Last) returned by the RPC as `performer_first_name` + `performer_last_name`. The RPC left-joins `profiles` on `profiles.id = audit_logs.performed_by`. Falls back to `"System"` if no matching profile is found. **Note:** For real auth users, `profiles.id` equals `auth.users.id` (set by the `handle_new_auth_user` trigger), so the join resolves correctly. Placeholder profiles created by the admin before onboarding will show `"System"` until their `profiles.id` is updated to match their auth UUID by the future onboarding Edge Function. |
| **Description**  | Plain-English sentence derived from `table_name`, `action`, `old_data`, and `new_data` (see §6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Sort order**: Most-recent record first — `created_at DESC`. The sort is fixed; column-header sorting is out of scope for this page.

### 5.2 Pagination

- **Page size**: 100 rows per page.
- **Mechanism**: Server-side pagination using Supabase's `.range(from, to)` with a matching `.count('exact')` to obtain the total record count.
- **Controls**: Displayed below the table.
  - **← Previous** button — disabled on page 1.
  - Page indicator: `Page X of Y` (e.g. "Page 1 of 14").
  - **Next →** button — disabled on the last page.
- Navigating pages does **not** scroll the user back to the top automatically.

### 5.3 Data Loading

- On component initialisation, `ngOnInit` delegates directly to `goToPage(0)`.
- `goToPage(page)` is the single fetch path for both initial load and pagination. It always sets `loading(true)` at the start and `loading(false)` on completion (success or error), so the "Loading…" indicator appears on every page change — not just the first.
- No secondary profile fetch is needed — performer names are resolved by the RPC.
- If any fetch error occurs, an inline error message replaces the table.

### 5.4 Empty State

If the `audit_logs` table contains no records, display a centered message: **"No activity log entries found."**

---

## 6. Plain-English Description Logic

The `AuditLogComponent` contains a private helper method `buildDescription(log: AuditLog): string` that maps raw audit fields to a readable sentence. The mapping rules are:

### 6.1 `profiles` table

| Action | Description template                                          |
| ------ | ------------------------------------------------------------- |
| INSERT | `Added a new profile for [first_name] [last_name] ([email]).` |
| UPDATE | `Updated the profile for [first_name] [last_name] ([email]).` |
| DELETE | `Deleted the profile for [first_name] [last_name] ([email]).` |

- `first_name`, `last_name`, and `email` are read from `new_data` (INSERT/UPDATE) or `old_data` (DELETE).
- **Privacy note:** For UPDATE actions on `profiles`, field-level change detail (old → new values) is **intentionally omitted**. Showing which fields changed on a user’s profile could expose personal information to all registered users. The description confirms that a change occurred without revealing what changed.

### 6.2 `growth_data` table

| Action | Description template                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| INSERT | `Added growth data for [email_key] — [month_name] [year]: [growth_pct]%.`                           |
| UPDATE | `Updated growth data for [email_key] — [month_name] [year]: [old_growth_pct]% → [new_growth_pct]%.` |
| DELETE | `Deleted growth data for [email_key] — [month_name] [year]: [growth_pct]%.`                         |

- `growth_pct` is stored as `DECIMAL(5,2)` and already represents the percentage value (e.g., `5.34` means 5.34%). Display it as-is with exactly two decimal places followed by `%` (e.g., `5.34%`). No multiplication or conversion is needed.

- `email_key`, `year`, `month`, and `growth_pct` are read from `new_data` (INSERT) or `old_data` (DELETE). For UPDATE, `email_key` and `year`/`month` come from `new_data`; `old_growth_pct` from `old_data.growth_pct`; `new_growth_pct` from `new_data.growth_pct`.
- `month_name` is the full month name derived from the integer `month` value (e.g. `3` → `"March"`). Use a static `MONTH_NAMES` constant array in the component file (same pattern as `MONTHS` in `dashboard.component.ts`). The database stores months as **1–12**; the array is **0-indexed**, so always access it as `MONTH_NAMES[month - 1]`.

### 6.3 `market_indexes` table

| Action | Description template                                                                              |
| ------ | ------------------------------------------------------------------------------------------------- |
| INSERT | `Added market index [index_name] — [month_name] [year]: [growth_pct]%.`                           |
| UPDATE | `Updated market index [index_name] — [month_name] [year]: [old_growth_pct]% → [new_growth_pct]%.` |
| DELETE | `Deleted market index [index_name] — [month_name] [year]: [growth_pct]%.`                         |

- Field resolution and `growth_pct` formatting follow the same rules as §6.2.

### 6.4 Unknown / Fallback

If `table_name` is unrecognised or required JSONB fields are missing, fall back to:
`[action] on [table_name].` (e.g. "UPDATE on some_table.")

---

## 7. Data Model

### 7.1 `AuditLog` Interface

Add a new interface file at `src/app/core/models/audit-log.interface.ts`:

```typescript
export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  performed_by: string | null;
  performer_first_name: string | null; // resolved by RPC join
  performer_last_name: string | null; // resolved by RPC join
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}
```

### 7.2 `SupabaseService` Method

Add one new method to `SupabaseService`:

```typescript
async getAuditLogPage(
  page: number,
  pageSize: number,
): Promise<{ rows: AuditLog[]; total: number }> {
  const from = page * pageSize;
  const { data, error } = await this.supabase.rpc('get_audit_log_page', {
    p_offset: from,
    p_limit: pageSize,
  });

  if (error) throw error;
  const result = data as { rows: AuditLog[]; total: number };
  return { rows: result.rows ?? [], total: result.total ?? 0 };
}
```

### 7.3 Supabase RPC: `get_audit_log_page`

Add a new SQL function to the Supabase database (update `master-supabase.schema.sql` accordingly):

```sql
CREATE OR REPLACE FUNCTION public.get_audit_log_page(
  p_offset INT,
  p_limit  INT
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH visible_logs AS (
    SELECT
      al.id,
      al.table_name,
      al.record_id,
      al.action,
      al.performed_by,
      p.first_name AS performer_first_name,
      p.last_name AS performer_last_name,
      al.old_data,
      al.new_data,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.profiles p ON p.id = al.performed_by
    WHERE NULLIF(BTRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), '') IS NOT NULL
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM visible_logs),
    'rows', (
      SELECT json_agg(r)
      FROM (
        SELECT *
        FROM visible_logs
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r
    )
  );
$$;
```

**Notes on the RPC:**

- `SECURITY DEFINER` ensures the join to `profiles` succeeds regardless of the caller's RLS context.
- `STABLE` allows Postgres to cache the plan within a transaction.
- The total count is computed in the same call to avoid a second round trip.
- Rows without a non-empty joined performer name are excluded so `System` entries are not returned.
- Grant execute to the `authenticated` role: `GRANT EXECUTE ON FUNCTION public.get_audit_log_page(INT, INT) TO authenticated;`
- **`performed_by` join behaviour:** `audit_logs.performed_by` is populated from `auth.uid()` at the time of the database operation, which is always the `auth.users.id`. For real auth users, `profiles.id` equals `auth.users.id` (guaranteed by the `handle_new_auth_user` trigger), so the LEFT JOIN resolves to a name. For placeholder profiles that have not yet been onboarded, `profiles.id` is a random UUID unrelated to any auth user — the join returns `NULL` and the component falls back to `"System"`. This is expected behaviour until the future onboarding Edge Function updates `profiles.id` to match the auth UUID.

---

## 8. Component Structure

### 8.1 File Locations

| File                                                     | Purpose          |
| -------------------------------------------------------- | ---------------- |
| `src/app/features/audit-log/audit-log.component.ts`      | Component class  |
| `src/app/features/audit-log/audit-log.component.html`    | Template         |
| `src/app/features/audit-log/audit-log.component.css`     | Component styles |
| `src/app/features/audit-log/audit-log.component.spec.ts` | Unit tests       |

### 8.2 Component Class Outline

```typescript
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
  private readonly supabase = inject(SupabaseService);
  private readonly location = inject(Location); // @angular/common — for goBack()

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
    /* delegates to goToPage(0) */
  }

  async goToPage(page: number): Promise<void> {
    /* set loading(true), errorMessage(null)
       call supabase.getAuditLogPage(page, PAGE_SIZE)
       on success: update rows(), totalCount(), currentPage(), set loading(false)
       on error:   set errorMessage(error message), set loading(false) */
  }

  buildDescription(log: AuditLog): string {
    /* see §6 */
  }

  formatDateTime(isoString: string): string {
    /* locale-formatted date/time */
  }

  resolvePerformerName(log: AuditLog): string {
    /* returns `${log.performer_first_name} ${log.performer_last_name}`.trim() || 'System' */
  }

  goBack(): void {
    this.location.back();
  }
}
```

---

## 9. Template Structure

```
<div class="gt-dash-container">
  <!-- Header row with page title and Back button -->
  <div class="gt-dash-header">
    <h1 class="gt-page-title">Activity Log</h1>
    <nav aria-label="Activity log navigation">
      <button type="button" class="gt-nav-link" (click)="goBack()">&#8592; Back</button>
    </nav>
  </div>

  <!-- Loading state -->
  @if (loading()) { <p class="gt-loading">Loading…</p> }

  <!-- Error state -->
  @else if (errorMessage()) { <p class="gt-error-page">{{ errorMessage() }}</p> }

  <!-- Empty state -->
  @else if (rows().length === 0) { <p class="gt-empty">No audit log entries found.</p> }

  <!-- Table -->
  @else {
    <div class="gt-table-wrap">
      <table class="gt-table" aria-label="Activity log">
        <thead>
          <tr>
            <th scope="col">Date / Time</th>
            <th scope="col">Performed By</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          @for (log of rows(); track log.id) {
            <tr>
              <td class="col-datetime">{{ formatDateTime(log.created_at) }}</td>
              <td class="col-performer">{{ resolvePerformerName(log) }}</td>
              <td class="col-description">{{ buildDescription(log) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Pagination controls -->
    <div class="gt-pagination" role="navigation" aria-label="Pagination">
      <button class="gt-btn-secondary"
              [disabled]="isFirstPage()"
              (click)="goToPage(currentPage() - 1)">← Previous</button>
      <span class="gt-page-indicator">Page {{ currentPage() + 1 }} of {{ totalPages() }}</span>
      <button class="gt-btn-secondary"
              [disabled]="isLastPage()"
              (click)="goToPage(currentPage() + 1)">Next →</button>
    </div>
  }
</div>
```

---

## 10. Styling

### 10.1 Page Title

The visible page heading is `<h1 class="gt-page-title">Activity Log</h1>`, consistent with how other pages in the application title themselves (e.g. "Enter Profiles", "Growth Dashboard 2026"). No component in this application sets the browser `<title>` tag — the tab always reads "Grow Together" from `index.html`, which is the established convention.

### 10.2 Existing Global Classes (no action needed)

All of the following `gt-*` classes are already defined in `src/styles.css` and can be used directly:

`gt-page-title`, `gt-dash-header`, `gt-dash-nav`, `gt-nav-link`, `gt-table`, `gt-table-wrap`, `gt-loading`, `gt-error-page`, `gt-empty`, `gt-btn-secondary`.

### 10.3 Classes to Add to `src/styles.css`

The following classes do **not** yet exist and must be added to `src/styles.css` alongside the existing `gt-*` definitions:

| Class               | Purpose                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `gt-pagination`     | Flex row container for Previous / page indicator / Next controls. Centred, consistent gap.   |
| `gt-page-indicator` | Inline text showing "Page X of Y". Muted colour, consistent with `gt-text-secondary` tokens. |

### 10.4 Classes to Add to `audit-log.component.css`

`gt-dash-container` is defined as a component-scoped class inside `dashboard.component.css` and is **not** available globally. Define it in `audit-log.component.css` using the same padding and animation as the dashboard:

```css
:host {
  display: block;
}

.gt-dash-container {
  padding: 1.25rem 1rem 3rem;
  animation: fade-in 0.2s ease-out;
}
```

### 10.5 Column Width Tuning

Add component-scoped column classes in `audit-log.component.css`:

- `col-datetime`: fixed width (e.g. `w-48`) — prevents wrapping on the timestamp.
- `col-performer`: fixed width (e.g. `w-40`).
- `col-description`: takes remaining space (`flex-1` / `w-auto`).

---

## 11. Out of Scope

- Filtering or searching audit log entries (by user, date range, action type, or table).
- Exporting the audit log (CSV, PDF, etc.).
- Real-time / live-update of new log entries while the page is open.
- Deleting or archiving audit log records.
- Displaying diff details for individual field changes within an UPDATE operation (only `old_growth_pct → new_growth_pct` is shown for numeric fields; full JSON diffing is out of scope).
- Per-user audit history drill-down.

---

## 12. Unit Test Requirements

Coverage targets for `audit-log.component.spec.ts`:

### 12.1 `buildDescription()`

This method has the most branching logic and must be tested exhaustively:

| Test case                 | Input                                                                                                                                       | Expected output                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| profiles INSERT           | `table_name: 'profiles'`, `action: 'INSERT'`, `new_data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }`               | `'Added a new profile for Jane Doe (jane@example.com).'`                  |
| profiles UPDATE           | `table_name: 'profiles'`, `action: 'UPDATE'`, `new_data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }`               | `'Updated the profile for Jane Doe (jane@example.com).'`                  |
| profiles DELETE           | `table_name: 'profiles'`, `action: 'DELETE'`, `old_data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }`               | `'Deleted the profile for Jane Doe (jane@example.com).'`                  |
| growth_data INSERT        | `action: 'INSERT'`, `new_data: { email_key: 'jane@example.com', year: 2025, month: 3, growth_pct: 5.34 }`                                   | `'Added growth data for jane@example.com — March 2025: 5.34%.'`           |
| growth_data UPDATE        | `action: 'UPDATE'`, `old_data: { growth_pct: 2.00 }`, `new_data: { email_key: 'jane@example.com', year: 2025, month: 3, growth_pct: 5.34 }` | `'Updated growth data for jane@example.com — March 2025: 2.00% → 5.34%.'` |
| growth_data DELETE        | `action: 'DELETE'`, `old_data: { email_key: 'jane@example.com', year: 2025, month: 3, growth_pct: 5.34 }`                                   | `'Deleted growth data for jane@example.com — March 2025: 5.34%.'`         |
| market_indexes INSERT     | `action: 'INSERT'`, `new_data: { index_name: 'S&P 500', year: 2025, month: 1, growth_pct: 2.10 }`                                           | `'Added market index S&P 500 — January 2025: 2.10%.'`                     |
| market_indexes UPDATE     | `action: 'UPDATE'`, `old_data: { growth_pct: 1.00 }`, `new_data: { index_name: 'S&P 500', year: 2025, month: 1, growth_pct: 2.10 }`         | `'Updated market index S&P 500 — January 2025: 1.00% → 2.10%.'`           |
| market_indexes DELETE     | `action: 'DELETE'`, `old_data: { index_name: 'S&P 500', year: 2025, month: 1, growth_pct: 2.10 }`                                           | `'Deleted market index S&P 500 — January 2025: 2.10%.'`                   |
| Month boundary — January  | `month: 1`                                                                                                                                  | resolves to `'January'` (tests `MONTH_NAMES[0]`)                          |
| Month boundary — December | `month: 12`                                                                                                                                 | resolves to `'December'` (tests `MONTH_NAMES[11]`)                        |
| Unknown table             | `table_name: 'unknown_table'`, `action: 'UPDATE'`                                                                                           | `'UPDATE on unknown_table.'`                                              |
| Missing JSONB fields      | `table_name: 'profiles'`, `action: 'INSERT'`, `new_data: null`                                                                              | fallback: `'INSERT on profiles.'`                                         |

### 12.2 `resolvePerformerName()`

| Test case           | Input                                                        | Expected     |
| ------------------- | ------------------------------------------------------------ | ------------ |
| Both names present  | `performer_first_name: 'Jane'`, `performer_last_name: 'Doe'` | `'Jane Doe'` |
| First name only     | `performer_first_name: 'Jane'`, `performer_last_name: null`  | `'Jane'`     |
| Both null           | `performer_first_name: null`, `performer_last_name: null`    | `'System'`   |
| `performed_by` null | `performed_by: null`, both name fields null                  | `'System'`   |

### 12.3 `formatDateTime()`

| Test case        | Input                    | Expected                                               |
| ---------------- | ------------------------ | ------------------------------------------------------ |
| Valid ISO string | `'2026-01-05T15:42:00Z'` | formatted string in user locale containing year `2026` |
| Midnight UTC     | `'2026-01-01T00:00:00Z'` | does not throw; returns a non-empty string             |

### 12.4 Pagination Computed Signals

| Test case                 | Setup                                 | Expected             |
| ------------------------- | ------------------------------------- | -------------------- |
| `totalPages` rounding     | `totalCount = 101`, `PAGE_SIZE = 100` | `totalPages() === 2` |
| `totalPages` exact        | `totalCount = 100`, `PAGE_SIZE = 100` | `totalPages() === 1` |
| `isFirstPage` on page 0   | `currentPage = 0`                     | `true`               |
| `isFirstPage` on page 1   | `currentPage = 1`                     | `false`              |
| `isLastPage` on last page | `currentPage = 1`, `totalCount = 101` | `true`               |
| `isLastPage` before last  | `currentPage = 0`, `totalCount = 101` | `false`              |

### 12.5 `goToPage()` Behaviour

- Sets `loading()` to `true` at the start of each call (including page changes after init).
- Sets `loading()` to `false` on success.
- Sets `loading()` to `false` and populates `errorMessage()` on error.
- Updates `rows()`, `totalCount()`, and `currentPage()` on success.
- Does **not** update `currentPage()` on error (stays on the previous page).

### 12.6 Template Rendering

- Shows `gt-loading` paragraph when `loading()` is `true`.
- Shows `gt-error-page` paragraph when `errorMessage()` is non-null.
- Shows empty-state message when `rows()` is empty and not loading.
- Renders correct number of `<tr>` elements matching `rows().length`.
