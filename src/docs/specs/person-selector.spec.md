# Person Selector — Component Specification

## 1. Objective

Provide a reusable dropdown component that lets the user select any registered member of the
Grow Together group. Because some members maintain investment accounts at more than one
institution, the dropdown produces one entry per member–bank combination rather than one entry
per member. The component emits a typed output event each time the selection changes so that
host components (e.g. the dashboard, admin pages) can react without coupling directly to the
selector's internal state.

---

## 2. Audience & Placement

- **Consumers**: Any feature component that needs to scope a view or an action to a specific
  member–bank pairing — initially the dashboard growth grid and future admin drill-down views.
- **Location**: `src/app/shared/components/person-selector/`
- **Files**:

  | File                                | Purpose                             |
  | ----------------------------------- | ----------------------------------- |
  | `person-selector.component.ts`      | Component class                     |
  | `person-selector.component.html`    | Template                            |
  | `person-selector.component.css`     | CSS placeholder (empty at creation) |
  | `person-selector.component.spec.ts` | Unit tests                          |

---

## 3. Architecture Decisions

### 3.1 Data Source

The dropdown is populated by querying the `growth_data` table for the full set of distinct
`(user_id, bank_name)` pairs, then joining to `profiles` to resolve `first_name` and
`last_name`. A new `GrowthDataService` method — `getPersonBankList()` — encapsulates this
query and returns `PersonBankEntry[]` (see §5.1).

The query is intentionally scoped to rows where `user_id IS NOT NULL` so that legacy or
orphaned rows lacking a profile link are excluded. The RLS policies required to permit
authenticated registered users to read all `growth_data` and `profiles` rows needed to
populate this list are already in place.

### 3.2 Bank-Name Display Rule

The display label for each dropdown option is derived from the person's full set of bank
entries before rendering:

1. Group all entries by `user_id`.
2. For a given person, evaluate whether **every** one of their `bank_name` values starts with
   the literal string `"Fidelity Investments"` AND they have **exactly one** entry.
   - If **yes**: Display as `"First Last"` (bank name omitted).
   - In all other cases (multiple entries, or any entry whose `bank_name` does not start with
     `"Fidelity Investments"`): Display as `"First Last - Bank Name"`.

This rule produces the expected display from the example dataset:

| Raw entries                                                      | Displayed as                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Daen Dahl — Fidelity Investments (single Fidelity entry)         | `Daen Dahl`                                                                      |
| John Fruehling — Fidelity Investments, Edward Jones              | `John Fruehling - Fidelity Investments`, `John Fruehling - Edward Jones`         |
| Vino Muru — Fidelity Investments, Fidelity Investments (Managed) | `Vino Muru - Fidelity Investments`, `Vino Muru - Fidelity Investments (Managed)` |
| Shelley Xie — Fidelity Investments (single Fidelity entry)       | `Shelley Xie`                                                                    |

### 3.3 Sort Order

`getPersonBankList()` is the authoritative source of sort order. It guarantees entries are
returned sorted by `lastName → firstName → bankName`, all ascending and case-insensitive.
The component renders entries in the order received from the service without applying any
additional client-side sort.

### 3.4 Default Selection

On initialisation the component resolves the current user's UUID via `AuthService.getSession()`
and pre-selects the first entry from the sorted list that matches that UUID. If the current
user has multiple bank entries the first in sort order is selected. If the current user's UUID
is not present in the list (edge case: no `growth_data` rows for the current user), the
component falls back to the first entry in the overall sorted list.

### 3.5 Output Event

The component declares a single output — `personSelected` — using Angular's signal-based
`output<PersonBankEntry>()` API. The event is emitted:

- Once immediately after the list is loaded and the default selection is applied (so host
  components do not need a separate initialisation hook).
- Each time the user changes the dropdown selection.

### 3.6 Styling

All visual styling uses existing `gt-*` design-token classes from `styles.css` together with
Tailwind utility classes for layout and spacing. The `<select>` element is styled with
`.gt-select`. It is preceded by a visible `<label>` with class `.gt-label` and the text **"Select Member"**. The `<label>` and `<select>` are
linked via matching `for`/`id` attributes (`for="person-selector"` and
`id="person-selector"`) so that clicking the label focuses the dropdown. No new `gt-*` CSS
classes are introduced for this component. The `.css` file is intentionally empty at creation
and serves as a placeholder for future component-scoped overrides.

