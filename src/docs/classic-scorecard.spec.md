# Classic Scorecard — Component Specification

## 1. Objective

Provide a self-contained card component that displays a single member's investment growth performance for a specific year and month. The card adapts to one of three states — **Historical Month**, **Current Month (Data Found)**, and **Current Month Data Entry** — based on the current date relative to the monthly data-entry cutoff. The component is designed to be composed into any parent view (e.g. the Dashboard, a player-comparison page) by supplying three inputs.

---

## 2. Audience & Placement

- **Consumers**: Any feature component that needs to render a growth summary card for a specific member and month — initially the Dashboard and any future scorecard-comparison views.
- **Location**: `src/app/shared/components/classic-scorecard/`
- **Files**:

  | File                                  | Purpose                             |
  | ------------------------------------- | ----------------------------------- |
  | `classic-scorecard.component.ts`      | Component class                     |
  | `classic-scorecard.component.html`    | Template                            |
  | `classic-scorecard.component.css`     | CSS placeholder (empty at creation) |
  | `classic-scorecard.component.spec.ts` | Unit tests                          |

---

## 3. Architecture Decisions

### 3.1 Signal-Based Inputs

All three inputs use Angular's `input.required<T>()` API. Because all three values must be present before any data fetch is meaningful, data loading is initiated inside an `effect()` that watches all three inputs together and fires only when each holds a non-null, non-zero value. This avoids partial-load races when a parent sets inputs one at a time.

### 3.2 State Machine

The component exposes a single computed `state` signal that derives which of the three presentation modes to render. State transitions are driven purely by the current date and the loaded data — no event needs to trigger a manual re-evaluation. The three states and their determination rules are defined in §5.

### 3.3 Parallel Data Loading

Once all three inputs are available the component issues three independent service calls in parallel via `Promise.all`:

1. The viewed user's growth data for all months of the target year (filtered client-side to months ≤ `month` input).
2. All players' growth data for the exact `(year, month)` target (for average and rank calculation).
3. Market index data for the exact `(year, month)` target (Dow Jones, S&P 500).
4. All registered profiles (for total player count used in rank denominator and "waiting" message).

Calls 1–4 run concurrently; the component enters a loading state while they are in flight.

### 3.4 TrendLabelComponent Composition

The component uses `TrendLabelComponent` for exactly one purpose: the monthly sparkline row displayed directly below the main growth percentage. All other visual indicators — the large trend icon, the growth percentage text, the Dow/S&P 500 comparisons, the player average delta, and the rank — are rendered natively in the template.

**Sparkline instance:**

| Property   | Value                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `data`     | `ytdDataString()` — comma-separated `growth_pct` values for each month from January through target month. |
| `showIcon` | `true`                                                                                                    |
| `showText` | `true`                                                                                                    |

The icon and text displayed by this TrendLabel reflect the **delta between the target month and the prior month** (e.g. if February was +4.52% and March is +2.38%, the label shows `−2.14`). Per the updated TrendLabel spec, the sparkline SVG is automatically hidden when fewer than three data points exist (i.e. in January and February); the icon and text still render in February since two values suffice to compute a delta.

**Native (non-TrendLabel) indicators — rationale:**

All remaining scorecard indicators are rendered natively because their display is value-based rather than delta-based:

- **Growth percentage (large)** and **large arrow icon**: display the user's `growth_pct` for the target month directly, not a computed delta between two sequential values.
- **Dow / S&P 500**: display each index's own `growth_pct` for the target month with a colour-coded arrow. No prior-period comparison is involved.
- **Player Average**: displays the arithmetic difference between the user's `growth_pct` and the group average for the target month. This is a custom computation, not a last-minus-second-to-last delta.
- **Rank**: plain integer text.

### 3.5 Multi-Bank Handling

A single user may have multiple `growth_data` rows for the same `(year, month)` — one per bank. For **display** purposes, the component uses the first row returned when rows are ordered by `bank_name ASC` (deterministic, consistent with the Dashboard MVP). All other banks are ignored for the main scorecard display.

For the **data-entry** state, the component presents a bank-name dropdown with the fixed options `Fidelity Investments` (default) and `Edward Jones`, identical to the `MonthlyGrowthEntryComponent`. Changing the bank selection in the entry form does not affect scroll state or displayed data — the form is a compact sub-region of the card.

### 3.6 Rank Calculation

Rank is computed client-side once all players' data for the target month is loaded:

