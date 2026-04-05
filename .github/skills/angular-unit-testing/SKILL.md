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

**ALWAYS** run tests by opening a terminal to the workspace root and using:

```
ng test --no-watch
```

### Run a specific test file

```
ng test --no-watch --include=src/app/path/to/file.spec.ts
```

### Run tests in watch mode (for development)

```
ng test
```

### Run all tests once (CI / validation)

```
ng test --no-watch
```

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

After making code changes, validate by running:

```
ng test --no-watch
```

If only the changed component needs validation:

```
ng test --no-watch --include=src/app/path/to/changed.component.spec.ts
```