### 3.7 Empty-List State

If `getPersonBankList()` succeeds but returns an empty array, the component renders the text
**"No players found"** inside a `<p>` element in place of the `<label>` and `<select>`. This
is an unrecoverable condition; no retry mechanism is provided.

---

## 4. Component: `PersonSelectorComponent`

### 4.1 Selector & Metadata

| Property         | Value                          |
| ---------------- | ------------------------------ |
| Selector         | `app-person-selector`          |
| Standalone       | `true`                         |
| Change detection | `OnPush`                       |
| Imports          | None beyond Angular primitives |

### 4.2 Inputs / Outputs

The component accepts **no inputs**.

| Output name      | Event type        | When emitted                                                 |
| ---------------- | ----------------- | ------------------------------------------------------------ |
| `personSelected` | `PersonBankEntry` | After default selection is applied; on user selection change |

### 4.3 Signals & State

**Writable signals**

| Signal         | Type                                | Description                                                                                                             |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `entries`      | `WritableSignal<PersonBankEntry[]>` | The sorted, display-ready list of person–bank entries. Empty until load completes.                                      |
| `selectedKey`  | `WritableSignal<string>`            | Composite key (`userId + '\|' + bankName`) identifying the active selection. Bank names never contain a pipe character. |
| `isLoading`    | `WritableSignal<boolean>`           | `true` while the `getPersonBankList()` call is in flight.                                                               |
| `errorMessage` | `WritableSignal<string>`            | Non-empty string renders an inline error banner. Empty string hides the banner.                                         |

**Computed signals**

| Signal           | Type                                   | Derivation                                                                                                                  |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `selectedEntry`  | `Signal<PersonBankEntry \| undefined>` | Derived from `entries` and `selectedKey`. Returns the currently selected entry or `undefined` if nothing is selected yet.   |
| `displayEntries` | `Signal<DisplayEntry[]>`               | Maps `entries` to `{ key: string; label: string; entry: PersonBankEntry }[]` applying the bank-name display rule from §3.2. |

### 4.4 DropDown Behaviour

- Each `<option>` in the `<select>` element has its `value` attribute set to the composite key
  (`userId + '|' + bankName`).
- The displayed text for each option is the `label` field from `DisplayEntry`.
- When the user changes the selection, the component updates `selectedKey`, resolves the
  matching `PersonBankEntry`, and emits `personSelected`.

---

## 5. Data Model

### 5.1 `PersonBankEntry` Interface

Declared in `src/app/core/models/growth-data.interface.ts`, alongside the existing `GrowthData`
interface. This is also the event payload type emitted by `personSelected` (see §4.2); the
`userId` field carries the person's UUID.

```typescript
export interface PersonBankEntry {
  /** UUID from profiles.id / auth.users.id */
  userId: string;
  firstName: string;
  lastName: string;
  /** Raw bank_name value from growth_data */
  bankName: string;
}
```

### 5.2 `DisplayEntry` (Internal)

An internal type used only within the component; not exported.

```typescript
interface DisplayEntry {
  /** Composite key: userId + '|' + bankName */
  key: string;
  /** Human-readable label: "First Last" or "First Last - Bank" */
  label: string;
  entry: PersonBankEntry;
}
```

---

## 6. New Service Method: `GrowthDataService.getPersonBankList()`

A new method is added to `GrowthDataService`:

```typescript
async getPersonBankList(): Promise<PersonBankEntry[]>
```

**Behaviour**:

- Queries `growth_data` via the Supabase client, selecting `user_id`, `bank_name`, and the
  related `profiles` row (`first_name`, `last_name`) via a foreign-key join on
  `growth_data.user_id → profiles.id`.
- Filters to rows where `user_id IS NOT NULL`.
- De-duplicates on the `(user_id, bank_name)` pair client-side (in case the Supabase query
  returns multiple rows for the same pair due to multiple growth periods).
- Substitutes `"Unknown"` for any `null` `first_name` and `"Person"` for any `null`
  `last_name` before mapping the row to a `PersonBankEntry`.
- Returns results mapped to `PersonBankEntry[]`, sorted by `lastName → firstName → bankName`
  ascending.
- Throws the Supabase `error` object (un-wrapped) if the query fails so that callers can
  surface the error.

---

## 7. Unit Tests

