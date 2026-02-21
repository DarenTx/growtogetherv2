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

## 4. Constraints & Principles

- Simple over Secure: Prioritize frictionless UX. No dollar amounts, SSNs, or other sensitive identifiers are stored.
- No Discovery Logic: No account discovery tools (e.g., "Forgot Email"). Users must use assigned credentials to see history.
- Magic Links Only: Authentication exclusively via clickable Magic Links sent to Email or SMS.

## 5. Logic Flows

### 5.1 Legacy Data Matching

- Key: Email address is used to connect historical records.
- Claim: A user must log in via email at least once to "claim" their 15-year history.
- Evolution: Once a phone number is provided and the account is marked "Linked", that phone number becomes a valid identifier for future Magic Link logins.

### 5.2 Registration (New Users)

- Fields required: First Name, Last Name, Email, Phone, Invitation Code (all mandatory).
- Invitation Code: Verified against the database. If invalid, show:
  > "Invalid invitation code. Please contact the administrator."
- Verification State: Email and Phone remain "unverified" until the user completes a Magic Link login with that credential.

### 5.3 Login Step 1: Entry Point (Universal Input)

- Input: Single field labeled "Email or Phone Number".
- Logic:
  - Identifier Found: Trigger Magic Link (Email or SMS).
  - Phone Not Found:
    - If ANY unclaimed historical data exists in the system (i.e., any `growth_data` rows where `user_id IS NULL`): show
      > "Phone number not recognized. If you have historical data, please login with your email address first to link your account."
    - If all historical data is already claimed (i.e., all `growth_data` rows have a non-null `user_id`): treat as "User not found" and prompt to register.
  - Email Not Found: Treat as a new user (empty state) or redirect to Register.

**Note:** The unclaimed data check is system-wide, not specific to the entered phone number. This ensures that users with legacy data are always directed to authenticate with their email first to claim their history. Once all legacy data has been claimed by users, this check can be bypassed entirely.

### 5.4 Login Step 2: Verification

- Method: All users authenticate via a Magic Link.
- Email: Link sent to inbox.
- Phone: Link sent via SMS.
- Action: Clicking the link automatically authenticates the session and redirects the user into the PWA.

### 5.5 Login Step 3: Initialization & Profile Completion

- When: Immediately after the first successful login for an unlinked account where historical data was found.
- Screen: "Complete Your Profile."
- Pre-population: First Name, Last Name, and Email are pre-filled from the legacy dataset.
- User Action: User must enter Phone Number (required) and may update pre-filled fields.
- Result: Account is marked "Linked" in the database.
- Bypass: If already linked, user is redirected straight to the Dashboard.

# Dashboard

The dashboard requirements are currently unknown.
