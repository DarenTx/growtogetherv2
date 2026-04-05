# Historical Growth Tracker PWA — Product Specification

## 1. Objective

Provide a mobile-first Progressive Web App (PWA) for a small, specialized group of users to view 15 years of personalized, anonymized historical growth data. The app is a lightweight utility for tracking performance and does not store sensitive PII.

## 2. Audience & Technical Profile

- User Base: Small, closed group of individuals personally known by the administrator.
- Device Support: Primarily mobile; must work on desktop browsers.
- Platform Experience: Responsive PWA that feels native when installed and fully functional as a standard web app.

## 3. Tech Stack

- Frontend: Angular (configured as a PWA)
- Backend/Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth (GoTrue) using Magic Links via Email and SMS
- Hosting: GitHub Pages

## 4. Supabase Configuration Requirements

### 4.1 SMS Provider Setup

**Requirement**: SMS Magic Links require configuration of a third-party SMS provider in Supabase.

- **Supported Providers**: Twilio, MessageBird, Vonage, Textlocal, or other Supabase-compatible SMS providers.
- **Configuration Location**: Supabase Dashboard → Authentication → Providers → Phone
- **SMS Template Configuration**:
  - Use `{{ .ConfirmationURL }}` in the SMS message template to send a clickable Magic Link.
  - **Do NOT use** `{{ .Token }}` (sends a 6-digit OTP code instead of a link).

**Example SMS Template**:

```
Click here to log in to Grow Together: {{ .ConfirmationURL }}
```

**Important**: Both email and SMS authentication will use clickable Magic Links for a consistent user experience. No OTP codes are used in this application.

## 5. Data Validation

### 5.1 Email Validation

- **Format**: Standard email address format (local-part@domain.tld)
- **Client-side**: Use browser native email input validation
- **Server-side**: Database constraint ensures valid format
- **Case Sensitivity**: Emails are case-insensitive; store in lowercase

**Examples**:

- ✅ Valid: `user@example.com`, `john.doe@company.co.uk`
- ❌ Invalid: `invalid.email`, `@example.com`, `user@`

### 5.2 Phone Number Validation

- **Storage Format**: E.164 international phone number format (required for SMS delivery)
- **Structure**: `+[country code][subscriber number]`
- **Length**: Up to 15 digits (including country code)
- **Default Country**: USA (`+1`) is assumed if no country code is provided
- **Client-side**: Normalize user input to E.164 before submission
- **Server-side**: Database constraint enforces E.164 format

**User Input** (flexible, user-friendly):

- **USA users can enter**:
  - `2125551234` → normalized to `+12125551234`
  - `(212) 555-1234` → normalized to `+12125551234`
  - `212-555-1234` → normalized to `+12125551234`
  - `212.555.1234` → normalized to `+12125551234`
- **International users should enter**:
  - `+442071234567` (with `+` and country code)
  - `442071234567` (country code without `+`) → normalized to `+442071234567`

**Database Storage** (E.164 format with `+`):

- ✅ Valid: `+12125551234` (USA), `+442071234567` (UK), `+61412345678` (Australia)

**Invalid Format Handling**:

- If the phone number cannot be parsed or normalized, display an error message:
  > "Invalid phone number. Please enter a valid phone number."
- Below the error, show format examples:
  > "Examples: (212) 555-1234 or +44 20 7123 4567"
- Do not submit the form until a valid, parseable phone number is entered.

**Implementation Notes**:

- Use a phone number formatting library (e.g., `libphonenumber-js`) to handle parsing and normalization
- Display formatted numbers in the UI but store E.164 format in the database
- SMS provider will use the E.164 format for message delivery

## 6. Constraints & Principles

- Simple over Secure: Prioritize frictionless UX. No dollar amounts, SSNs, or other sensitive identifiers are stored.
- No Discovery Logic: No account discovery tools (e.g., "Forgot Email"). Users must use assigned credentials to see history.
- Magic Links Only: Authentication exclusively via clickable Magic Links sent to Email or SMS.

## 7. Logic Flows

### 7.1 Legacy Data Matching

- Key: Email address is used to connect historical records.
- Claim: A user must log in via email at least once to "claim" their 15-year history.
- Evolution: Once a phone number is provided and the account is marked "Linked", that phone number becomes a valid identifier for future Magic Link logins.

### 7.2 Registration & Profile Completion

- Fields required: First Name, Last Name, Email, Phone, Invitation Code (all mandatory).
- Invitation Code: Verified server-side by the database function. If invalid, show:
  > "Invalid invitation code. Please contact the administrator."