1. Collect one `growth_pct` value per unique `user_id` from the `(year, month)` result set, taking the first row per user ordered by `bank_name ASC`.
2. Sort these values descending.
3. The current user's rank = 1-based index of their `growth_pct` in the sorted list. Ties share the same rank (dense ranking is not required for MVP; simple positional rank is acceptable).
4. Rank denominator = total count of registered profiles (`registration_complete = true`).

If the viewed `uuid` has no entry in the result set, rank is `null` and is not displayed.

### 3.7 Player Average Calculation

Computed from the same per-user de-duplicated set used for rank (§3.6): arithmetic mean of all `growth_pct` values for the target month. Formatted to two decimal places with a leading `+` for positive values.

### 3.8 Styling

All visual styling uses the existing `gt-*` design-token classes from `styles.css` together with Tailwind CSS v4 utility classes. No new `gt-*` CSS classes are introduced for this component. The `.css` file is intentionally empty at creation.

Colour tokens follow the established palette:

| Trend   | CSS token / Tailwind class                              |
| ------- | ------------------------------------------------------- |
| Up      | `--color-success` / `text-[var(--color-success)]`       |
| Down    | `--color-error` / `text-[var(--color-error)]`           |
| Neutral | `--color-text-muted` / `text-[var(--color-text-muted)]` |

---

## 4. Component: `ClassicScorecardComponent`

### 4.1 Selector & Metadata

| Property         | Value                                        |
| ---------------- | -------------------------------------------- |
| Selector         | `app-classic-scorecard`                      |
| Standalone       | `true`                                       |
| Change detection | `OnPush`                                     |
| Imports          | `TrendLabelComponent`, `ReactiveFormsModule` |

### 4.2 Inputs

| Input name | Type     | Required | Description                                                                |
| ---------- | -------- | -------- | -------------------------------------------------------------------------- |
| `year`     | `number` | Yes      | Calendar year to display (e.g. `2026`).                                    |
| `month`    | `number` | Yes      | Target month to display, 1–12.                                             |
| `uuid`     | `string` | Yes      | The `profiles.id` / `auth.users.id` of the member whose scorecard to show. |

All three are declared with `input.required<T>()`. The three inputs together identify a unique scorecard view. The component does not render any data until all three are non-empty.

### 4.3 Outputs

None. The component is presentational. The data-entry form within the Current Month Data Entry state dispatches save/delete operations directly through `GrowthDataService` and does not emit events to the parent.

### 4.4 Injected Services

| Service             | Usage                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GrowthDataService` | `getGrowthDataForUserYear()`, `getGrowthDataForYearMonth()`, `saveGrowthData()`, `deleteOwnGrowthDataForMonth()` |
| `MarketDataService` | `getMarketIndexesForMonth()`                                                                                     |
| `ProfileService`    | `getRegisteredProfiles()`                                                                                        |
| `AuthService`       | `getSession()` — to determine if `uuid` matches the currently signed-in user                                     |

### 4.5 Writable Signals

| Signal            | Type                             | Description                                                                                                                                                                                 |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isLoading`       | `WritableSignal<boolean>`        | Initialised to `true` so `state()` starts as `'loading'` before any session or data resolves, preventing stale-state flashes on mount. Set to `false` at the end of each `loadData()` call. |
| `loadError`       | `WritableSignal<string>`         | Non-empty string when any parallel fetch fails.                                                                                                                                             |
| `isSaving`        | `WritableSignal<boolean>`        | `true` while a data-entry save/delete is in flight (Current Month Data Entry state only).                                                                                                   |
| `saveSuccess`     | `WritableSignal<string>`         | Non-empty string shows inline success banner after save.                                                                                                                                    |
| `saveError`       | `WritableSignal<string>`         | Non-empty string shows inline error banner after save.                                                                                                                                      |
| `userMonthlyData` | `WritableSignal<GrowthData[]>`   | All growth rows for the viewed user in the target year, filtered to months 1–`month`.                                                                                                       |
| `allPlayersMonth` | `WritableSignal<GrowthData[]>`   | All players' growth rows for the exact `(year, month)` target.                                                                                                                              |
| `marketIndexes`   | `WritableSignal<MarketIndex[]>`  | Dow and S&P 500 rows for the exact `(year, month)` target.                                                                                                                                  |
| `allProfiles`     | `WritableSignal<Profile[]>`      | All registered profiles (for total player count).                                                                                                                                           |
| `currentUserId`   | `WritableSignal<string \| null>` | The signed-in user's UUID obtained from `AuthService.getSession()` during data load.                                                                                                        |

