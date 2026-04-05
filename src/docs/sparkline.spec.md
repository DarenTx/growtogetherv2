# Trend Label — Component Specification

## 1. Objective

Provide a reusable, self-sizing inline chart component that renders a polyline sparkline, an optional trend icon, and an optional trend-delta label. The component is designed to be dropped into any container—table cell, card, or list item—and will expand to fill the available space without hard-coded dimensions.

---

## 2. Audience & Placement

- **Consumers**: Any feature component in the application that needs a compact visual trend indicator—initially anticipated in the Dashboard growth grid and any future summary cards.
- **Location**: `src/app/shared/components/trend-label/`
- **Files**:

  | File                            | Purpose                             |
  | ------------------------------- | ----------------------------------- |
  | `trend-label.component.ts`      | Component class                     |
  | `trend-label.component.html`    | Template                            |
  | `trend-label.component.css`     | CSS placeholder (empty at creation) |
  | `trend-label.component.spec.ts` | Unit tests                          |

---

## 3. Architecture Decisions

### 3.1 SVG-based Sparkline

The chart is drawn with an inline `<svg>` element that uses `viewBox` and `preserveAspectRatio` so it scales fluidly to fit whatever width and height the host container provides. No third-party charting library is used. The polyline path is computed in the component class from the parsed data values and written into the template as a `points` string attribute.

### 3.2 Signal-based Inputs

All inputs use Angular's signal-based `input()` API (Angular v17+), consistent with the rest of the codebase. Derived values (trend direction, delta text, computed SVG points) are `computed()` signals that update automatically when inputs change.

### 3.3 Tailwind CSS Only

No new `gt-*` CSS classes are introduced. All visual styling is expressed with Tailwind utility classes in the template. The `.css` file is intentionally empty at creation and serves as a placeholder for any future component-scoped overrides.

### 3.4 Trend Colour Tokens

Colour choices align with the existing `styles.css` design tokens:

| Trend            | Colour reference                          | Tailwind approximation                |
| ---------------- | ----------------------------------------- | ------------------------------------- |
| Up (positive)    | `--color-success` (`oklch(50% 0.18 152)`) | `text-green-600` / `stroke-green-600` |
| Down (negative)  | `--color-error` (`oklch(57% 0.22 25)`)    | `text-red-600` / `stroke-red-600`     |
| Flat (no change) | `--color-text-base`                       | `text-gray-800`                       |
| Line (neutral)   | `--color-text-muted`                      | `stroke-gray-400`                     |

Because the project uses Tailwind v4 with CSS-first configuration, arbitrary `oklch` values may be used via Tailwind's `[color:oklch(...)]` syntax if exact brand alignment is required; otherwise the nearest semantic Tailwind colour class is acceptable.

**Design rationale — polyline colour**: The sparkline line is always drawn in the neutral `stroke-gray-400` colour regardless of trend direction. Green and red are reserved exclusively for the icon and delta text. This prevents the line from visually competing with the icon/text indicators, keeps the chart readable at small sizes, and avoids the common misread where a red line is assumed to mean "bad" even when the overall trend is positive. Future maintainers should not add trend-based line colouring without revisiting this decision.

---

## 4. Component: `TrendLabelComponent`

### 4.1 Selector & Metadata

| Property         | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Selector         | `app-trend-label`                                                                      |
| Standalone       | `true`                                                                                 |
| Change detection | `OnPush`                                                                               |
| Imports          | `NgClass` (built-in `@if` / `@for` control flow is used; `CommonModule` is not needed) |

### 4.2 Inputs

| Input name | Type      | Required | Default | Description                                                                                                                                                                                                                                                                                          |
| ---------- | --------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`     | `string`  | Yes      | —       | Comma-delimited list of numeric values (e.g. `"3.5,4.1,2.8,5.2,6.0"`). Non-numeric tokens are silently ignored. Requires at least three valid numbers to render the sparkline SVG; with fewer than three values the SVG is not rendered, but the icon and text still operate on the last two values. |
| `showIcon` | `boolean` | No       | `true`  | When `false`, the trend arrow icon is hidden via `visibility: collapse`.                                                                                                                                                                                                                             |
| `showText` | `boolean` | No       | `true`  | When `false`, the delta label is hidden via `visibility: collapse`.                                                                                                                                                                                                                                  |

> **Visibility vs. conditional rendering**: Both `show*` flags (`showIcon`, `showText`) control element visibility using the CSS `visibility: collapse` property (Tailwind arbitrary class `[visibility:collapse]`) rather than structural `@if` directives. The icon and text elements are always present in the DOM, preserving flex layout stability. The sparkline SVG, by contrast, uses structural `@if` (see §6.1) and is removed from the DOM when fewer than three data points are available; this does not destabilise the icon and text layout because the sparkline occupies space via `flex-1` and its absence simply allows the remaining elements to fill the container.

### 4.3 Computed Signals (internal)

| Signal         | Type                       | Derivation                                                                                                                                                       |
| -------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parsedValues` | `number[]`                 | Splits the `data` input on commas, trims whitespace from each token, converts each token with `parseFloat`, and filters out `NaN` values.                        |
| `trend`        | `'up' \| 'down' \| 'flat'` | Compares `parsedValues()[last]` with `parsedValues()[last - 1]`. Returns `'flat'` when fewer than two values exist.                                              |
| `delta`        | `number`                   | `parsedValues()[last] - parsedValues()[last - 1]`. Returns `0` when fewer than two values exist.                                                                 |
| `deltaLabel`   | `string`                   | Formats `delta` to two decimal places with a leading `+` for positive values and no prefix for negative or zero values (e.g. `+2.50`, `-1.20`, `0.00`).          |
| `svgPoints`    | `string`                   | Normalises `parsedValues` to the SVG coordinate space and returns a space-separated `"x,y"` string for the `<polyline points>` attribute (see §5 for algorithm). |

