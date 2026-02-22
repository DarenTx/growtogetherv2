# Admin Pages — Product Specification

## 1. Objective

Provide a set of protected admin-only pages that allow the application administrator to quickly enter data ahead of user onboarding. The admin pages cover three data domains: user profile placeholders, market benchmark indexes, and historical per-user growth records. These pages are intended for direct, rapid data entry by a single trusted administrator and are not part of the end-user experience.

---

## 2. Audience

- **Primary user**: Application administrator (a single individual with `is_admin = true` in the `profiles` table).
- **Access method**: Authenticated session with the `is_admin` flag set to `true` in the database. Admin status is granted by direct SQL update and cannot be self-assigned through the application.
- **Device context**: Desktop browser assumed for admin data entry; mobile-responsive layout is still required for consistency.

---

## 3. Architecture Decisions & Justification

### 3.1 Route Guard

The three admin pages are placed under a shared `/admin` parent route. The existing `adminGuard` (already implemented but previously unattached to any route) is applied to this parent. Any unauthenticated user is redirected to `/login`; any authenticated non-admin is redirected to `/dashboard`. Child routes inherit the guard automatically.

**Constraint — admin profile must have a matching auth UUID**: The `is_admin_user()` RLS helper function checks `WHERE id = auth.uid()`. This means the admin's own `profiles.id` must equal their Supabase Auth UUID. The current admin profile was created before the FK removal and already satisfies this condition. Any future admin must have a real auth user, and their `profiles.id` must be manually set to their auth UUID. Admin status cannot be granted to a placeholder profile.

### 3.2 Conditional Dashboard Navigation

Admin navigation links are rendered inside the existing dashboard component and hidden for non-admin users using Angular's `@if` control flow against a computed `isAdmin` signal. This keeps admin entry points invisible to regular users without requiring a separate layout or shell.

### 3.3 Profile Creation — Placeholder Approach

**Decision**: Profiles are inserted as placeholders with no backing Supabase Auth user. `profiles.id` is a standalone `UUID PRIMARY KEY DEFAULT gen_random_uuid()` with no FK to `auth.users`.

**Justification**: The application is in a data-entry phase. Real users do not yet have accounts. Requiring an auth user before a profile can exist would force the use of a Supabase Edge Function with a service-role key (a security risk if invoked from the browser) or a fake email invite (a UX anti-pattern). The current schema allows profiles to be created immediately with real data.

**Future onboarding** (out of scope for this phase): When ready to invite a user, a Supabase Edge Function (running server-side with the service-role key) will call `supabase.auth.admin.inviteUserByEmail()`, create the auth user, and update `profiles.id` to match the returned UUID. No service-role key is ever exposed in the browser.

### 3.4 `growth_data.user_id` as Nullable

`growth_data.user_id` is a nullable FK to `auth.users(id)` and is inserted as `null` for placeholder profiles. The `email_key` field carries the profile association until onboarding is complete and `user_id` can be backfilled.

### 3.5 Direct Supabase Insert (No RPC)

Profile and growth data inserts use the Supabase JavaScript client's `.insert()` method directly. Row Level Security (RLS) policies enforce access control at the database level, making a stored procedure (RPC) unnecessary for these straightforward CRUD operations. RPC is reserved for operations requiring elevated privileges or multi-table transactions.

### 3.6 Duplicate Handling — Silent Upsert

**Decision**: Submitting a record that matches an existing row's natural key silently overwrites the existing `growth_pct` value with no warning or confirmation prompt.

- `market_indexes` natural key: `(index_name, year, month)`
- `growth_data` natural key: `(email_key, bank_name, year, month)`

Both tables have unique constraints on their natural keys. The Supabase upsert (`ON CONFLICT ... DO UPDATE`) targets these constraints. The existing audit log captures old and new values on every update, providing a full history of overwrites.

**Justification**: This is a single-admin, rapid data-entry workflow. The auto-increment month/year behavior and the live data list displayed below each form give the admin sufficient visibility to avoid accidental re-entry. A confirmation dialog would disrupt the entry flow without meaningful benefit in this context.

## 4. Route Structure

| Path                     | Component                      | Guard                 |
| ------------------------ | ------------------------------ | --------------------- |
| `/admin`                 | (parent, no UI)                | `adminGuard`          |
| `/admin/profiles`        | `EnterProfilesComponent`       | inherits `adminGuard` |
| `/admin/market-data`     | `EnterMarketDataComponent`     | inherits `adminGuard` |
| `/admin/historical-data` | `EnterHistoricalDataComponent` | inherits `adminGuard` |

All three child routes are lazy-loaded standalone components.

---

## 5. Dashboard Admin Navigation

**Location**: `DashboardComponent` template, visible only when `isAdmin()` is `true`.

**Behavior**:

