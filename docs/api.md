# API Reference

## Odontogram

### Constructor

```ts
new Odontogram(el: HTMLElement, options?: OdontogramOptions)
```

| Parameter | Type                | Description               |
| --------- | ------------------- | ------------------------- |
| `el`      | `HTMLElement`       | Container element         |
| `options` | `OdontogramOptions` | Configuration (see below) |

### Methods

#### `render(): void`

Mount the odontogram into the container. Creates a host element and renders the active view. Safe to call once; subsequent calls trigger a re-render.

#### `destroy(): void`

Unmount the odontogram, call view destroy hooks, and remove the host element.

#### `getOption<K>(name: K): OdontogramOptions[K]`

Get the current value of an option. Returns the default if not explicitly set.

#### `setOption<K>(name: K, value: OdontogramOptions[K]): void`

Set an option dynamically. Triggers a re-render.

**Immutable options** (cannot be changed after construction):

- `plugins` — register at construction time
- `initialView` — use `changeView()` instead

#### `changeView(view: ViewType): void`

Switch to a different view. Unmounts the current view and mounts the new one.

#### `getState(): OdontogramState`

Return a snapshot of current state (view, marks, selection, teeth overlay). Marks are normalized to canonical `target` structures.

#### `setState(state: OdontogramState | Partial<OdontogramState>): void`

Update state. Partial updates merge with current state. Normalizes mark inputs, triggers `marksSet` callback, executes validation if configured (triggering `validationDidChange`), and requests a re-render.

#### `validate(config?: ValidatorConfig): ValidationResult`

Run structural and coexistence validation against the current odontogram state snapshot. Returns a `ValidationResult` with `valid` boolean, `errors`, `warnings`, and `issues`.

#### `batchRendering(fn: () => void): void`

Execute `fn` with rendering deferred. Multiple `setOption` / `setState` / `changeView` calls inside a batch result in a single re-render when the batch completes. Nesting is supported.

---

## OdontogramOptions

| Option           | Type                                                                           | Default       | Description                                  |
| ---------------- | ------------------------------------------------------------------------------ | ------------- | -------------------------------------------- |
| `plugins`        | `OdontogramPlugin[]`                                                           | `[]`          | Plugins to register                          |
| `initialView`    | `ViewType`                                                                     | `"permanent"` | Starting view                                |
| `notation`       | `"fdi" \| "universal" \| "palmer"`                                             | `"fdi"`       | Tooth label notation                         |
| `height`         | `number \| string`                                                             | `400`         | Container height                             |
| `selectable`     | `boolean`                                                                      | `true`        | Enable selection                             |
| `toothColor`     | `string`                                                                       | `"#f5f5f5"`   | Default tooth fill                           |
| `surfaceColor`   | `string`                                                                       | `"#e0e0e0"`   | Default surface fill                         |
| `selectionColor` | `string`                                                                       | `"#90caf9"`   | Selection highlight                          |
| `markColors`     | `Record<string, string>`                                                       | `{}`          | Type-to-color map                            |
| `statusColors`   | `Record<string, string>`                                                       | `{}`          | Status-to-color map (e.g. planned/completed) |
| `validator`      | `boolean \| ValidatorConfig \| ((state: OdontogramState) => ValidationResult)` | `undefined`   | Auto-validate on state updates               |

### Callbacks

| Callback              | Argument                      | When                                     |
| --------------------- | ----------------------------- | ---------------------------------------- |
| `toothClick`          | `{ tooth, jsEvent }`          | User clicks a tooth                      |
| `surfaceClick`        | `{ tooth, surface, jsEvent }` | User clicks a surface                    |
| `selectionDidChange`  | `{ selection }`               | Selection state changes                  |
| `marksSet`            | `{ marks }`                   | Marks array changes                      |
| `validationDidChange` | `{ result }`                  | Validation issues change on state update |

### Hooks

| Hook               | Argument                | When                            |
| ------------------ | ----------------------- | ------------------------------- |
| `toothClassNames`  | `{ tooth, isSelected }` | Returns CSS classes for a tooth |
| `markClassNames`   | `{ mark }`              | Returns CSS classes for a mark  |
| `toothDidMount`    | `{ tooth, el }`         | Tooth element added to DOM      |
| `toothWillUnmount` | `{ tooth, el }`         | Tooth element removed           |
| `markDidMount`     | `{ mark, el }`          | Mark element added              |
| `markWillUnmount`  | `{ mark, el }`          | Mark element removed            |
| `viewDidMount`     | `{ view, el }`          | View rendered                   |
| `viewWillUnmount`  | `{ view, el }`          | View destroyed                  |