### 4.6 Computed Signals (Internal)

| Signal              | Type                                                                        | Derivation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`             | `'historical' \| 'current-data' \| 'current-entry' \| 'loading' \| 'error'` | Derived from current date vs. cutoff; data presence; uuid vs. currentUserId. See §5.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `cardTitle`         | `string`                                                                    | `"${year} - Thru ${monthName}"` where `monthName` is derived from `new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, month - 1, 1))`.                                                                                                                                                                                                                                                                                                                                  |
| `userGrowthRecord`  | `GrowthData \| null`                                                        | First element of `userMonthlyData()` whose `month === month` input, ordered by `bank_name ASC`.                                                                                                                                                                                                                                                                                                                                                                                                |
| `userGrowthPct`     | `number \| null`                                                            | `userGrowthRecord()?.growth_pct ?? null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ytdDataString`     | `string`                                                                    | Comma-separated `growth_pct` values built by iterating months 1 through `month` and including only months that have a matching row in `userMonthlyData()`. Months with no submission are **skipped** (not substituted with `0`). The resulting string may therefore have fewer values than the target month number, and the sparkline x-axis represents only submitted months, not calendar positions. Sorted by month ascending. Used as `data` input to the sparkline `TrendLabelComponent`. |
| `perUserMonthData`  | `Map<string, number>`                                                       | De-duplicated map of `user_id → growth_pct` from `allPlayersMonth()`, filtering out any rows where `user_id` is `null`, then taking the first record per user ordered by `bank_name ASC`. Used for rank and average.                                                                                                                                                                                                                                                                           |
| `playerAvg`         | `number \| null`                                                            | Arithmetic mean of all values in `perUserMonthData()`. `null` when the map is empty.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `playerAvgDiff`     | `number \| null`                                                            | `userGrowthPct() - playerAvg()`. Positive means the user beat the group average for the month. `null` when either `userGrowthPct()` or `playerAvg()` is `null`.                                                                                                                                                                                                                                                                                                                                |
| `userRank`          | `number \| null`                                                            | 1-based position of `uuid`'s growth_pct in `perUserMonthData()` sorted descending. `null` when `uuid` has no entry.                                                                                                                                                                                                                                                                                                                                                                            |
| `totalPlayerCount`  | `number`                                                                    | `allProfiles().length`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `playersWithData`   | `number`                                                                    | `perUserMonthData().size`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `waitingCount`      | `number`                                                                    | `totalPlayerCount() - playersWithData()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `dowGrowthPct`      | `number \| null`                                                            | `growth_pct` from `marketIndexes()` where `index_name` starts with `'Dow'` (case-insensitive). `null` if not found.                                                                                                                                                                                                                                                                                                                                                                            |
| `sp500GrowthPct`    | `number \| null`                                                            | `growth_pct` from `marketIndexes()` where `index_name` starts with `'S&P'` (case-insensitive). `null` if not found.                                                                                                                                                                                                                                                                                                                                                                            |
| `isViewingOwnCard`  | `boolean`                                                                   | `currentUserId() === uuid()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `isPastCutoff`      | `boolean`                                                                   | `true` when the provided `(year, month)` is **not** the current calendar month, **or** when it is the current calendar month but today's day-of-month is ≥ 21. Implementation: `const t = new Date(); !(t.getFullYear() === year() && t.getMonth() + 1 === month() && t.getDate() < 21)`.                                                                                                                                                                                                      |
| `viewedUserProfile` | `Profile \| null`                                                           | `allProfiles().find(p => p.id === uuid()) ?? null`. Provides the viewed user's first and last name for the card's `aria-label`. `null` while profiles are loading or if the UUID is not present in `allProfiles()`.                                                                                                                                                                                                                                                                            |

### 4.7 Form Controls

| Control            | Type                  | Default                  | Description                                                                                     |
| ------------------ | --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `bankControl`      | `FormControl<string>` | `'Fidelity Investments'` | Bank name dropdown. Drives which `(email_key, bank_name, year, month)` record is saved/deleted. |
| `growthPctControl` | `FormControl<string>` | `''`                     | Growth percent text input. Empty string on save triggers a delete.                              |

Both form controls are class-level fields, initialised unconditionally as part of the class declaration (not lazily). This is required because the `takeUntilDestroyed()` subscriptions in §4.8 are set up in `ngOnInit` and need the controls to already exist. The form fields are simply irrelevant and unused when the component is not in `'current-entry'` state.

`cutoffDateLabel` is a `readonly` class field constant — not a computed signal — set to `"Final Data Available on the 21st"`.

### 4.8 Lifecycle

1. **Class fields** (declared before `ngOnInit`):
   - `private readonly destroyRef = inject(DestroyRef)` — required because `takeUntilDestroyed(this.destroyRef)` is called in `ngOnInit` (outside the injection context where the zero-argument overload would work).

2. **`ngOnInit`**:
   - Register an `effect()` that watches `year()`, `month()`, and `uuid()`. When all three are non-empty, call `loadData()`.
   - Subscribe to `bankControl.valueChanges` using `takeUntilDestroyed(this.destroyRef)` so that `saveSuccess` and `saveError` are cleared when the bank changes.
   - Subscribe to `growthPctControl.valueChanges` using `takeUntilDestroyed(this.destroyRef)` to clear `saveSuccess` and `saveError` on input change.

3. **`loadData()`**:
   - Check a private `_loadInProgress: boolean` field; if `true`, return immediately (no-op guard — `isLoading` stays `true` and the loading UI remains visible for the original in-flight call).
   - Set `_loadInProgress = true`, `isLoading(true)`, clear `loadError`.
   - Call `AuthService.getSession()`. If no session is returned, set `loadError('Not authenticated')` and return (the `finally` block resets `_loadInProgress` and `isLoading`).
   - Set `currentUserId(session.user.id)`.
   - `await Promise.all([getGrowthDataForUserYear(...), getGrowthDataForYearMonth(...), getMarketIndexesForMonth(...), getRegisteredProfiles()])`.
   - Assign results to the corresponding writable signals.
   - On any rejection: set `loadError` to the error message.
   - Always set `_loadInProgress = false` and `isLoading(false)` in a `finally` block.

4. **`onSave()` (Data Entry state)**:
   - Set `isSaving(true)`, clear `saveSuccess` and `saveError`.
   - If `growthPctControl.value.trim()` is non-empty:
     - Parse as `parseFloat`. If `NaN`, set `saveError('Please enter a valid number.')` and return.
     - Call `AuthService.getSession()` to obtain a fresh session. Call `GrowthDataService.saveGrowthData()` passing `{ email_key: session.user.email!.toLowerCase(), bank_name: bankControl.value, year: year(), month: month(), growth_pct: parsedPct, user_id: session.user.id }`.
     - On success: call `loadData()` to refresh, which will transition state from `'current-entry'` to `'current-data'` once data is confirmed. Set `saveSuccess('Growth saved.')`.
   - If blank:
     - Call `GrowthDataService.deleteOwnGrowthDataForMonth(year, month, bankControl.value)`.
     - On success: set `saveSuccess('Growth cleared.')`.
   - On any error: set `saveError(error.message)`.
   - Always set `isSaving(false)` in a `finally` block.

---

## 5. State Determination Logic

The `state` computed signal derives its value from the following priority-ordered rules:

```
if (isLoading())                          → 'loading'
else if (loadError())                     → 'error'
else if (isPastCutoff())                  → 'historical'
else if (isViewingOwnCard() && userGrowthPct() === null)
                                          → 'current-entry'
