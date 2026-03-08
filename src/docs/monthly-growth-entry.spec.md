# Monthly Growth Entry — Product Specification

## 1. Objective

Provide each authenticated user with a focused, single-field entry point to record or clear their own investment growth percentage for the previous calendar month. The component surfaces the relevant month and year prominently, pre-fills the field if a value has already been saved, and persists changes (or deletions) to the database on demand.

---

## 2. Audience

- **Primary users**: All registered members of the Grow Together application.
- **Access control**: Requires an authenticated session with `registration_complete = true`. The component is rendered within a protected route already guarded by `authGuard` and `registrationGuard`.
- **Device context**: Mobile-first layout. Renders as a compact card that fits naturally within the dashboard or as a standalone page.

---

## 3. Architecture Decisions & Justification

### 3.1 Component Placement

The component lives at `src/app/features/dashboard/monthly-growth-entry/` and is a lazy-loadable standalone component. It can be embedded directly in the `DashboardComponent` template or given its own child route under `/dashboard/enter-growth`; the final routing decision is deferred to implementation.

### 3.2 Previous Month Calculation

The target month and year are derived from `new Date()` at component initialisation:

- Subtract one month from the current date.
- Handle the January boundary: month 1 rolls back to month 12 of the previous year.
- These values are computed once on init and stored as readonly signals (`prevMonth`, `prevYear`).
- Display label is formatted as the full month name followed by the four-digit year (e.g. **February 2026**). Use `Intl.DateTimeFormat` with `{ month: 'long', year: 'numeric' }` for localisation-safe formatting.

### 3.3 Bank Selection & Record Strategy

The `growth_data` table supports multiple records per user per month (one per `bank_name`). The component includes a **Bank Name** dropdown with two fixed options — `Fidelity Investments` (default) and `Edward Jones` — matching the options used in the admin historical-data entry form.

Data is scoped to the record matching `(email_key, bank_name, year, month)` for the selected bank. Only that record is read, written, or deleted. Records for other banks in the same month are not affected.

**No data is fetched at component initialisation.** The Growth % field remains empty until the user selects (or accepts the default) bank and the bank-change handler fires `loadExistingRecord()`.

If the service query returns more than one row (unexpected duplicate), the component takes the first result and logs a warning to the console.

### 3.4 Save vs. Clear Behaviour

- **Save with a value**: Upsert the record via `supabase.saveGrowthData(…)`. All six required fields are populated — see §6.3 for the full parameter list. `bank_name` comes from the bank dropdown control.
- **Save with an empty field**: Delete the matching record for that `(email_key, bank_name, year, month)` via the new `supabase.deleteOwnGrowthDataForMonth(…)` service method. `bank_name` is taken from the bank dropdown control at the time Save is clicked. If no record exists, this is a no-op and the operation still reports success.
- **No reload after save or delete.** The form retains its current state. There is no second fetch after either operation.

### 3.5 No Navigation on Save

The component does not navigate away on success. An inline success banner confirms the action, following the same pattern as the admin entry forms.

### 3.6 Styling

All styles use the existing `gt-*` design-token classes from `styles.css` (`.gt-page`, `.gt-card`, `.gt-page-title`, `.gt-page-subtitle`, `.gt-form`, `.gt-field`, `.gt-label`, `.gt-input`, `.gt-select`, `.gt-checkbox-row`, `.gt-btn`, `.gt-btn-primary`, `.gt-banner`, `.gt-banner-success`, `.gt-banner-error`). No new CSS classes are introduced for this phase. Tailwind utility classes may supplement layout where a `gt-*` class does not cover the need.

The `.css` file is intentionally empty at creation and serves as a placeholder for any future component-scoped overrides.

---

## 4. Component: `MonthlyGrowthEntryComponent`

### 4.1 Selector & File Location

| Item      | Value                                                               |
| --------- | ------------------------------------------------------------------- |
| Selector  | `app-monthly-growth-entry`                                          |
| Directory | `src/app/features/dashboard/monthly-growth-entry/`                  |
| Files     | `monthly-growth-entry.component.ts` · `.html` · `.css` · `.spec.ts` |

### 4.2 Inputs / Outputs

None. All data is derived internally from the current session and the current date.

### 4.3 Signals, State & Form Controls