- A non-admin user sees no admin links in the dashboard.
- An admin user sees three navigation links:
  - **Enter Profiles** → `/admin/profiles`
  - **Enter Market Data** → `/admin/market-data`
  - **Enter Historical Data** → `/admin/historical-data`

**Implementation notes**:

- `isAdmin` is a `computed` signal derived from `profile()?.is_admin ?? false`.
- Links use `RouterLink` (imported into the `DashboardComponent` imports array).
- Visibility is controlled by `@if (isAdmin())` in the template.

---

## 6. Page: Enter Profiles (`/admin/profiles`)

### 6.1 Purpose

Allow the administrator to create placeholder user profiles before those users have Supabase Auth accounts. This enables market and historical data to be associated with real people via `email_key` while onboarding is deferred. Under the form display a list of current user profiles showing first name, last name, and email, sorted by `created_at` descending (most recently created first).

### 6.2 Form Fields

| Field      | Input Type | DB Column             | Validation                   |
| ---------- | ---------- | --------------------- | ---------------------------- |
| First Name | Text       | `profiles.first_name` | Required                     |
| Last Name  | Text       | `profiles.last_name`  | Required                     |
| Email      | Email      | `profiles.email`      | Required, valid email format |

### 6.3 Hidden / Auto-set Fields

| DB Column                   | Value               | Source                           |
| --------------------------- | ------------------- | -------------------------------- |
| `id`                        | Auto-generated UUID | `gen_random_uuid()` (DB default) |
| `email_verified`            | `false`             | DB default                       |
| `phone_verified`            | `false`             | DB default                       |
| `is_admin`                  | `false`             | DB default                       |
| `registration_complete`     | `false`             | DB default                       |
| `phone`                     | `null`              | Not set during admin entry       |
| `created_at` / `updated_at` | Current timestamp   | DB default                       |

### 6.4 Behavior

- On successful submit: display an inline success message, clear all form fields so the next profile can be entered immediately. Update the list of current profiles.
- On error: display an inline error message with the error detail; do not clear the form.
- No navigation away from the page on success — the admin stays on the form for rapid sequential entry.

### 6.5 Service Methods

- `supabase.adminCreateProfile(data: { first_name: string; last_name: string; email: string }): Promise<void>` — direct `.insert()` into `profiles`. Throws on error.
- `supabase.getAllProfiles(): Promise<Profile[]>` (shared with §8) — called on init to populate the profile list, and called again after each successful submit to refresh the list.

---

## 7. Page: Enter Market Data (`/admin/market-data`)

### 7.1 Purpose

Allow the administrator to enter benchmark market index records (e.g. S&P 500 monthly growth) that are used as comparison data in the user-facing dashboard. Under the form list all rows from the `market_indexes` table, sorted by `created_at` descending (most recently created first).

### 7.2 Form Fields

| Field          | Input Type        | DB Column                   | Validation                                                           |
| -------------- | ----------------- | --------------------------- | -------------------------------------------------------------------- |
| Index Name     | Select (dropdown) | `market_indexes.index_name` | Required; fixed options: `S&P 500`, `Dow Jones` (no free-text entry) |
| Year           | Number            | `market_indexes.year`       | Required, integer, 2001–2100                                         |
| Month          | Number            | `market_indexes.month`      | Required, integer, 1–12                                              |
| Growth Percent | Decimal           | `market_indexes.growth_pct` | Required, decimal (up to 2 decimal places, e.g. `7.43`)              |

### 7.3 Behavior

- On successful submit: display an inline success message, clear the Growth Percent field, then advance the month/year by one month (month 12 rolls to month 1 of the following year). Update the list of market data rows below the form.
- On error: display an inline error message; do not clear the form.
- Include a "Clear All" button that resets all form fields.
- No navigation away on success.

### 7.4 Service Methods

- `supabase.saveMarketIndex(marketIndex: Partial<MarketIndex>): Promise<void>` (existing — upsert). Called on submit.
- `supabase.getMarketIndexes(): Promise<MarketIndex[]>` (existing) — called on init to populate the list below the form, and called again after each successful submit to refresh it.

---

## 8. Page: Enter Historical Data (`/admin/historical-data`)

### 8.1 Purpose

Allow the administrator to enter per-user historical growth records. Each record associates a dollar amount's growth percentage in a specific bank account for a specific month to a specific user profile.

### 8.2 Profile Dropdown

- Populated on component init by calling `supabase.getAllProfiles()`.
- Shows **all** profiles regardless of `registration_complete` status.
- Display format per option: `{first_name} {last_name} — {email}`
- Value: profile `id` (UUID)
- On selection: the component internally sets `email_key` from the selected profile's `email` field and sets `user_id` to `null` (placeholder profiles have no auth user).
- The growth data list below the form is hidden until a profile is selected. Once selected, load and display all growth data for that profile.