---

## OdontogramState

```ts
interface OdontogramState {
  view: ViewType;
  marks: OdontographicMark[];
  selection: SelectionState;
  teeth: Record<ToothId, ToothState>;
}
```

### ToothState / ToothPresence

```ts
type ToothPresence = "present" | "missing" | "unerupted";

interface ToothState {
  presence: ToothPresence;
}
```

The `teeth` overlay is **sparse**. Omitted tooth ids are treated as present for rendering only — not as missing or unerupted. Use `getToothPresence(state.teeth, toothId)` from `@odontogram/core` to resolve presence.

### MarkTarget & OdontographicMark

```ts
export type MarkStatus = "existing" | "planned" | "completed" | "proposed" | "referred" | string;

export type MarkTarget =
  | { kind?: "surface" | "surfaces"; tooth: ToothId; surfaces: SurfaceId[] } // Single tooth surfaces
  | { kind?: "tooth"; tooth: ToothId } // Whole single tooth
  | { kind?: "teeth" | "group"; teeth: ToothId[] } // Multi-tooth annotation (e.g. bridge)
  | { kind?: "complex"; elements: Array<{ tooth: ToothId; surfaces?: SurfaceId[] }> };

export interface OdontographicMark<TMetadata = Record<string, unknown>> {
  id: string;
  type: string;
  status?: MarkStatus;
  target: MarkTarget;
  text?: string;
  metadata?: TMetadata;
  style?: MarkStyle;

  // Backwards compatibility accessors:
  tooth?: ToothId;
  surfaces?: SurfaceId[];
}
```

### Mark Utilities

`@odontogram/core` provides helper functions for querying and working with marks:

- `normalizeMark(markInput)`: Normalizes shorthand or legacy input into a canonical `OdontographicMark`.
- `createMark(markInput)`: Type-safe mark factory.
- `getMarksForTooth(marks, toothId)`: Returns all marks involving a given tooth (whole tooth, surface, or multi-tooth).
- `getMarksForSurface(marks, toothId, surfaceId)`: Returns marks targeting a specific surface on a tooth.
- `getMarkTargetTeeth(mark)`: Returns array of all teeth targeted by the mark.
- `getMarkTargetSurfaces(mark, toothId?)`: Returns array of surfaces targeted on the given tooth.
- `isSurfaceMark(mark)` / `isWholeToothMark(mark)` / `isMultiToothMark(mark)`: Type guards.

---

## Validation API

The library includes a configurable validation engine to enforce structural coexistence rules and prevent incompatible mark combinations:

```ts
import {
  validateOdontogramState,
  validateMarks,
  createValidator,
  RULE_MARK_ID_UNIQUE,
  RULE_TARGET_INTEGRITY,
  RULE_SURFACE_APPLICABILITY,
  RULE_TOOTH_PRESENCE_COEXISTENCE,
  RULE_MARK_COEXISTENCE,
} from "@odontogram/core";

const result = validateOdontogramState(state, {
  strict: false,
  incompatibleTypes: [["implant", "natural-root"]],
  allowMissingToothMarks: false,
  rules: {
    [RULE_SURFACE_APPLICABILITY]: true,
  },
  customRules: [
    (state, ctx) => {
      // Custom business rule
      return null;
    },
  ],
});

if (!result.valid) {
  console.error("Validation errors:", result.errors);
}
```

### Built-in Validation Rules

| Rule ID                      | Name                  | Default Severity | Description                                                                               |
| ---------------------------- | --------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `mark-id-unique`             | Mark ID Uniqueness    | `error`          | Ensures all mark IDs are non-empty and unique across the state.                           |
| `target-integrity`           | Target Integrity      | `error`          | Enforces valid tooth identifiers and surfaces; prevents duplicate surfaces in one target. |
| `surface-applicability`      | Surface Applicability | `error`          | Verifies anatomical validity (e.g. Incisal on anterior only, Occlusal on posterior only). |
| `tooth-presence-coexistence` | Presence Coexistence  | `error`          | Prevents surface marks on missing teeth or restorations on unerupted teeth.               |
| `mark-coexistence`           | Mark Coexistence      | `warning`        | Detects configured incompatible concurrent mark types (e.g. implant + natural root).      |
| `tooth-catalog-validity`     | Catalog Validity      | `warning`        | Verifies tooth identifiers against active dentition catalog.                              |

---

## SelectionState

```ts
interface SelectionState {
  teeth: ToothId[];
  surfaces: Array<{ tooth: ToothId; surface: SurfaceId }>;
}
```

---

## createPlugin