### 4.4 No Outputs

The component is purely presentational. It emits no events.

---

## 5. SVG Points Algorithm

Given an array `values` of length `n` and a logical SVG canvas of width `W` and height `H` (expressed as `viewBox="0 0 W H"`; recommended defaults: `W = 100`, `H = 32`):

1. Find `min = Math.min(...values)` and `max = Math.max(...values)`.
2. If `min === max` (flat line), treat all y-coordinates as the vertical midpoint (`H / 2`).
3. Otherwise, for each value at index `i`, apply a vertical inset padding (`paddingY = 4`) so the line never touches the top or bottom edge:
   - `x = (i / (n - 1)) * W`
   - `y = paddingY + ((value - min) / (max - min)) * (H - 2 * paddingY)`
4. Round each coordinate to one decimal place.
5. Return the points as `"x1,y1 x2,y2 … xn,yn"`.

---

## 6. Template Structure

The component renders a single `<div>` host that uses `flex`, `items-center`, and `gap-x-1.5` to lay out the three sub-elements inline. The host div uses `w-full h-full` so it expands to fill its container.

```
┌─────────────────────────────────────────────┐
│  [SVG sparkline]   [icon]   [delta text]    │
└─────────────────────────────────────────────┘
```

### 6.1 Sparkline Sub-element

- An `<svg>` with `viewBox="0 0 100 32"`, `preserveAspectRatio="none"`, and Tailwind classes `flex-1 min-w-0 overflow-visible`.
- Rendered conditionally via `@if (parsedValues().length > 2)`. When two or fewer valid values are present the entire SVG element is removed from the DOM; the icon and text sub-elements continue to occupy their layout space normally.
- Contains a single `<polyline>` with:
  - `[attr.points]="svgPoints()"`
  - `fill="none"`
  - `vector-effect="non-scaling-stroke"` — keeps the stroke width constant in screen pixels regardless of how the SVG is stretched by its container.
  - `stroke-width="1.5"` — rendered as 1.5 screen pixels at all container sizes.
  - `stroke-linecap="round"`
  - `stroke-linejoin="round"`
  - Stroke colour is always `stroke-gray-400` (neutral). Trend colour is **not** applied to the polyline; it is applied only to the icon and delta text.

### 6.2 Icon Sub-element

Always rendered in the DOM. Hidden via `[visibility:collapse]` when `showIcon()` is `false` or `trend()` is `'flat'`.

- Uses an SVG icon inline within the template (no icon library dependency):
  - **Up arrow** (`trend() === 'up'`): A simple upward-pointing chevron or triangle SVG path, coloured `text-green-600`.
  - **Down arrow** (`trend() === 'down'`): A downward-pointing chevron or triangle SVG path, coloured `text-red-600`.
- Icon size: `w-4 h-4` (16 × 16 px), shrink-0 so it does not compress.

### 6.3 Text Sub-element

Always rendered in the DOM. Hidden via `[visibility:collapse]` when `showText()` is `false`.

- A `<span>` containing `deltaLabel()`.
- Font size: `text-xs` (12 px), `font-medium`, `whitespace-nowrap`, `shrink-0`.
- Colour class driven by `trend()`:
  - `trend() === 'up'` → `text-green-600`
  - `trend() === 'down'` → `text-red-600`
  - `trend() === 'flat'` → `text-gray-800`

---

## 7. Sizing & Responsiveness