else                                      → 'current-data'
```

**Rules explained:**

| Condition                                                                                                    | State             | Business meaning                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data in flight                                                                                               | `'loading'`       | Show spinner; no card content rendered.                                                                                                                     |
| Any fetch error                                                                                              | `'error'`         | Show error banner in place of card.                                                                                                                         |
| Provided `(year, month)` ≠ current calendar month/year, **or** it matches and today's day-of-month is ≥ 21   | `'historical'`    | Data-entry window is closed. Covers all past months, all future months, and the current month on or after the 21st. All displayed data is treated as final. |
| Current calendar month/year = provided month/year AND day ≤ 20 AND viewing own card AND no data yet          | `'current-entry'` | User hasn't entered their own data yet; show the entry form.                                                                                                |
| Current calendar month/year = provided month/year AND day ≤ 20 AND (viewing another user OR own data exists) | `'current-data'`  | Data-entry window is open; data exists for the selected user. Show live scorecard with partial-data indicators and waiting message.                         |

---

## 6. Card States

### 6.1 Historical Month

Shown when `state() === 'historical'`.

**Trigger conditions**:

- The provided `(year, month)` is **not** the current calendar month/year (i.e. any past or future month), **or** it is the current calendar month/year and today's day-of-month is **≥ 21**.
- All player data is treated as finalised; the waiting indicator is not shown.

**Content displayed:**

```
┌──────────────────────────────────────────────────┐
│  2026 - Thru February            (gt-page-title) │
│                                                  │
│  ┌──── main growth area ─────────────────────┐   │
│  │  [large icon]  │  2.38 %  (large text)    │   │
│  │  (full height) │──────────────────────────│   │
│  │                │  [Sparkline TrendLabel:   │   │
│  │                │   sparkline+icon+delta]   │   │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ↓-0.8%  vs Dow       ↑+1.6%  vs S&P 500        │
│                                                  │
│  ↑+1.2%  Player Avg   Rank: 5/15                 │
└──────────────────────────────────────────────────┘
```

**Element details:**

- **Card title**: `cardTitle()` (e.g. "2026 - Thru February") — styled with `.gt-page-title`.
- **Large icon**: A standalone up/down SVG arrow — NOT a `TrendLabelComponent`. Coloured `text-[var(--color-success)]` for positive `userGrowthPct`, `text-[var(--color-error)]` for negative. Not rendered if `userGrowthPct()` is `null`. The icon element uses `h-full self-stretch` so its height spans the flex column (growth % text + sparkline row) to its right.
- **Growth percentage**: `userGrowthPct()` formatted as `"+3.75%"` / `"-1.20%"` / `"+0.00%"`. Font size `text-4xl font-bold`. Colour matches the icon. Rendered as `—` if `null`.
- **Sparkline (TrendLabel)**: placed directly below the growth % text. Receives `[data]="ytdDataString()"`, `[showIcon]="true"`, `[showText]="true"`. Container height `h-8`. The icon and text show the delta between the target month and the prior month. The sparkline SVG is suppressed automatically when fewer than three months of data are available.
- **Dow row**: native element, NOT a `TrendLabelComponent`. Displays a small color-coded up/down SVG icon followed by `formattedDowPct()` (the Dow's `growth_pct` for the target month, signed to two decimal places) and the static descriptor `"vs Dow"` in `text-[var(--color-text-muted)]`. Not rendered if `dowGrowthPct()` is `null`.
- **S&P 500 row**: identical pattern to the Dow row, using `formattedSp500Pct()` and the descriptor `"vs S&P 500"`. Not rendered if `sp500GrowthPct()` is `null`.
- **Player Avg**: native element, NOT a `TrendLabelComponent`. Displays a small color-coded up/down SVG icon followed by `formattedPlayerAvgDiff()` (the difference `userGrowthPct() − playerAvg()`, signed to two decimal places) and the static descriptor `"Player Avg"` in `text-[var(--color-text-muted)]`. A positive value (green) means the user beat the group average for this month. Not rendered if `playerAvgDiff()` is `null`.
- **Rank**: native text element, NOT a `TrendLabelComponent`. Displayed as `"Rank: {{userRank()}}/{{totalPlayerCount()}}"` in `text-sm font-medium text-[var(--color-text-secondary)]`. Not rendered if `userRank()` is `null`.

### 6.2 Current Month (Data Found)

Shown when `state() === 'current-data'`.

**Trigger conditions**:

- The provided `(year, month)` equals the current calendar month/year **and** today's day-of-month is **≤ 20**.
- A `growth_data` record exists for the viewed `uuid` for the target `(year, month)` (or the viewed user is a different user from the signed-in user).

**Content displayed:**

Identical card layout to §6.1 (Historical Month) with two additional footer elements below the Player Average / Rank row:

```
  Waiting on 5 of 15 players          (text-sm, text-[var(--color-text-muted)])
  Final Data Available on the 21st    (text-xs, text-[var(--color-text-muted)])