- Operation Type:
  - **New Users (No Legacy Data)**: This is an INSERT operation creating a new profile record.
  - **Legacy Users (Pre-populated Data)**: This is an UPDATE operation modifying an existing profile record that was manually loaded before first login.
- Verification State:
  - Magic Link authentication verifies only the credential used for login.
  - Email Magic Link → `email_verified = true`
  - SMS Magic Link → `phone_verified = true`
  - Both credentials are verified only after the user has successfully logged in using both methods at least once.

### 7.3 Login Step 1: Entry Point (Universal Input)

- Input: Single field labeled "Email or Phone Number".
- Placeholder text: "Enter your email or phone number"
- Help text displayed below the input field:
  > **Examples:**
  > • Email: user@example.com
  > • USA Phone: (212) 555-1234 or 2125551234
  > • International: +44 20 7123 4567
- Logic:
  - User enters email or phone number in any common format.
  - Client validates and normalizes phone numbers to E.164 format before sending to Supabase.
  - If phone format is invalid, show error: "Invalid phone number. Please enter a valid phone number."
  - Supabase sends a Magic Link via Email or SMS based on the identifier type.

**Note:** Users with legacy data should use their email address on first login to claim their historical records. Phone authentication can be used after the account is linked.

### 7.4 Login Step 2: Verification

- Method: All users authenticate via a Magic Link.
- Email: Link sent to inbox.
- Phone: Link sent via SMS.
- Action: Clicking the link automatically authenticates the session and redirects the user into the PWA.
- Expired Link Handling:
  - If the Magic Link has expired, display an error page with the message:
    > "This link has expired. Please request a new one."
  - Provide a button to return to the login page to request a new Magic Link.

### 7.5 Login Step 3: Registration & Profile Completion

- When: Immediately after the first successful Magic Link authentication if `registration_complete = false`.
- Screen: "Complete Your Profile."
- Pre-fill Logic:
  - **If authenticated credential exists in `profiles` table** (legacy user or returning incomplete registration):
    - Pre-fill First Name, Last Name, Email, and Phone from the existing `profiles` record.
    - User may update pre-filled fields.
  - **If authenticated credential does NOT exist in `profiles` table** (brand new user):
    - Pre-fill only the Email or Phone field with the credential used during Magic Link authentication.
    - User must enter all other required fields.
- Required Fields: First Name, Last Name, Email, Phone, Invitation Code (all mandatory).
- Phone Field Guidance:
  - Display help text: \"USA: (212) 555-1234 or 2125551234 | International: +44 20 7123 4567\"
  - Validate and normalize to E.164 format on blur or submit
  - Show error if invalid: \"Invalid phone number. Please enter a valid phone number.\"
