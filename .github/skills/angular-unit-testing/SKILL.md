---
name: angular-unit-testing
description: Run and write unit tests for this Angular project. Use when the user asks to run tests, validate changes with tests, or create new test files. This project uses Angular's native test runner (@angular/build:unit-test) backed by Vitest — tests MUST be executed via `ng test`, never via `vitest` directly.
---

# Angular Unit Testing

Run and author unit tests for this Angular project.

## CRITICAL: How to Run Tests

This project uses `@angular/build:unit-test` (Angular's native Vitest integration). The Angular CLI configures the Vitest runner, test-bed initialization, and environment automatically.

**NEVER** run tests with:

- `npx vitest run` — fails with "Vitest failed to find the runner"
- `vitest` directly — same failure
- The `runTests` tool — does not use the Angular CLI pipeline
- `run_in_terminal` with `ng test` — **fails on Windows** due to PowerShell execution policy (`UnauthorizedAccess` / `PSSecurityException`). Do not attempt workarounds like `Set-Location` prefixes; they fail the same way.

**ALWAYS** run tests using the VS Code task runner:

```
run_task  { "id": "npm: 1", "workspaceFolder": "c:\\Dev\\Git\\grow-together-v2" }
```

This maps to the `npm: test` task (defined in `.vscode/tasks.json` or workspace config) which runs `ng test` through the Angular CLI without PowerShell execution policy restrictions.

To read the output after launching the task, use `run_task` (which streams output directly) — the result is written to a temp file whose path is returned; use `read_file` on that path.

### Run a specific test file

The task runner does not accept extra CLI flags. To target one file, use the task and filter results from the output, or temporarily edit `angular.json`'s `include` glob. Do not try to pass `--include` via `run_in_terminal`.

### Run tests in watch mode (for development)

Use the `npm: test` task (id `npm: 1`) — it defaults to watch mode.

### Run all tests once (CI / validation)

Use the `npm: test` task. Inspect the written output file with `read_file` to see pass/fail counts and error details.

## Test File Conventions

- Test files live next to the file they test: `foo.component.ts` → `foo.component.spec.ts`
- Use `describe` / `it` blocks (Vitest globals are configured via `tsconfig.spec.json`)
- Use `vi.fn()` for mocks (not `jest.fn()`)
- Import mock factories from `src/app/core/testing/mock-supabase.service.ts`
- Access index-signature properties with bracket notation: `mockService['methodName']`

## Test Structure Pattern

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [
        // Use mock factories from core/testing/mock-supabase.service.ts
        // { provide: SomeService, useValue: createMockSomeService() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

## Setting Inputs in Tests

Use `setInput` on the component ref — do not assign to signal inputs directly:

```typescript
fixture.componentRef.setInput('myInput', 'value');
fixture.detectChanges();
```

## Async Tests

For components that load data in `ngOnInit`:

```typescript
fixture.detectChanges(); // triggers ngOnInit
await fixture.whenStable(); // waits for async operations
fixture.detectChanges(); // reflects updated state
```

## Validation Workflow

After making code changes, validate by running the `npm: test` task via `run_task`:

```
run_task  { "id": "npm: 1", "workspaceFolder": "c:\\Dev\\Git\\grow-together-v2" }
```

Then read the returned output file path with `read_file` to check pass/fail counts and error details.
