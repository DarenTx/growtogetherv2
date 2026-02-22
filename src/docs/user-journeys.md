# User Journey Analysis — Historical Growth Tracker

This document describes the logic flow for three user personas using the Supabase schema and Magic Link authentication strategy.

## Overview

The app is a Progressive Web App (PWA) that shows historical growth data. The authorization and access rules depend on the `profiles` table and the `registration_complete` flag. Legacy data is matched by email and claimed on first successful registration.

## User Personas

### 1. Brand New User (No Historical Data)

This user has an invitation code but no prior records in the system.

1. Entry
   - User enters their email or phone number on the login screen.
2. Authentication
   - Supabase sends a Magic Link. The user clicks the link and is redirected back to the app.
3. Shell Creation
   - A database trigger (`handle_new_auth_user`) creates a shell row in `public.profiles` with the user's ID and identifier (email/phone). `registration_complete` defaults to `false`.
4. Lockout State
   - Because `registration_complete` is `false`, Row Level Security (RLS) prevents this user from seeing peer `growth_data` or `market_indexes`.
5. Registration Form
   - The Angular app detects the incomplete profile and displays a required form with the following fields:
     - First Name
     - Last Name
     - Phone/Email
     - Invitation Code
6. Validation
   - User enters the invitation code (example: "Fruehling"). The app calls the `complete_registration` RPC which:
     - Validates the invitation code.
     - Updates the `profiles` row and sets `registration_complete = true`.
     - Searches `growth_data` for a matching `email_key` (finds none for this persona) so `is_linked` remains `false`.
7. Dashboard
   - User is redirected to the dashboard. Personal charts are empty, but peer names and growth percentages are visible because RLS access is granted.

### 2. Legacy User (First Time Logging In)

This user has 15 years of pre-loaded data in `growth_data` under their email address but has not used the app previously.

1. Entry
   - User enters the email address associated with their historical data.
2. Authentication
   - User clicks the Magic Link and authenticates.
3. Shell Creation
   - A shell profile is created (`registration_complete` is `false`).
4. Registration Form
   - User is prompted for details and the invitation code.
5. Validation & Data Claiming
   - User enters the invitation code (example: "Fruehling") and details. The app calls `complete_registration`, which:
     - Validates the invitation code.
     - Finds all rows in `growth_data` where `email_key` matches the user's email and `user_id` is `NULL`.
     - Updates those rows setting `user_id` to the current user's UUID.
     - Sets `is_linked = true` and `registration_complete = true`.
6. Dashboard
   - User is redirected to the dashboard with their 15-year historical chart and monthly YTD data visible alongside peer comparisons.

### 3. Returning User

This user has already completed registration and linked their account.

1. Entry
   - User enters their email or phone number.
2. Authentication
   - User clicks the Magic Link and authenticates.
3. Verification
   - The Angular app checks `profiles` and sees `registration_complete = true`.
4. Bypass
   - The app skips registration/profile completion screens.
5. Dashboard
   - The user lands directly on the dashboard.
6. RLS Check
   - Since `registration_complete` is `true`, the SELECT policies for `profiles`, `growth_data`, and `market_indexes` allow immediate data retrieval.
7. Update Visibility
   - The user sees any new monthly YTD updates the admin has added since their last visit.

## Notes & Key Fields

- Primary matching key for legacy data: `email_key` in `growth_data`.
- Profile flag that gates access: `registration_complete` (boolean).
- Linking indicator: `is_linked` (boolean) and `growth_data.user_id` referencing `profiles.id`.

> Invalid invitation code message shown to users:
>
> "Invalid invitation code. Please contact the administrator."

## Summary

- New users must complete registration to gain access to peer data.
- Legacy users claiming pre-loaded data will have historical rows linked to their account on first registration.
- Returning users bypass registration and go straight to the dashboard once `registration_complete` is true.