```

- "Waiting on X of Y players" — `waitingCount()` / `totalPlayerCount()`. If `waitingCount()` is 0, display "All players have submitted." instead.
- "Final Data Available on the 21st" — static string. Always shown in this state.
- The Rank and Player Average displayed reflect **partial data** (only players who have submitted so far). A `text-xs text-[var(--color-text-muted)]` note `"(partial)"` is appended inline to the rank display to communicate this: `"Rank: 3/15 (partial)"`.

### 6.3 Current Month Data Entry

Shown when `state() === 'current-entry'`.

**Trigger conditions**:

- The provided `(year, month)` equals the current calendar month/year **and** today's day-of-month is **≤ 20**.
- The viewed `uuid` matches the currently signed-in user (`isViewingOwnCard()` is `true`).
- No `growth_data` record exists for the signed-in user for the target `(year, month)`.

**Content displayed:**

```
┌──────────────────────────────────────────────┐
│  2026 - Thru March            (gt-page-title)│
│  Enter Growth / Loss          (gt-label)     │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│  (gt-input, inputmode="decimal")             │
│                                              │
│  [Bank Name dropdown]  (gt-select, optional) │
│                                              │
│  [Save]   (gt-btn gt-btn-primary)            │
│                                              │
│  @if (saveSuccess())  [success banner]       │
│  @if (saveError())    [error banner]         │
└──────────────────────────────────────────────┘
```

- The card title `cardTitle()` is shown as in other states.
- "Enter Growth / Loss" is a visible `<label>` (`.gt-label`) linked to the input.
- The growth input is a single `.gt-input` text field with `inputmode="decimal"` and placeholder `"e.g. 3.75 or -1.50"`.
- The bank dropdown (`.gt-select`) is shown below the input. Options are `Fidelity Investments` (default) and `Edward Jones`.
- The Save button is disabled while `isSaving()` is `true`.
- Success and error banners use `.gt-banner .gt-banner-success` / `.gt-banner .gt-banner-error` patterns, consistent with `MonthlyGrowthEntryComponent`.
- After a successful save, `loadData()` is called; once data loads the state transitions to `'current-data'` and the entry form is replaced by the Current Month card.

---

## 7. Template Structure (Annotated)

```
div.gt-card
  @switch (state())

    @case ('loading')
      p.text-center.text-[var(--color-text-muted)]   "Loading…"

    @case ('error')
      div.gt-banner.gt-banner-error   role="alert"
        {{ loadError() }}

    @case ('current-entry')
      h2.gt-page-title                   {{ cardTitle() }}
      form.gt-form   (ngSubmit)="onSave()"   novalidate
        div.gt-field
          label.gt-label   for="entry-growth-pct"   "Enter Growth / Loss"
          input#entry-growth-pct.gt-input
            type="text"   inputmode="decimal"
            placeholder="e.g. 3.75 or -1.50"
            [formControl]="growthPctControl"

        div.gt-field
          label.gt-label   for="entry-bank"   "Bank"
          select#entry-bank.gt-select   [formControl]="bankControl"
            @for (opt of bankOptions; track opt)
              option [value]="opt"   {{ opt }}

        @if (saveSuccess())
          div.gt-banner.gt-banner-success   role="status"   {{ saveSuccess() }}
        @if (saveError())
          div.gt-banner.gt-banner-error     role="alert"    {{ saveError() }}

        div.gt-btn-row
          button.gt-btn.gt-btn-primary   type="submit"   [disabled]="isSaving()"
            "Save"

    // ── Shared scorecard layout (historical + current-data) ──────────────
    // Angular @switch does not support fall-through; use @if to share
    // the layout between both states.
    @if (state() === 'historical' || state() === 'current-data')

      // ── Card header ──────────────────────────────────────────────
      h2.gt-page-title            {{ cardTitle() }}

      // ── Main growth area (flex row) ──────────────────────────────
      // items-stretch so the icon column fills the height of the right
      // column (growth % text + sparkline row combined).
      div.flex.items-stretch.gap-x-3.mb-3

        // ── Large trend icon (left column) ──────────────────────────
        // SVG up arrow when userGrowthPct() > 0, down arrow when < 0.
        // h-full fills the flex-row stretch height.
        @if (userGrowthPct() !== null)
          svg.w-12.h-full   aria-hidden="true"   ...

        // ── Right column: growth pct + sparkline ──────────────────
        div.flex.flex-col.gap-y-1

          // Growth pct text (large, color-coded)
          span.text-4xl.font-bold.[color token per trend]
            {{ formattedGrowthPct() }}

          // Sparkline TrendLabel (monthly data; icon + delta between last 2 months)
          div.h-8
            app-trend-label
              [data]="ytdDataString()"
              [showIcon]="true"
              [showText]="true"

      // ── Market comparison row ────────────────────────────────────
      div.flex.flex-wrap.justify-between.items-center.gap-y-1.mb-1.text-sm

        // Dow Jones (native — not TrendLabel)
        @if (dowGrowthPct() !== null)
          div.flex.items-center.gap-x-1
            svg.w-4.h-4.shrink-0   aria-hidden="true"   // up/down, color-coded
            span.[color token per trend]   {{ formattedDowPct() }}
            span.text-[var(--color-text-muted)]   "vs Dow"

        // S&P 500 (native — not TrendLabel)
        @if (sp500GrowthPct() !== null)
          div.flex.items-center.gap-x-1
            svg.w-4.h-4.shrink-0   aria-hidden="true"   // up/down, color-coded
            span.[color token per trend]   {{ formattedSp500Pct() }}
            span.text-[var(--color-text-muted)]   "vs S&P 500"

      // ── Player average + rank row ────────────────────────────────
      div.flex.justify-between.items-center.mt-2.text-sm

        // Player Avg (native — not TrendLabel)
        @if (playerAvgDiff() !== null)
          div.flex.items-center.gap-x-1
            svg.w-4.h-4.shrink-0   aria-hidden="true"   // up/down, color-coded
            span.[color token per trend]   {{ formattedPlayerAvgDiff() }}
            span.text-[var(--color-text-muted)]   "Player Avg"

        // Rank (native text)
        @if (userRank() !== null)
          p.text-[var(--color-text-secondary)].font-medium
            "Rank: {{ userRank() }}/{{ totalPlayerCount() }}"
            @if (state() === 'current-data')
              span.text-xs.text-[var(--color-text-muted)]   " (partial)"

      // ── Current-data-only footer ─────────────────────────────────
      @if (state() === 'current-data')
        div.mt-3.text-center
          p.text-sm.text-[var(--color-text-muted)]
            @if (waitingCount() > 0)
              "Waiting on {{ waitingCount() }} of {{ totalPlayerCount() }} players"
            @else
              "All players have submitted."
          p.text-xs.text-[var(--color-text-muted)]
            {{ cutoffDateLabel }}