- Invitation Code: All users must enter and validate the invitation code regardless of profile pre-population status.
- Result:
  - Account is marked `registration_complete = true`.
  - If historical growth data exists with matching email, it is claimed (linked to user's account via `user_id`).
- Bypass: If `registration_complete = true`, user is redirected straight to the Dashboard.

## 8. Admin Role

### 8.1 Admin Designation

- The application supports a single administrator role.
- Admin status is controlled by the `is_admin` boolean column in the `profiles` table.
- The admin flag is set manually via direct database update after the admin completes registration:
  ```sql
  UPDATE profiles SET is_admin = true WHERE email = 'admin@example.com';
  ```

### 8.2 User Permissions

**Regular Users** (after registration is complete):

- **View All Data**: Can view all profiles, all growth data, and all market indexes.
- **Manage Own Profile**: Can UPDATE their own `profiles` record.
- **Manage Own Growth Data**: Can INSERT, UPDATE, and DELETE their own records in the `growth_data` table (where `user_id` matches their account).

**Administrator** (additional capabilities beyond regular user permissions):

- **Manage All Growth Data**: Can INSERT, UPDATE, and DELETE any record in the `growth_data` table (for data correction and legacy data entry).
- **Manage Market Indexes**: Exclusive permission to INSERT, UPDATE, and DELETE records in the `market_indexes` table for benchmark data.
- **Manage Any User Profile**: Can UPDATE any user's `profiles` record for user support purposes.

### 8.3 Admin UI

- Admin-specific UI features will be defined during implementation.
- Admin screens will be conditionally displayed based on the `is_admin` flag in the user's profile.

# Dashboard

The dashboard requirements are currently unknown.

## 9. Angular Implementation Requirements

The following items must be addressed during Angular development:

### 9.1 Authentication Callback Route

**Requirement**: Implement a route to handle Supabase Magic Link redirects.

- **Route Path**: `/auth/callback` (or similar)
- **Purpose**: Intercept the authentication token from the URL fragment after user clicks Magic Link
- **Implementation Steps**:
  1. Create a dedicated callback component/route
  2. Call `supabase.auth.exchangeCodeForSession()` to exchange the token for a session
  3. Check user's `registration_complete` status
  4. Route to registration form if `registration_complete = false`
  5. Route to dashboard if `registration_complete = true`
  6. Handle errors (expired link, invalid token, etc.)

**Configuration**: Update Supabase Auth settings to redirect to this route after authentication.

### 9.2 Route Guards

**Requirement**: Implement Angular route guards to protect authenticated routes.

- **Auth Guard**: Verify user has an active Supabase session
  - Redirect unauthenticated users to login page
- **Registration Guard**: Verify user has completed registration (`registration_complete = true`)
  - Redirect incomplete registrations to profile completion form
  - Protect dashboard and other app features
- **Admin Guard** (optional): Verify user has `is_admin = true` for admin-only routes

**Protected Routes**:

- Dashboard (requires authentication + registration complete)
- Admin screens (requires authentication + registration complete + is_admin)

### 9.3 HTTP Client Configuration

**Requirement**: Add Angular HTTP client provider to support future API calls.

- **Implementation**: Add `provideHttpClient()` to [app.config.ts](../app/app.config.ts) providers array
- **Reason**: While Supabase JS client doesn't require it, any future direct HTTP calls will fail without this provider
- **Location**: `src/app/app.config.ts`

```typescript
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(), // Add this
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
```

### 9.4 Supabase Service Refactoring

**Requirement**: Refactor `SupabaseService` to expose typed methods instead of raw client.

**Current Issue**: `getClient()` returns raw `SupabaseClient`, tightly coupling components to Supabase SDK.

**Preferred Approach**: Expose domain-specific methods that wrap Supabase calls.

**Example Methods to Implement**:

```typescript
// Authentication
signInWithEmail(email: string): Promise<void>
signInWithPhone(phone: string): Promise<void>
signOut(): Promise<void>
getSession(): Promise<Session | null>
onAuthStateChange(callback: (session: Session | null) => void): Subscription

// Profile Management
getProfile(): Promise<Profile | null>
completeRegistration(data: RegistrationData): Promise<boolean>
updateProfile(profile: Partial<Profile>): Promise<void>

// Growth Data
getOwnGrowthData(): Promise<GrowthData[]>
getAllGrowthData(): Promise<GrowthData[]>
saveGrowthData(data: GrowthData): Promise<void>

// Market Indexes
getMarketIndexes(): Promise<MarketIndex[]>
saveMarketIndex(data: MarketIndex): Promise<void> // Admin only

// Utility
isAdmin(): Promise<boolean>
```

**Benefits**:

- Type safety for all Supabase operations
- Easier to test (mock the service methods)
- Decouples components from Supabase SDK
- Clear contract for data operations

### 9.5 Testing Requirements

**Requirement**: All components, services, and guards must have comprehensive unit tests with minimum 90% code coverage.

**Coverage Target**: 90% or higher across:

- Lines
- Branches
- Functions
- Statements

**Testing Framework**: Vitest (as configured in [package.json](../package.json))

**What Must Be Tested**:

- **Components**:
  - User interactions (form submissions, button clicks, navigation)
  - Conditional rendering (show/hide based on auth state, admin status, etc.)
  - Input validation (email format, phone normalization)
  - Error handling and display
  - Loading states

- **Services**:
  - All public methods in `SupabaseService`
  - Authentication flows (sign in, sign out, session management)
  - Data operations (CRUD for profiles, growth data, market indexes)
  - Error handling for failed Supabase calls
  - Phone number normalization logic

- **Guards**:
  - Auth guard (authenticated vs. unauthenticated scenarios)
  - Registration guard (complete vs. incomplete registration)
  - Admin guard (admin vs. regular user)
  - Redirect behavior for each guard

- **Utilities/Helpers**:
  - Phone number parsing and E.164 normalization
  - Email normalization (lowercase, trim)
  - Any shared validation functions

**Coverage Verification**:

```bash
npm run test -- --coverage
```

**Acceptance Criteria**:

- All tests must pass
- Code coverage report shows ≥90% for all metrics
- No critical functionality is untested
- Mock Supabase client properly in tests (don't make real API calls)

**Required Test Patterns**:

- Use `TestBed` for component and service testing
- Mock `SupabaseService` dependencies in component tests
- Mock Supabase client in service tests
- Use test fixtures for user data, profiles, and growth data
- Test both success and error paths for all async operations