### 8.3 Form Fields

| Field          | Input Type        | DB Column                         | Validation                                                                                                                                       |
| -------------- | ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Profile        | Select (dropdown) | derives `email_key` and `user_id` | Required                                                                                                                                         |
| Year           | Number            | `growth_data.year`                | Required, integer, 2001–2100                                                                                                                     |
| Month          | Number            | `growth_data.month`               | Required, integer, 1–12                                                                                                                          |
| Bank Name      | Select (dropdown) | `growth_data.bank_name`           | Required; fixed options: `Fidelity Investments`, `Edward Jones`; pre-filled with `Fidelity Investments` on page load; persists after each submit |
| Is Managed     | Checkbox / Toggle | `growth_data.is_managed`          | Defaults to `false`; persists after each submit                                                                                                  |
| Growth Percent | Decimal           | `growth_data.growth_pct`          | Required, decimal (up to 2 decimal places)                                                                                                       |

### 8.4 Hidden / Auto-set Fields

| DB Column                   | Value                      | Source                                 |
| --------------------------- | -------------------------- | -------------------------------------- |
| `email_key`                 | Selected profile's `email` | Derived on profile selection           |
| `user_id`                   | `null`                     | Placeholder profiles have no auth user |
| `id`                        | Auto-generated UUID        | `gen_random_uuid()` (DB default)       |
| `created_at` / `updated_at` | Current timestamp          | DB default                             |

### 8.5 Behavior

- On init: fetch all profiles and populate the Profile dropdown. Show a loading indicator while fetching. If the fetch fails, show an error and **disable the form** until a successful reload.
- On successful submit: display an inline success message; clear only the Growth Percent field; leave Profile, Year, Month, Bank Name, and Is Managed unchanged; advance Year/Month by one month (month 12 rolls to month 1 of the following year); update the growth data list for the selected profile.
- Include a "Clear All" button that resets all fields to their defaults (Profile cleared, Year/Month reset, Bank Name reset to `Fidelity Investments`, Is Managed reset to `false`, Growth Percent cleared).
- On submit error: display an inline error message; do not clear any fields.
- No navigation away on success.

### 8.6 Service Methods

- `supabase.getAllProfiles(): Promise<Profile[]>` (new method — no filter, all rows).
- `supabase.saveGrowthData(growthData: Partial<GrowthData>): Promise<void>` (existing method — upsert).

---

## 9. Verification Criteria

| Scenario                                                  | Expected Result                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Non-admin navigates to `/admin/profiles`                  | Redirected to `/dashboard`                                                                   |
| Unauthenticated user navigates to `/admin/profiles`       | Redirected to `/login`                                                                       |
| Admin navigates to `/admin/profiles`                      | Form renders; profile list loads sorted by `created_at` DESC                                 |
| Admin submits valid profile data                          | Success message shown, form clears, profile list updates                                     |
| Admin submits profile with invalid email                  | Validation error shown, form not submitted                                                   |
| Admin navigates to `/admin/market-data`                   | Form renders; market data list loads sorted by `created_at` DESC                             |
| Admin submits valid market data                           | Success message shown, Growth Percent cleared, month/year advance by one month, list updates |
| Admin submits market data with month = 13                 | Blocked by validation; month input constrains to 1–12                                        |
| Admin submits market data with year outside 2001–2100     | Validation error shown, form not submitted                                                   |
| Admin submits market data for December                    | Month resets to 1, year increments by 1                                                      |
| Admin navigates to `/admin/historical-data`               | Profile dropdown populates; growth data list hidden until profile selected                   |
| Admin selects a profile                                   | Growth data list becomes visible for that profile                                            |
| Profile fetch fails on historical data page               | Error shown, form disabled                                                                   |
| Admin submits valid historical data                       | Success message shown, Growth Percent cleared, year/month advance by one month, list updates |
| Admin submits historical data for December                | Month resets to 1, year increments by 1                                                      |
| Admin submits historical data without selecting a profile | Validation error shown, form not submitted                                                   |
| Admin submits historical data with year outside 2001–2100 | Validation error shown, form not submitted                                                   |
| Admin clicks "Clear All" on market data page              | All fields reset                                                                             |
| Admin clicks "Clear All" on historical data page          | All fields reset to defaults (Bank Name → `Fidelity Investments`, Is Managed → `false`)      |
| Dashboard viewed as non-admin                             | No admin nav links visible                                                                   |
| Dashboard viewed as admin                                 | Three admin nav links visible and functional                                                 |

---

## 10. Out of Scope (This Phase)

- User onboarding Edge Function (creating auth users from placeholder profiles)
- Backfilling `growth_data.user_id` after onboarding
- Editing or deleting existing profiles, market data, or historical data via the admin UI
- Pagination or search on any admin form
- Admin user management (granting/revoking `is_admin`)