```

---

## 8. Formatting Helper Signals

To keep the template readable, the following derived signals produce display-ready strings for each native indicator. The sign-formatting helper `fmt` used below is defined as: `(v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%'`.

| Signal                   | Expression                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `formattedGrowthPct`     | `computed(() => { const v = userGrowthPct(); if (v === null) return '—'; return fmt(v) + ' %'; })` |
| `formattedDowPct`        | `computed(() => dowGrowthPct() !== null ? fmt(dowGrowthPct()!) : '')`                              |
| `formattedSp500Pct`      | `computed(() => sp500GrowthPct() !== null ? fmt(sp500GrowthPct()!) : '')`                          |
| `formattedPlayerAvgDiff` | `computed(() => playerAvgDiff() !== null ? fmt(playerAvgDiff()!) : '')`                            |

**Colour token per trend** (used throughout the template for arrows and text):

| Condition             | Class                            |
| --------------------- | -------------------------------- |
| Value > 0             | `text-[var(--color-success)]`    |
| Value < 0             | `text-[var(--color-error)]`      |
| Value === 0 or `null` | `text-[var(--color-text-muted)]` |

---

## 9. Required Service Updates

### 9.1 `GrowthDataService`

Two new methods are required. Neither method exists at time of writing.

#### `getGrowthDataForUserYear(userId: string, year: number): Promise<GrowthData[]>`

**Purpose**: Fetch all `growth_data` rows for a specific `user_id` and calendar year, ordered by `month ASC`. Used to build the YTD sparkline data for the viewed user.

**Query**:

```sql
SELECT *
FROM growth_data
WHERE user_id = :userId
  AND year = :year
ORDER BY month ASC, bank_name ASC;
```

**Notes**: Uses `user_id` (UUID) rather than `email_key` for a direct, RLS-friendly lookup. Returns an empty array (not an error) when no rows exist.

#### `getGrowthDataForYearMonth(year: number, month: number): Promise<GrowthData[]>`

**Purpose**: Fetch all `growth_data` rows across **all players** for a specific `(year, month)`, ordered by `bank_name ASC` within each `user_id`. Used to calculate player average and rank, and to derive the count of players who have submitted.

**Query**:

```sql
SELECT *
FROM growth_data
WHERE year = :year
  AND month = :month
ORDER BY user_id ASC, bank_name ASC;
```

**Notes**: Returns all rows regardless of `user_id` being null. The caller (component) filters to rows where `user_id IS NOT NULL` before computing average and rank.

---

### 9.2 `MarketDataService`

One new method is required.

#### `getMarketIndexesForMonth(year: number, month: number): Promise<MarketIndex[]>`

**Purpose**: Fetch all `market_indexes` rows for a specific `(year, month)`. Returns the Dow Jones and S&P 500 entries needed for market comparison display.

**Query**:

```sql
SELECT *
FROM market_indexes
WHERE year = :year
  AND month = :month;
```

**Notes**: Returns an empty array when no market data has been entered for the target month. The component handles `null` gracefully by hiding the market comparison row when either index is missing.

---

### 9.3 `ProfileService`

One new method is required.

#### `getRegisteredProfiles(): Promise<Profile[]>`

**Purpose**: Fetch all `profiles` rows where `registration_complete = true`. Returns every member who has fully registered, providing the total player count for rank denominator and the "Waiting on X of Y" message.

**Query**:

```sql
SELECT *
FROM profiles
WHERE registration_complete = true
ORDER BY last_name ASC, first_name ASC;
```

**Notes**: This is a read operation available to all authenticated registered users under existing RLS. The returned array length is the authoritative `totalPlayerCount`.

---

## 10. Sizing & Responsiveness

- The component does not set its own max-width; the parent container controls card width. Within the Dashboard the card will likely be constrained to a single column (`max-w-xs sm:max-w-sm`).
- The main growth percentage text (`text-4xl`) and the large trend icon naturally scale to the card width.
- The large icon height is controlled by flex `items-stretch` on its parent row: no hard-coded height. The right column's height (growth text + `h-8` trend label) drives the row height, and the icon fills it via `h-full`.
- On very narrow viewports (< `xs`) the market comparison row wraps via `flex-wrap gap-y-1` to prevent overflow.
- Minimum recommended card width for readable rendering: `240px`.

---

## 11. Accessibility

- The outer card `div` carries an `aria-label` derived from `viewedUserProfile()`: when loaded it reads `"Scorecard for [firstName] [lastName], [monthName] [year]"` (e.g. `"Scorecard for Jane Smith, March 2026"`). While still loading or if the profile is not found in `allProfiles()`, it falls back to `"Scorecard"`.
- All SVG icons carry `aria-hidden="true"`.
- The large growth percentage `<span>` has a visually hidden companion `<span class="sr-only">` that reads the trend direction explicitly: e.g. `"Positive growth: +2.38 percent"`.
- The data-entry form in the `'current-entry'` state uses `aria-label="Monthly growth entry form"` on the `<form>` element.
- Success and error banners use `role="status"` and `role="alert"` respectively, consistent with other components in the application.
- The "Rank" and "Waiting" text values are enclosed in `<p>` elements (not `<span>` blocks) so screen readers announce them as complete phrases.

---

## 12. Edge Cases

| Scenario                                              | Behaviour                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid` not found in `growth_data` for target month    | `userGrowthRecord` is `null`; growth pct renders as `—`; rank and player avg indicators are hidden. This includes the case where a signed-in user views another user's card and that user has not yet submitted data for the current month — the card renders in `'current-data'` state showing dashes for all growth fields.                             |
| Market data not entered for target month              | `dowGrowthPct` and `sp500GrowthPct` are `null`; market comparison row is hidden entirely via `@if`.                                                                                                                                                                                                                                                       |
| No registered profiles returned                       | `totalPlayerCount` is `0`; rank display is hidden; waiting count is `0` ("All players have submitted.").                                                                                                                                                                                                                                                  |
| User has multiple banks for target month              | First row by `bank_name ASC` is used for display; all rows are excluded from rank/average de-duplication except the first.                                                                                                                                                                                                                                |
| All three inputs change simultaneously                | The `effect()` fires once (after the current Angular change-detection cycle); `loadData()` is called once.                                                                                                                                                                                                                                                |
| `loadData()` called while a prior load is in flight   | A private `_loadInProgress` boolean field is checked at the start of `loadData()`; a duplicate concurrent call returns immediately. `_loadInProgress` is separate from the `isLoading` signal so the loading UI remains visible during the original load.                                                                                                 |
| `onSave()` succeeds but `loadData()` afterwards fails | `saveSuccess` is set, then `loadData()` runs; if it fails, `loadError` is set and `state()` transitions to `'error'`, replacing the entire card template with the error banner. The `saveSuccess` message is not visible in the error state. Implementors should treat this as a load failure only — the save itself succeeded and the data is persisted. |
| Target month is in the future                         | Provided `(year, month)` ≠ current calendar month/year → `isPastCutoff()` is `true` → state is `'historical'`. No data will exist so growth renders as `—` and rank/average are hidden. Implementations should avoid routing to future months.                                                                                                            |
| `waitingCount()` is negative (data count > profiles)  | Clamp to `0` via `Math.max(0, totalPlayerCount() - playersWithData())`.                                                                                                                                                                                                                                                                                   |