**Private fields**

| Field        | Type              | Description                                                                                                        |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `session`    | `Session \| null` | Supabase `Session` object obtained in `ngOnInit` via `supabase.getSession()`. Provides `user.id` and `user.email`. |
| `destroyRef` | `DestroyRef`      | Injected via `inject(DestroyRef)`. Passed to `takeUntilDestroyed()` to clean up `valueChanges` subscriptions.      |

**Readonly computed values (set once on init)**

| Field          | Type     | Description                                                                        |
| -------------- | -------- | ---------------------------------------------------------------------------------- |
| `prevMonth`    | `number` | Previous calendar month (1–12).                                                    |
| `prevYear`     | `number` | Year corresponding to `prevMonth`.                                                 |
| `displayLabel` | `string` | Human-readable label, e.g. `"February 2026"`, formatted via `Intl.DateTimeFormat`. |

**Writable signals**

| Signal           | Type                      | Description                                                                            |
| ---------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `isLoading`      | `WritableSignal<boolean>` | `true` while a bank-change data fetch is in progress.                                  |
| `loadFailed`     | `WritableSignal<boolean>` | `true` when the bank-change fetch failed. Shows a soft warning; does not block saving. |
| `isSaving`       | `WritableSignal<boolean>` | `true` while a save or delete operation is in flight.                                  |
| `successMessage` | `WritableSignal<string>`  | Non-empty string triggers the success banner.                                          |
| `errorMessage`   | `WritableSignal<string>`  | Non-empty string triggers the error banner.                                            |

**Form controls**

| Control            | Type                  | Default                  | Description                                                                 |
| ------------------ | --------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `bankControl`      | `FormControl<string>` | `'Fidelity Investments'` | Bank name dropdown. Changing value triggers `loadExistingRecord()`.         |
| `growthPctControl` | `FormControl<string>` | `''`                     | Growth percent text input. Empty string is valid (triggers delete on save). |

### 4.4 Lifecycle

1. **`ngOnInit`**:
   - Compute `prevMonth` and `prevYear` from `new Date()`.
   - Compute `displayLabel` using `new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(…)`.
   - Call `supabase.getSession()`. Store the result in the private `session` field. If `session` is `null`, set `errorMessage('Unable to load session. Please sign in again.')` and return. (In practice this case is unreachable because the route is guarded.)
   - Subscribe to `bankControl.valueChanges` using `takeUntilDestroyed(this.destroyRef)` to call `loadExistingRecord()` whenever the selected bank changes.
   - Trigger an initial load by calling `loadExistingRecord()` immediately (because the dropdown already has its default value and `valueChanges` does not emit on subscription).

2. **`loadExistingRecord()`**:
   - Clear `growthPctControl` to `''`.
   - Set `isLoading(true)`, `loadFailed(false)`.
   - Call `supabase.getOwnGrowthDataForMonth(prevYear, prevMonth, bankControl.value)`.
   - On success: if a matching record is returned, patch `growthPctControl` with `record.growth_pct.toFixed(2)`; otherwise leave the control empty.
   - On error: set `loadFailed(true)`. The form remains enabled; the user may still enter and save data.
   - Set `isLoading(false)` in a `finally` block.

3. **`onSave()`**:
   - Set `isSaving(true)`, clear `successMessage` and `errorMessage`.
   - Branch on whether `growthPctControl.value.trim()` is blank:
     - **Non-blank**: Call `parseFloat(value)`. If the result is `NaN`, set `errorMessage('Please enter a valid number.')` and return early (set `isSaving(false)`). Otherwise call `supabase.saveGrowthData(…)` — see §6.3 for the full payload. On success: set `successMessage('Growth saved.')`.
     - **Blank**: Call `supabase.deleteOwnGrowthDataForMonth(prevYear, prevMonth, bankControl.value)`. On success: set `successMessage('Growth cleared.')`.
   - Set `isSaving(false)` in a `finally` block for both branches.

---

## 5. Template

### 5.1 Overall Structure

