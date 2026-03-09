---
name: supabase-schema-services
description: Maintain the Supabase schema documentation, write focused Angular services that talk to Supabase, generate migration SQL, and enforce Row-Level Security policies. Use when the user wants to add or modify database tables, update schema documentation, create or refactor Supabase services, write migration files, or when any fix produces a schema-level change (new view, modified function/trigger, new RLS policy). Also apply the Section 6 checklist whenever migration SQL is generated.
---

# Supabase Schema & Services — grow-together-v2

Follow these rules whenever making Supabase-related changes in this project.

---

## 1. Updating the Schema Documentation

The canonical schema reference is **`src/docs/master-supabase.schema.sql`**.

- Update this file whenever a table, column, index, constraint, function, trigger, or RLS policy is added, changed, or removed.
- Each table section must have a numbered comment header:
  ```sql
  -- ==========================================
  -- N. TABLE_NAME TABLE
  -- ==========================================
  ```
- Always include:
  - `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()` (unless the table is append-only like audit_logs)
- Add a trailing `-- NOTE:` comment on any column or design decision that is non-obvious (see the `profiles.id` note in the existing schema).

---

## 2. Writing Migration Files

Every schema change requires a corresponding migration file in **`src/docs/migrations/`**.

**Naming convention:** `<short-kebab-description>.sql`

**File structure:**

```sql
-- Migration: <Human-readable description of what this migration does>
-- Run this against the Supabase database to apply the schema change.

-- ... your ALTER TABLE / CREATE TABLE / DROP ... statements here
```

**Rules:**

- Migrations are additive and non-destructive where possible (`ADD COLUMN`, not `DROP COLUMN` unless intentional).
- Never modify existing migration files — create a new one.
- Include `IF NOT EXISTS` / `IF EXISTS` guards where supported (e.g. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

---

## 3. Row-Level Security (RLS)

**Every new table must have RLS enabled and at least one policy before it is considered complete.**

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
```

**Reuse the existing helper functions** — do NOT duplicate their logic inline:

```sql
public.is_registered()   -- true if auth.uid() has registration_complete = true
public.is_admin_user()   -- true if auth.uid() has is_admin = true
```

**Standard policy patterns:**

| Scenario                  | Policy template                       |
| ------------------------- | ------------------------------------- |
| Registered users can read | `USING (public.is_registered())`      |
| User owns the row         | `USING (auth.uid() = user_id)`        |
| Admin can do anything     | `USING (public.is_admin_user())`      |
| Admin inserts             | `WITH CHECK (public.is_admin_user())` |

If you need a new helper function, mark it `SECURITY DEFINER STABLE` to avoid recursive RLS loops:

```sql
CREATE OR REPLACE FUNCTION public.<fn_name>()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ...);
$$;
```

Add all new policies and helper functions to `src/docs/master-supabase.schema.sql` under a `-- ROW LEVEL SECURITY` section.

---

## 4. Writing a Focused Supabase Service

Each logical domain has its own service file in `src/app/core/services/`. Do not add methods to an existing service if they belong to a different domain — create a new service instead.

**Service template:**

```typescript
import { inject, Injectable } from '@angular/core';
import { SUPABASE_CLIENT_TOKEN } from './supabase.service';
// import other services as needed (e.g. AuthService)

@Injectable({ providedIn: 'root' })
export class <Domain>Service {
  private readonly client = inject(SUPABASE_CLIENT_TOKEN);
  private readonly logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`[<Domain>Service] ${msg}`, ...args),
    info:  (msg: string, ...args: unknown[]) => console.info(`[<Domain>Service] ${msg}`, ...args),
    warn:  (msg: string, ...args: unknown[]) => console.warn(`[<Domain>Service] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`[<Domain>Service] ${msg}`, ...args),
  };

  async getSomething(): Promise<SomeType[]> {
    this.logger.debug('Fetching something');
    const { data, error } = await this.client
      .from('<table>')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('getSomething failed', error);
      throw error;
    }
    this.logger.debug(`Fetched ${(data ?? []).length} rows`);
    return (data ?? []) as SomeType[];
  }
}
```

**Rules:**

- Always inject `SUPABASE_CLIENT_TOKEN`, never instantiate a client directly.
- Always destructure `{ data, error }` — never ignore the `error` field.
- On error: log with `this.logger.error(...)` then `throw error` (let the caller/component decide how to surface it).
- Handle known non-error Supabase codes inline (e.g. `PGRST116` = row not found → return `null` instead of throwing).
- Return typed values using `as TypeName` casts — keep return types explicit on every method.
- Log entry/exit of meaningful operations with `debug` or `info`.
- If the operation requires an authenticated user, inject `AuthService` and call `this.auth.getSession()` first; return `null` / early-exit if no session.

---

## 5. Updating the Interface Model

When a table column is added or changed, update the corresponding TypeScript interface in `src/app/core/models/`:

| Table            | Interface file              |
| ---------------- | --------------------------- |
| `profiles`       | `profile.interface.ts`      |
| `growth_data`    | `growth-data.interface.ts`  |
| `market_indexes` | `market-index.interface.ts` |
| `audit_logs`     | `audit-log.interface.ts`    |

Add a new interface file for any new table, using the same naming pattern.

---

## 6. Checklist for Any Schema Change

Before marking a schema change complete, verify:

- [ ] `src/docs/master-supabase.schema.sql` updated with the new/changed DDL
- [ ] Migration file created in `src/docs/migrations/<description>.sql`
- [ ] RLS enabled on new table + at least one SELECT policy
- [ ] TypeScript interface model updated or created
- [ ] Affected services updated to query new/changed columns
- [ ] If a column is renamed or removed, search for usages across all service files and update them