The following describes the full set of unit tests for `PersonSelectorComponent`. Tests are
written with Vitest and Angular `TestBed`; service calls are mocked with `vi.fn()`.

> **Service tests**: Any changes made to `GrowthDataService` as part of implementing this
> feature — including the new `getPersonBankList()` method and its null-name substitution
> logic — must include corresponding new or updated unit tests in `growth-data.service.spec.ts`.

### 7.1 Test Data Constants

Define the following constants at the top of the spec file (before the `describe` block):

```typescript
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
```

> `MOCK_ENTRIES` is pre-sorted in the order `getPersonBankList()` would return. The
> component does not re-sort, so all order-dependent assertions use this constant directly.

### 7.2 TestBed Configuration

Each test should configure `TestBed` with:

- `imports: [PersonSelectorComponent]`
- `providers`:
  - `{ provide: AuthService, useValue: mockAuthService }`
  - `{ provide: GrowthDataService, useValue: mockGrowthDataService }`

Both service mocks are constructed fresh in `beforeEach` using the existing
`createMockAuthService()` and `createMockGrowthDataService()` factories from
`src/app/core/testing/mock-supabase.service.ts`, then augmented with
`mockGrowthDataService['getPersonBankList'] = vi.fn().mockResolvedValue(MOCK_ENTRIES)` and
`mockAuthService['getSession'] = vi.fn().mockResolvedValue(MOCK_SESSION)` before
`TestBed.configureTestingModule` is called.

A shared `flush` helper (`const flush = () => new Promise<void>((r) => setTimeout(r, 0))`)
should be declared once at the top of the outer `describe` block.

### 7.3 Test Cases

#### Initialisation

| #   | Description                                     | Assertion                                                         |
| --- | ----------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Creates the component                           | `expect(component).toBeTruthy()`                                  |
| 2   | Calls `getPersonBankList` once on init          | `expect(mockService['getPersonBankList']).toHaveBeenCalledOnce()` |
| 3   | Calls `getSession` once on init                 | `expect(mockService['getSession']).toHaveBeenCalledOnce()`        |
| 4   | Sets `isLoading` to `false` after data loads    | `expect(component.isLoading()).toBe(false)`                       |
| 5   | `entries` signal is populated after init        | `expect(component.entries().length).toBe(MOCK_ENTRIES.length)`    |
| 6   | `errorMessage` remains empty when load succeeds | `expect(component.errorMessage()).toBe('')`                       |

#### Default Selection

| #   | Description                                                       | Assertion                                                                                                                                                |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Defaults to the current user's first sorted entry                 | `selectedEntry` has `userId === 'uuid-john'`; because John has two banks, the first alphabetically (`Edward Jones` < `Fidelity Investments`) is selected |
| 8   | When current user has only one entry, selects that entry directly | Override `MOCK_SESSION` so `user.id === 'uuid-daen'`; assert `selectedEntry` has `userId === 'uuid-daen'`                                                |
| 9   | Falls back to first sorted entry when current user has no entries | Override `MOCK_SESSION` so `user.id === 'uuid-nobody'`; assert `selectedEntry` equals the globally-first entry in sorted order                           |

#### Display Labels

| #   | Description                                                          | Assertion                                                                                                                                    |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Single-entry Fidelity person renders without bank name               | `displayEntries` entry for `uuid-daen` has `label === 'Daen Dahl'`                                                                           |
| 11  | Single-entry Fidelity person (Shelley Xie) renders without bank name | `displayEntries` entry for `uuid-shelley` has `label === 'Shelley Xie'`                                                                      |
| 12  | Multi-bank person renders each entry with bank name                  | `displayEntries` entries for `uuid-john` have labels `'John Fruehling - Edward Jones'` and `'John Fruehling - Fidelity Investments'`         |
| 13  | Person with two Fidelity variants renders each with bank name        | `displayEntries` entries for `uuid-vino` have labels `'Vino Muru - Fidelity Investments'` and `'Vino Muru - Fidelity Investments (Managed)'` |
| 14  | `displayEntries` contains the correct total count                    | `expect(component.displayEntries().length).toBe(MOCK_ENTRIES.length)`                                                                        |

#### Rendering Order

The component renders entries in the order provided by `getPersonBankList()` without
re-sorting. Tests 15 and 17 use MOCK_ENTRIES (pre-sorted) and verify the component mirrors
that order in `displayEntries`.