```
.gt-page
  h1.gt-page-title          "Enter Monthly Growth"
  p.gt-page-subtitle        Dynamic displayLabel — e.g. "February 2026"
  div.gt-card
    form.gt-form (novalidate, aria-label="Monthly growth entry form",
                  (ngSubmit)="onSave()")

      // ── Bank Name ─────────────────────────────────────────────
      div.gt-field
        label.gt-label for="bank_name"    "Bank Name"
        select#bank_name.gt-select        [formControl]="bankControl"
          @for (opt of bankOptions; track opt)
            option [value]="opt"          {{ opt }}

      // ── Loading / load-failed feedback ────────────────────────
      @if (isLoading())
        p.text-center.text-[var(--color-text-muted)]   "Loading…"
      @if (loadFailed())
        div.gt-banner.gt-banner-error     role="alert"
          "Could not load existing data for this month. You may still enter and save a value."

      // ── Growth % ──────────────────────────────────────────────
      div.gt-field
        label.gt-label for="growth_pct"   "Growth %"
        input#growth_pct.gt-input         type="text"
                                          inputmode="decimal"
                                          placeholder="e.g. 3.75 or -1.50"
                                          [formControl]="growthPctControl"
                                          [attr.aria-invalid]="errorMessage() !== ''"
        p.gt-field-hint                   "Enter a positive or negative decimal. Leave blank and save to clear."

      // ── Banners ───────────────────────────────────────────────
      @if (successMessage())
        div.gt-banner.gt-banner-success   role="status"   {{ successMessage() }}
      @if (errorMessage())
        div.gt-banner.gt-banner-error     role="alert"    {{ errorMessage() }}

      // ── Actions ───────────────────────────────────────────────
      div.gt-btn-row
        button.gt-btn.gt-btn-primary      type="submit"
                                          [disabled]="isSaving()"
                                          "Save"
```

### 5.2 Loading State

`isLoading` is set to `true` only while a bank-change fetch is in progress — not during component initialisation. The form remains fully visible during the load. The `"Loading…"` paragraph is rendered inline above the Growth % field (inside the form), replacing no other elements. All form controls remain enabled.

### 5.3 Disabled State During Save

The Save button is disabled (`[disabled]="isSaving()"`) while the save/delete operation is in flight to prevent double-submissions.

### 5.4 Banner Dismissal

`successMessage` and `errorMessage` signals are both reset to `''` when the user modifies `growthPctControl`. This is wired up in `ngOnInit` via:

```typescript
this.growthPctControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
  this.successMessage.set('');
  this.errorMessage.set('');
});
```

`DestroyRef` is obtained with `inject(DestroyRef)` at the class field level (not in a constructor). `takeUntilDestroyed` receives it explicitly so the subscription is cleaned up when the component is destroyed, even when the subscription is created inside `ngOnInit` rather than in the constructor.

---

## 6. New & Modified Service Methods

**Session source**: all three methods below call `this.getSession()` internally, matching the existing pattern used by `getProfile()`, `updateProfile()`, and `getOwnGrowthData()` in the same service. `email_key` is always `session.user.email.toLowerCase()`.

### 6.1 New: `SupabaseService.getOwnGrowthDataForMonth`

```typescript
async getOwnGrowthDataForMonth(year: number, month: number, bankName: string): Promise<GrowthData | null>
```

- Requires an active session; returns `null` if unauthenticated.
- Queries `growth_data` filtered by `email_key = session.user.email.toLowerCase()`, `year`, `month`, and `bank_name = bankName`.
- Uses `.limit(1)` to guard against unexpected duplicates; returns the first row, or `null` if none found.
- Throws on unexpected Supabase error.

> **Placement**: Insert after the existing `getOwnGrowthData()` method in the `// ─── Growth Data` section.

### 6.2 New: `SupabaseService.deleteOwnGrowthDataForMonth`

```typescript
async deleteOwnGrowthDataForMonth(year: number, month: number, bankName: string): Promise<void>
```

- Requires an active session; throws if unauthenticated.
- Deletes row(s) from `growth_data` matching `email_key = session.user.email.toLowerCase()`, `year`, `month`, and `bank_name = bankName`.
- If no matching rows exist, the delete is a no-op — does not throw.
- Throws on unexpected Supabase error.

> **Placement**: Insert directly after `getOwnGrowthDataForMonth()` in the `// ─── Growth Data` section.

### 6.3 Existing: `SupabaseService.saveGrowthData` — Required Parameters