- The component does **not** define any hard-coded width or height. The outer `<div>` is `w-full h-full`.
- The `<svg>` element uses `flex-1` so it grows to consume remaining horizontal space after the fixed-size icon and text.
- The parent container is fully responsible for constraining dimensions.
- **Recommended container height**: `h-8` (32 px). This matches the SVG viewBox height and gives the line comfortable vertical room on both desktop and mobile. `h-6` (24 px) is the practical minimum — below this, the `w-4 h-4` icon may overflow. Heights of `h-10` (40 px) or `h-12` (48 px) are appropriate for prominent card placements.
- Because `vector-effect="non-scaling-stroke"` is used, the 1.5 px line weight is consistent at all container heights — no stroke-width adjustment is needed when changing container size.

  ```html
  <!-- Inside a table cell — recommended default -->
  <td class="w-32 h-8">
    <app-trend-label data="1,2,3,4,5" />
  </td>

  <!-- Compact mobile row — minimum height -->
  <div class="w-full h-6">
    <app-trend-label data="5,3,4,6,2" [showText]="false" />
  </div>

  <!-- Prominent dashboard card -->
  <div class="w-48 h-10">
    <app-trend-label data="5,3,4,6,2" />
  </div>
  ```

---

## 8. Accessibility

- The `<svg>` element includes `aria-hidden="true"` because it is decorative; trend information is conveyed textually via the delta label and/or icon.
- The icon `<svg>` also carries `aria-hidden="true"`.
- If both `showIcon` and `showText` are `false` **and** `parsedValues().length >= 2` (i.e. enough data to compute a delta), a visually hidden `<span class="sr-only">` is rendered with the `deltaLabel` value so screen readers still receive trend information. When fewer than two values are present, the `sr-only` span is also omitted.

> **Note**: Unlike the `show*` inputs, the `sr-only` span uses `@if` for conditional rendering rather than `visibility: collapse`, because it is purely assistive content with no visual footprint that needs to be preserved.

---

## 9. Edge Cases

| Scenario                          | Behaviour                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `data` is empty string or omitted | `parsedValues` is `[]`; sparkline SVG is not rendered; icon and text are hidden regardless of input flags because no delta can be computed.  |
| Only one valid number             | Same as empty — no delta, no sparkline, icon and text hidden.                                                                                |
| Exactly two valid numbers         | Sparkline SVG is **not** rendered (`parsedValues().length` is not `> 2`); icon and text **are** shown with the delta between the two values. |
| All values identical (flat)       | Sparkline drawn at vertical midpoint; `trend` is `'flat'`; icon not shown; delta text is `0.00` in `text-gray-800`.                          |
| Non-numeric tokens in `data`      | Silently filtered out; remaining numeric values are used.                                                                                    |
| Very large or very small numbers  | SVG normalisation handles arbitrary range; no clamping required.                                                                             |
| Negative values                   | Supported—`parsedValues` retains sign; normalisation uses the actual min/max spread.                                                         |

---

## 10. Unit Tests (`trend-label.component.spec.ts`)

The spec file covers the following cases:

| Test                                                                  | Assertion                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Renders with valid data                                               | Component mounts without error.                                                                  |
| `parsedValues` filters non-numeric tokens                             | Only numeric entries survive.                                                                    |
| `trend` returns `'up'` when last > second-to-last                     | Signal value is `'up'`.                                                                          |
| `trend` returns `'down'` when last < second-to-last                   | Signal value is `'down'`.                                                                        |
| `trend` returns `'flat'` when last === second-to-last                 | Signal value is `'flat'`.                                                                        |
| `trend` returns `'flat'` with fewer than two values                   | Signal value is `'flat'`.                                                                        |
| `deltaLabel` formats positive delta with `+` prefix                   | e.g. `"+2.50"`.                                                                                  |
| `deltaLabel` formats negative delta without extra sign                | e.g. `"-1.20"`.                                                                                  |
| `deltaLabel` formats zero delta                                       | `"0.00"`.                                                                                        |
| `showIcon` is `false`                                                 | Icon element has `visibility: collapse`; still in DOM.                                           |
| `showText` is `false`                                                 | Delta span has `visibility: collapse`; still in DOM.                                             |
| Exactly two valid numbers provided                                    | Sparkline SVG element is not in DOM; icon and text render with the delta between the two values. |
| `trend` is `'flat'`                                                   | Icon element has `visibility: collapse`; still in DOM.                                           |
| `sr-only` span rendered when both flags are `false` and data is valid | Assistive text present in DOM.                                                                   |
| Empty `data` renders no polyline points                               | `svgPoints()` returns `''`.                                                                      |
| Identical values produce a flat midpoint line                         | All y-coordinates equal `H / 2`.                                                                 |

---

## 11. Out of Scope

- Tooltip or hover interactions.
- Animated line drawing.
- Multiple series / datasets.
- Configurable colours via inputs (colour is determined solely by trend direction and the design token palette).
- Axis labels, grid lines, or data point markers.
- Click/tap event emission.