| #   | Description                                                                            | Assertion                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | First `displayEntries` entry is Daen Dahl; last is Shelley Xie                         | `displayEntries()[0].entry.lastName === 'Dahl'` and `displayEntries()[displayEntries().length - 1].entry.lastName === 'Xie'`                                                                                                                              |
| 16  | `<select>` has `id="person-selector"` and is linked to a visible `<label>`             | `querySelector('select#person-selector')` is not null; `querySelector('label[for="person-selector"]')` is not null and its `textContent` trims to `'Select Member'`                                                                                       |
| 17  | Both Vino Muru entries render in service-provided order                                | The `displayEntries()` entry for `'Fidelity Investments'` precedes the entry for `'Fidelity Investments (Managed)'`                                                                                                                                       |
| 18  | When `getPersonBankList` returns `[]`, renders `'No players found'` with no `<select>` | In a nested `describe` override the mock with `vi.fn().mockResolvedValue([])`, create the component, call `flush()` and `detectChanges()`; assert `querySelector('p')?.textContent` contains `'No players found'` and `querySelector('select')` is `null` |

#### Output Event

| #   | Description                                                             | Assertion                                                                                                                        |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 19  | `personSelected` is emitted once after default selection is applied     | Subscribe to `personSelected` output; after `flush()` and `detectChanges()`, verify emit count is 1                              |
| 20  | Default selection event payload contains correct userId                 | Emitted event has `userId === 'uuid-john'` (with `MOCK_SESSION` defaulting to John)                                              |
| 21  | Default selection event payload contains correct firstName and lastName | Emitted event has `firstName === 'John'` and `lastName === 'Fruehling'`                                                          |
| 22  | Default selection event payload contains correct bankName               | Emitted event has `bankName === 'Edward Jones'` (first alphabetically for John)                                                  |
| 23  | Changing the `<select>` value emits `personSelected` again              | Trigger a `change` event on the `<select>` element with a different option value; assert a second emit with the new entry's data |
| 24  | Event payload after user change reflects the newly selected entry       | After selecting Daen Dahl, emitted event has `userId === 'uuid-daen'`, `bankName === 'Fidelity Investments'`                     |

#### DOM / Template

| #   | Description                                                                      | Assertion                                                                                                      |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 25  | `<select>` element is present in the DOM                                         | `fixture.nativeElement.querySelector('select')` is not null                                                    |
| 26  | Renders the correct number of `<option>` elements                                | `querySelectorAll('option').length === MOCK_ENTRIES.length`                                                    |
| 27  | Option text for Daen Dahl is `"Daen Dahl"`                                       | Check `textContent` of the corresponding `<option>`                                                            |
| 28  | Option text for John Fruehling Edward Jones is `"John Fruehling - Edward Jones"` | Check `textContent` of the corresponding `<option>`                                                            |
| 29  | Loading state renders a disabled select or loading indicator                     | While `isLoading()` is `true`, the `<select>` has the `disabled` attribute OR a loading placeholder is visible |
| 30  | Error banner is visible when `errorMessage` is non-empty                         | Set `component.errorMessage.set('Load failed')`, call `detectChanges()`, assert error banner text in DOM       |
| 31  | Error banner is not in DOM when `errorMessage` is empty                          | After successful load, assert no error banner element in DOM                                                   |

#### Error Handling

| #   | Description                                                           | Assertion                                                                                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 32  | Sets `errorMessage` when `getPersonBankList` rejects                  | Override mock to `vi.fn().mockRejectedValue(new Error('DB error'))`; after flush, `component.errorMessage()` is non-empty |
| 33  | `isLoading` is reset to `false` even when `getPersonBankList` rejects | Same as above; assert `component.isLoading()` is `false`                                                                  |
| 34  | `entries` remains empty when load fails                               | Same as above; assert `component.entries()` is `[]`                                                                       |
| 35  | `personSelected` is not emitted when load fails                       | Override mock to reject; after flush, assert no emit occurred                                                             |

---

## 8. Out of Scope

- Multi-select (selecting more than one person at a time).
- Search / filter within the dropdown.
- Creating, editing, or deleting persons from within this component.
- Reacting to real-time changes in `growth_data` (no Supabase subscription).
- Rendering the full list of historical growth data for the selected person.
