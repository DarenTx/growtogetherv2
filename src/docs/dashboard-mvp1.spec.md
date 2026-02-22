# Dashboard MVP 1 — Product Specification

## 1. Objective

Provide all registered users with a single-page annual growth dashboard showing each member's month-by-month growth performance for the current calendar year. The MVP presents data in a clean, sortable grid—one row per user, one column per month—so that any member can quickly compare results across the group at a glance.

---

## 2. Audience

- **Primary users**: All registered members of the Grow Together application.
- **Access control**: Requires an authenticated session with `registration_complete = true`. The route is protected by the existing `authGuard` and `registrationGuard`. Admin users see the same view with the addition of admin navigation links above the grid.
- **Device context**: Desktop-first layout (wide table). On narrow viewports the table scrolls horizontally within a scroll container.

---

## 3. Supported Functionality

### 3.1 Annual Growth Grid

- Displays **one row per user profile** (all profiles visible to registered users via RLS).
- **Columns**: Name (fixed) followed by Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec for the current calendar year. All twelve month columns are always rendered, regardless of whether data exists.
- The **Name column** displays in "Last, First" format.
- **Monthly cells** display the user's `growth_pct` value formatted to two decimal places:
  - Positive values show a `+` prefix: `+3.75%`
  - Negative values show no prefix: `-1.20%`
  - Zero shows `+0.00%`
  - No data for that user/month shows an em dash: `—`
- If a user has multiple `growth_data` rows for the same month (e.g. different banks), the first record returned is displayed. Full multi-bank breakdown is out of scope for this MVP.

### 3.2 Sorting

- **Default sort**: Alphabetical ascending by last name; first name is used as a tiebreaker.
- **Column sort**: Clicking any column header toggles the sort for that column between ascending and descending.
- **Sort indicator**: The active sort column appends `▲` (ascending) or `▼` (descending) to the header label. Inactive column headers show no indicator.
- **Null handling**: Users with no data value for a sorted month column always sort to the bottom, regardless of sort direction.

### 3.3 Data Loading

- All profiles and all current-year growth data are fetched in parallel on component initialisation using `Promise.all`.
- A "Loading…" state is displayed while data is in flight.
- If any fetch error occurs, an inline error message replaces the table. The error message shows the underlying error text when available.

### 3.4 Admin Navigation

- For users with `is_admin = true`, the existing admin navigation links (Enter Profiles, Enter Market Data, Enter Historical Data) are displayed above the grid.
- Non-admin users do not see these links.

---

## 4. Out of Scope (MVP 1)

- Historical year selection (prior calendar years).
- Per-user detail / drill-down view.
- Multi-bank breakdown within a single cell.
- Market index benchmark comparison columns.
- Pagination, search, or filter controls.
- Edit or delete capabilities from the dashboard grid.

---

## 5. Data Model & Join Strategy

| Concern               | Detail                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| User rows             | All rows from the `profiles` table (visible to registered users via RLS)   |
| Monthly values        | Rows from `growth_data` filtered server-side to `year = current_year`      |
| Profile–growth join   | `growth_data.email_key` matched against `profiles.email` (both lowercased) |
| Current year constant | Derived from `new Date().getFullYear()` at component initialisation        |