The component calls the existing `saveGrowthData(growthData: Partial<GrowthData>)` method. All six fields below must be present in the payload; omitting any will result in a database constraint violation or incorrect data.

| Field        | Type     | Source                                            |
| ------------ | -------- | ------------------------------------------------- |
| `email_key`  | `string` | `session.user.email.toLowerCase()`                |
| `user_id`    | `string` | `session.user.id` (the authenticated user's UUID) |
| `year`       | `number` | `prevYear` (computed on init)                     |
| `month`      | `number` | `prevMonth` (computed on init)                    |
| `bank_name`  | `string` | `bankControl.value` at time of save               |
| `growth_pct` | `number` | `parseFloat(growthPctControl.value.trim())`       |

> **Note**: Unlike the admin historical-data form (which uses `user_id: null` for placeholder profiles), this component always provides a real `user_id` because the route requires a fully authenticated session.

---

## 7. Data Validation

| Rule                                             | Enforcement                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Bank name must be selected                       | Dropdown always has a value; defaults to `Fidelity Investments` on init. No validator needed.            |
| Growth % must be a valid decimal number or blank | `parseFloat` check in `onSave()`; non-numeric non-blank → `errorMessage('Please enter a valid number.')` |
| Growth % may be negative (e.g. `-1.50`)          | Allowed — no minimum constraint                                                                          |
| Growth % may exceed ±100                         | Allowed — no maximum constraint                                                                          |
| Blank Growth % on save triggers a delete         | Handled in `onSave()` branch logic                                                                       |

No Angular `Validators` are attached to any of the three form controls. All validation is performed imperatively inside `onSave()`. The `growthPctControl` uses `type="text"` to permit an empty string, avoiding browser type coercion to `null` that can occur with `type="number"`.

---

## 8. Accessibility

- All form controls (`<select>`, `<input type="text">`, `<input type="checkbox">`) have associated `<label>` elements linked by matching `for`/`id` pairs.
- `[attr.aria-invalid]` on the Growth % input is bound to `errorMessage() !== ''`. Because no Angular `Validators` are attached, `formControl.invalid` is always `false` and cannot drive this attribute.
- The load-failed banner, error banner, and success banner each carry appropriate live-region roles:
  - Load-failed and error banners: `role="alert"` (assertive).
  - Success banner: `role="status"` (polite).
- The Save button communicates its disabled state via the native `[disabled]` attribute.
- The form element has `aria-label="Monthly growth entry form"`.
- The Growth % input has `inputmode="decimal"` to trigger a numeric keyboard on mobile devices.

---

## 9. Verification Criteria

| Scenario                                                           | Expected Result                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Component loads                                                    | Bank dropdown defaults to `Fidelity Investments`; Growth % is empty; initial load fires for Fidelity      |
| Initial load finds an existing record for the default bank         | Growth % pre-filled with `growth_pct.toFixed(2)` (e.g. `"3.75"`)                                          |
| Initial load finds no existing record                              | Growth % remains empty; `loadFailed` is `false`                                                           |
| Initial load fails                                                 | `loadFailed` is `true`; soft warning banner shown; form remains enabled for manual entry                  |
| User changes bank to `Edward Jones`                                | Growth % clears; new fetch fires for Edward Jones; field pre-fills if record found                        |
| User enters a valid decimal and clicks Save                        | `saveGrowthData` called with all 6 fields; success banner "Growth saved."; field retains entered value    |
| User clears the input and clicks Save (record previously existed)  | `deleteOwnGrowthDataForMonth` called; success banner "Growth cleared."; input remains empty               |
| User clears the input and clicks Save (no record existed)          | Delete is a no-op; success banner "Growth cleared." appears                                               |
| User enters non-numeric text (e.g. `"abc"`) and clicks Save        | Error banner shown; no database call made; `isSaving` never set to `true`                                 |
| User modifies Growth % after a success banner is shown             | Both `successMessage` and `errorMessage` clear                                                            |
| Save is in progress                                                | Save button is disabled; `isSaving` is `true`                                                             |
| Supabase save call fails                                           | Error banner shows the error detail; record not changed                                                   |
| Supabase delete call fails                                         | Error banner shows the error detail; record not changed                                                   |
| Subtitle displays correct previous month and year                  | Subtitle reads full month name and year (e.g. `"February 2026"` when current date is in March 2026)       |
| January boundary (current month is January)                        | Subtitle reads `"December <previous year>"` (e.g. `"December 2025"` when current date is in January 2026) |
| `getSession()` returns `null` (should not occur; route is guarded) | `errorMessage` set; form controls may be interacted with but Save will fail gracefully                    |

---

## 10. Out of Scope (This Phase)

- Historical month navigation (selecting a month other than the previous one).
- Displaying the percentage with a sign prefix (`+3.75%`) inside the input; that formatting is read-only dashboard behaviour.
- Rich formatting or currency input masking.
- Backfilling `user_id` on existing placeholder rows when a user completes registration.

---

## 11. Unit Tests

The `.spec.ts` file uses **Vitest** with `@angular/core/testing`, matching the framework used throughout the project. Mock the `SupabaseService` using `createMockSupabaseService()` from `core/testing/mock-supabase.service.ts` and override individual methods with `vi.fn()`.

Define a `MOCK_SESSION` constant:

```typescript
const MOCK_SESSION = {
  user: { id: 'user-uuid-123', email: 'test@example.com' },
};
```

### 11.1 Required Test Cases

| #   | Description                                                                                 | Key Assertions                                                                                     |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Component creates                                                                           | `expect(component).toBeTruthy()`                                                                   |
| 2   | `displayLabel` reflects previous month on init (run in March)                               | `component.displayLabel` equals `'February 2026'`                                                  |
| 3   | January boundary — `displayLabel` when mocked date is January                               | `displayLabel` equals `'December <prev year>'`                                                     |
| 4   | On init, `getOwnGrowthDataForMonth` is called for the default bank `'Fidelity Investments'` | `mockService.getOwnGrowthDataForMonth` called with `(prevYear, prevMonth, 'Fidelity Investments')` |
| 5   | Existing record pre-fills `growthPctControl` with `toFixed(2)`                              | Control value equals `'3.75'` when service returns `{ growth_pct: 3.75 }`                          |
| 6   | No existing record leaves `growthPctControl` empty                                          | Control value equals `''` when service returns `null`                                              |
| 7   | Load failure sets `loadFailed` to `true`; form is not disabled                              | `component.loadFailed()` is `true`; `growthPctControl.enabled` is `true`                           |
| 8   | Changing bank clears `growthPctControl` and re-fetches                                      | `mockService.getOwnGrowthDataForMonth` called with new bank name; control value resets to `''`     |
| 9   | Valid decimal save calls `saveGrowthData` with correct 6-field payload                      | Verify all fields: `email_key`, `user_id`, `year`, `month`, `bank_name`, `growth_pct`              |
| 10  | Successful save sets `successMessage('Growth saved.')`                                      | `component.successMessage()` equals `'Growth saved.'`                                              |
| 11  | Blank save calls `deleteOwnGrowthDataForMonth` with correct args                            | `mockService.deleteOwnGrowthDataForMonth` called with `(prevYear, prevMonth, bankControl.value)`   |
| 12  | Successful delete sets `successMessage('Growth cleared.')`                                  | `component.successMessage()` equals `'Growth cleared.'`                                            |
| 13  | Non-numeric input does not call `saveGrowthData`                                            | `mockService.saveGrowthData` not called; `errorMessage` is non-empty                               |
| 14  | Save failure sets `errorMessage`                                                            | `component.errorMessage()` is the error message text from the thrown error                         |
| 15  | Editing `growthPctControl` clears both banners                                              | Both `successMessage()` and `errorMessage()` equal `''` after value change                         |
| 16  | `isSaving` is `true` during save and `false` after                                          | Verify using a deferred mock; check signal state during and after the call                         |

### 11.2 Test Setup Notes

- Override `getSession` on `mockService` to return `MOCK_SESSION` for all tests.
- Override `getOwnGrowthDataForMonth` to return `null` by default (no `is_managed` field needed); set return values per test.
- Override `saveGrowthData` and `deleteOwnGrowthDataForMonth` to return `Promise.resolve(undefined)`.
- For the January boundary test (case 3), use `vi.setSystemTime()` to mock `new Date()` before creating the component, and restore it with `vi.useRealTimers()` in `afterEach`.