```ts
function createPlugin(def: OdontogramPluginDef): OdontogramPlugin;
```

Create a plugin for registration with `Odontogram`.

```ts
interface OdontogramPluginDef {
  name: string;
  views?: ViewDefinition[];
}

interface ViewDefinition {
  type: ViewType;
  render: (ctx: ViewRenderContext) => void;
  destroy?: (ctx: ViewRenderContext) => void;
}
```

### ViewRenderContext

Passed to view `render` and `destroy` functions:

| Property / Method                           | Description                 |
| ------------------------------------------- | --------------------------- |
| `el`                                        | Host HTMLElement            |
| `options`                                   | Current options             |
| `state`                                     | Current state               |
| `requestRender()`                           | Request a re-render         |
| `selectTooth(tooth)`                        | Select a tooth              |
| `selectSurface(tooth, surface)`             | Select a single surface     |
| `toggleSurfaceSelection(tooth, surface)`    | Toggle surface in selection |
| `emitToothClick(tooth, jsEvent)`            | Fire toothClick callback    |
| `emitSurfaceClick(tooth, surface, jsEvent)` | Fire surfaceClick callback  |

---

## Types

```ts
type ToothId = string; // FDI canonical, e.g. "16"
type SurfaceId = "M" | "O" | "I" | "D" | "B" | "L";
type ToothPresence = "present" | "missing" | "unerupted";
type Notation = "fdi" | "universal" | "palmer";
type ViewType = "permanent" | "deciduous" | "mixed" | string;
```

---

## Dentition model (`@odontogram/dentition`)

### ToothRecord

Canonical catalog entry (identity separate from labels and geometry):

```ts
interface ToothRecord {
  id: ToothId;
  dentition: "permanent" | "primary";
  arch: "maxillary" | "mandibular";
  quadrant: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  position: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  toothClass: "incisor" | "canine" | "premolar" | "molar";
  applicableSurfaces: ClinicalSurface[];
  successorId?: ToothId;
  predecessorId?: ToothId;
}
```

### Key functions

| Function                                                        | Description                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `getTooth(id)`                                                  | Lookup catalog record                                                     |
| `getApplicableSurfaces(id)`                                     | Clinical surfaces valid for this tooth                                    |
| `getAnatomicalArch(id)`                                         | `"maxillary"` or `"mandibular"`                                           |
| `getLayoutArch(id)`                                             | Layout alias `"upper"` or `"lower"`                                       |
| `mapSurfaceToFace(id, surface)`                                 | Clinical surface → graphic face                                           |
| `getPermanentTeeth()` / `getPrimaryTeeth()` / `getMixedTeeth()` | Catalog id lists                                                          |
| `toNotation(id, notation)`                                      | Display label in specified numbering system                               |
| `toAccessibleNotation(id, notation)`                            | Accessible / screen-reader text label                                     |
| `fromNotation(label, notation)`                                 | Parse label to canonical FDI `ToothId` (`null` if invalid/out-of-catalog) |
| `getNotationAdapter(notation)`                                  | Get notation adapter instance                                             |
| `listSupportedNotations()`                                      | List supported notation identifiers (`["fdi", "universal", "palmer"]`)    |
| `isValidNotation(notation)`                                     | Type guard for valid `Notation`                                           |

### Notation adapters

`@odontogram/dentition` provides modular adapters for standard numbering systems:

```ts
interface NotationAdapter {
  readonly id: Notation;
  readonly name: string;
  readonly description: string;
  format(toothId: ToothId): string;
  formatAccessible(toothId: ToothId): string;
  parse(label: string): ToothId | null;
  isValid(label: string): boolean;
}
```

- **`fdiAdapter`** (`"fdi"`): FDI World Dental Federation / ISO 3950 two-digit designation. Canonical identity.
- **`universalAdapter`** (`"universal"`): Universal Numbering System (ADA). 1–32 for permanent teeth, A–T for primary teeth. Case-insensitive parsing.
- **`palmerAdapter`** (`"palmer"`): Palmer Notation Method. Quadrant grid symbols (`8┘`, `└1`, `┌1`, `1┐` for permanent; `E┘`, `└A`, `┌A`, `A┐` for primary) and accessible quadrant codes (`UR8`, `UL1`, `LL1`, `LR1` / `URA`, `ULA`, `LLA`, `LRA`). Ambiguous inputs without quadrant context (e.g. `"1"`, `"A"`) or out-of-catalog values are rejected (`null`).

Fixtures: `packages/dentition/fixtures/*.json` (including `notations.json`). Review process: [`dental-review.md`](dental-review.md).
