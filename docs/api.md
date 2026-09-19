# API Reference

## Odontogram

### Constructor

```ts
new Odontogram(el?: HTMLElement | null, options?: OdontogramOptions)
```

| Parameter | Type                | Description                                                                 |
| --------- | ------------------- | --------------------------------------------------------------------------- |
| `el`      | `HTMLElement \| null \| undefined` | Container element (optional for headless / non-DOM usage) |
| `options` | `OdontogramOptions` | Configuration (see below)                                                   |

### Methods

#### Lifecycle & View

##### `render(container?: HTMLElement): void`

Mount the odontogram into the container. Creates a host element and renders the active view. Safe to call once; subsequent calls trigger a re-render. If constructed headlessly without a container, passing `container` mounts the instance.

##### `destroy(): void`

Unmount the odontogram, call view destroy hooks, remove DOM event listeners, and remove the host element.

##### `getOption<K>(name: K): OdontogramOptions[K]`

Get the current value of an option. Returns the default if not explicitly set.

##### `setOption<K>(name: K, value: OdontogramOptions[K]): void`

Set an option dynamically. Triggers a re-render.

**Immutable options** (cannot be changed after construction):

- `plugins` — register at construction time
- `initialView` — use `changeView()` instead
- `mode` — specified at construction time

##### `changeView(view: ViewType): void`

Switch to a different view (`"permanent"`, `"deciduous"`, `"mixed"`, or custom view). Unmounts the current view and mounts the new one.

#### State, Mode & Revisions

##### `getState(): OdontogramState`

Return a defensive deep clone of the current state (`view`, `marks`, `selection`, `teeth` overlay). Mutations on the returned object have no effect on internal state.

##### `setState(state: OdontogramState | Partial<OdontogramState>, options?: SetStateOptions): void`

Update state atomically. Partial updates merge with current state. Normalizes mark inputs, increments revision, triggers `marksSet` and `stateDidChange` callbacks, executes validation if configured (triggering `validationDidChange`), and requests a re-render.

##### `getMode(): OdontogramMode`

Returns the operational mode: `"internal"` (default: instance manages its own state) or `"controlled"` (host application drives state).

##### `getRevision(): number`

Returns the monotonic integer revision number representing the count of successful state mutations since initialization.

#### Internal vs controlled mode

| Concern | `mode: "internal"` (default) | `mode: "controlled"` |
| ------- | ---------------------------- | -------------------- |
| Source of truth | Odontogram instance | Host application |
| Imperative APIs (`addMark`, `selectTooth`, `batch`, …) | Allowed | Throws `ERR_CONTROLLED_MUTATION` |
| Host updates | Optional via `setState` | Required via `setState` / `reset` with `source: "external"` |
| UI clicks | Update selection internally (when `selectable`) | Fire `toothClick` / `surfaceClick` only; host updates `selection` via `setState` |
| Revision sync | Auto-increment on change | Pass `revision` in `SetStateOptions`; regressions (`revision` &lt; current) throw `ERR_REVISION_REGRESSION` |

In controlled mode, compound host updates should use a **single** `setState` call (not `batch`).

#### Marks CRUD Operations

##### `getMarks(filter?: MarkFilter): OdontographicMark[]`

Return an array of marks matching the optional filter (`type`, `status`, `tooth`, `surface`). Returns defensive clones.

##### `getMark(id: string): OdontographicMark | undefined`

Return a defensive clone of the mark with the specified ID, or `undefined` if not found.

##### `hasMark(id: string): boolean`

Returns `true` if a mark with the given ID exists in the state.

##### `getMarksForTooth(toothId: ToothId): OdontographicMark[]`

Return all marks that target the given tooth (surface, whole tooth, or multi-tooth group).

##### `getMarksForSurface(toothId: ToothId, surface: SurfaceId): OdontographicMark[]`

Return all marks targeting the given tooth surface.

##### `addMark<TMeta>(mark: MarkInput<TMeta>): OdontographicMark<TMeta>`

Add a single mark. Automatically assigns a unique ID if omitted. Validates the candidate mark atomically before committing.

##### `addMarks<TMeta>(marks: MarkInput<TMeta>[]): OdontographicMark<TMeta>[]`

Add multiple marks in one operation. Validates all marks atomically before committing.

##### `updateMark<TMeta>(id: string, patch: Partial<MarkInput<TMeta>>): OdontographicMark<TMeta>`

Update an existing mark by ID with partial properties. **Mark ID is strictly immutable** and cannot be modified. Throws `ERR_MARK_NOT_FOUND` if ID does not exist.

##### `removeMark(id: string): boolean`

Remove a mark by ID. Returns `true` if removed, `false` if not found.

##### `removeMarks(ids: string[]): number`

Remove multiple marks by their IDs. Returns the count of removed marks.

##### `removeMarksForTooth(toothId: ToothId): number`

Remove all marks referencing a specific tooth. Returns the count of removed marks.

##### `clearMarks(filter?: MarkFilter): number`

Remove all marks, or only marks matching the optional filter. Returns the count of cleared marks.

#### Tooth State & Biological Presence

##### `getToothState(toothId: ToothId): ToothState | undefined`

Return the overlay state for the specified tooth (e.g. `{ presence: "missing" }`), or `undefined` if default present.

##### `getToothPresence(toothId: ToothId): ToothPresence`

Resolve the effective biological presence (`"present"`, `"missing"`, or `"unerupted"`). Defaults to `"present"` for omitted teeth.

##### `getTeethState(): Record<ToothId, ToothState>`

Return a defensive clone of the sparse tooth overlay state dictionary.

##### `hasToothOverlay(toothId: ToothId): boolean`

Returns `true` if an explicit overlay record exists for the given tooth.

##### `setToothState(toothId: ToothId, presence: ToothPresence | ToothState, options?: SetToothStateOptions): void`

Set or update the state of an individual tooth. If `options.pruneMarks` is `true` (or when setting `"missing"`/`"unerupted"`), surface marks on that tooth are automatically pruned.

##### `setTeethState(teeth: Record<ToothId, ToothPresence | ToothState>, options?: SetToothStateOptions): void`

Set or update multiple tooth records at once with optional mark pruning.

##### `resetToothState(toothId: ToothId): void`

Remove the explicit overlay for a single tooth, resetting it to default present.

##### `resetTeethState(): void`

Clear all tooth presence overlays, resetting all teeth to default present.

#### DOM-Independent Selection

##### `getSelection(): SelectionState`

Return a defensive clone of current selection (`{ teeth: ToothId[]; surfaces: ToothSurfaceRef[] }`).

##### `setSelection(selection: SelectionState): void`

Set selection directly. Validates selection and triggers `selectionDidChange`.

##### `selectTooth(toothId: ToothId, mode?: "replace" | "add" | "toggle"): void`

Select, append, or toggle tooth selection programmatically.

##### `selectSurface(toothId: ToothId, surface: SurfaceId, mode?: "replace" | "add" | "toggle"): void`

Select, append, or toggle surface selection programmatically.

##### `clearSelection(): void`

Clear all selected teeth and surfaces.

##### `resetSelection(): void`

Alias for `clearSelection()`.

##### `isToothSelected(toothId: ToothId): boolean`

Returns `true` if the specified tooth is selected.

##### `isSurfaceSelected(toothId: ToothId, surface: SurfaceId): boolean`

Returns `true` if the specified surface is selected.

#### Atomic Batch Transactions & Maintenance

##### `batch<T>(fn: () => T, options?: BatchOptions): T`

Execute compound operations inside an atomic transaction:
- Changes are buffered until `fn` finishes.
- If an error or validation failure occurs inside `fn`, **all changes are rolled back** to the pre-batch snapshot.
- On success, triggers a single revision increment, single `stateDidChange` callback, and single DOM re-render.

##### `batchRendering(fn: () => void): void`

Legacy alias: execute `fn` with rendering deferred until completion.

##### `reset(options?: ResetOptions): void`

Reset marks, tooth overlays, and selection to empty state. Supports `options.keepView`, `options.keepSelection`, and `options.initialView`. Allowed in controlled mode.

##### `resetMarks(): void`

Remove all marks and increment revision.

##### `resetTeeth(): void`

Reset all tooth presence overlays to default present.

##### `pruneOrphanedMarks(): number`

Remove surface marks targeting teeth that are currently `"missing"` or `"unerupted"`. Returns the count of pruned marks.

##### `validate(config?: ValidatorConfig): ValidationResult`

Run structural and coexistence validation against the current odontogram state snapshot. Returns a `ValidationResult` with `valid` boolean, `errors`, `warnings`, and `issues`.

---

## OdontogramOptions

| Option           | Type                                                                           | Default       | Description                                  |
| ---------------- | ------------------------------------------------------------------------------ | ------------- | -------------------------------------------- |
| `mode`           | `"internal" \| "controlled"`                                                   | `"internal"`  | Operational state management mode            |
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

| Callback              | Argument                                                                     | When                                     |
| --------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| `toothClick`          | `{ tooth, jsEvent }`                                                         | User clicks a tooth                      |
| `surfaceClick`        | `{ tooth, surface, jsEvent }`                                                | User clicks a surface                    |
| `selectionDidChange`  | `{ selection }`                                                              | Selection state changes                  |
| `marksSet`            | `{ marks }`                                                                  | Marks array changes                      |
| `stateDidChange`      | `{ state, revision, source }`                                                | Any state change occurs                  |
| `toothStateDidChange` | `{ toothId, presence, previousPresence }`                                    | Tooth presence overlay changes           |
| `validationDidChange` | `{ result }`                                                                 | Validation issues change on state update |

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

## Validation & Error Handling API

The library includes a configurable validation engine with typed diagnostic codes and precise field paths to enforce structural integrity, anatomical applicability, and clinical coexistence rules.

### Atomic State Updates & Rejection Guarantee

`Odontogram.prototype.setState` applies updates atomically:

- Prospective candidate state is validated before modifying internal instance state.
- If candidate state contains **structural validation errors** (such as malformed targets, duplicate IDs, invalid surfaces, or invalid presence values) or if configured validator rules fail, `setState()` throws an `OdontogramValidationError` and rejects the update.
- The previous state remains **100% intact and unmutated**.
- No hooks, callbacks (`marksSet`), or re-renders are triggered for rejected operations.
- Consumer input objects and returned snapshots are defensively deep-cloned to insulate internal state from subsequent external mutation.

### Error Classes

```ts
import { OdontogramError, OdontogramValidationError } from "@odontogram/core";

try {
  odontogram.setState({
    marks: [{ id: "m1", tooth: "11", surfaces: ["O"], type: "caries" }],
  });
} catch (err) {
  if (err instanceof OdontogramValidationError) {
    console.error(`Validation failed with code: ${err.code}`);
    for (const issue of err.errors) {
      console.error(`[${issue.code}] at ${issue.path}: ${issue.message}`);
    }
  }
}
```

- **`OdontogramError`**: Base error class with `code: string`.
- **`OdontogramValidationError`**: Thrown when state or option validation fails. Contains:
  - `code: string` (e.g. `"ERR_INVALID_STATE"`, `"ERR_INVALID_OPTION"`)
  - `issues: ValidationIssue[]` (all issues)
  - `errors: ValidationIssue[]` (issues with severity `"error"`)
  - `warnings: ValidationIssue[]` (issues with severity `"warning"`)

### Validation Codes (`VALIDATION_CODES`)

| Code                       | Severity  | Description                                                     | Sample Field Path             |
| -------------------------- | --------- | --------------------------------------------------------------- | ----------------------------- |
| `ERR_DUPLICATE_MARK_ID`    | `error`   | Duplicate mark identifier across the odontogram                 | `marks[1].id`                 |
| `ERR_INVALID_MARK_ID`      | `error`   | Mark identifier is empty, missing, or whitespace                | `marks[0].id`                 |
| `ERR_MISSING_TARGET`       | `error`   | Mark target object is missing or undefined                      | `marks[0].target`             |
| `ERR_INVALID_TARGET`       | `error`   | Mark target structure is malformed                              | `marks[0].target`             |
| `ERR_INVALID_TOOTH_ID`     | `error`   | Tooth identifier is empty, whitespace, or invalid string        | `marks[0].target.tooth`       |
| `ERR_INVALID_SURFACE`      | `error`   | Invalid clinical surface code (not M, O, I, D, B, L)            | `marks[0].target.surfaces[0]` |
| `ERR_DUPLICATE_SURFACE`    | `error`   | Duplicate surface code within a single target                   | `marks[0].target.surfaces[2]` |
| `ERR_INAPPLICABLE_SURFACE` | `error`   | Surface is clinically inapplicable (e.g. Occlusal on anterior)  | `marks[0].target.surfaces[0]` |
| `ERR_EMPTY_SURFACES`       | `error`   | Surface mark target has an empty surfaces array                 | `marks[0].target.surfaces`    |
| `ERR_EMPTY_TEETH`          | `error`   | Multi-tooth mark target has an empty teeth array                | `marks[0].target.teeth`       |
| `ERR_DUPLICATE_TOOTH`      | `error`   | Duplicate tooth in multi-tooth mark target                      | `marks[0].target.teeth[1]`    |
| `ERR_EMPTY_ELEMENTS`       | `error`   | Complex mark target has an empty elements array                 | `marks[0].target.elements`    |
| `ERR_INVALID_PRESENCE`     | `error`   | Invalid tooth presence overlay (not present/missing/unerupted)  | `teeth.16.presence`           |
| `ERR_PRESENCE_CONFLICT`    | `error`   | Surface mark on missing tooth or restoration on unerupted tooth | `teeth.16.presence`           |
| `ERR_INVALID_SELECTION`    | `error`   | Malformed selection or duplicate selection entry                | `selection.teeth[1]`          |
| `ERR_CONTROLLED_MUTATION`  | `error`   | Imperative API called while `mode` is `"controlled"`            | —                             |
| `ERR_REVISION_REGRESSION`  | `error`   | `setState` `revision` is lower than the current revision        | `options.revision`            |
| `ERR_INVALID_OPTION`       | `error`   | Invalid option value or type in options configuration           | `options.notation`            |
| `WARN_UNKNOWN_OPTION`      | `warning` | Unknown configuration option passed to options bag              | `options.unknownProp`         |
| `WARN_INCOMPATIBLE_MARKS`  | `warning` | Configured incompatible concurrent marks on a single tooth      | `marks`                       |
| `WARN_UNRECOGNIZED_TOOTH`  | `warning` | Tooth identifier not recognized in active tooth catalog         | `marks[0]`                    |

### Built-in Validation Rules

| Rule ID                      | Name                    | Default Severity    | Description                                                                               |
| ---------------------------- | ----------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `mark-id-unique`             | Mark ID Uniqueness      | `error`             | Ensures all mark IDs are non-empty and unique across the state.                           |
| `target-integrity`           | Target Integrity        | `error`             | Enforces valid tooth identifiers and surfaces; prevents duplicate surfaces in one target. |
| `surface-applicability`      | Surface Applicability   | `error`             | Verifies anatomical validity (e.g. Incisal on anterior only, Occlusal on posterior only). |
| `tooth-presence-coexistence` | Presence Coexistence    | `error`             | Prevents surface marks on missing teeth or restorations on unerupted teeth.               |
| `mark-coexistence`           | Mark Coexistence        | `warning`           | Detects configured incompatible concurrent mark types (e.g. implant + natural root).      |
| `tooth-catalog-validity`     | Catalog Validity        | `warning`           | Verifies tooth identifiers against active dentition catalog.                              |
| `teeth-overlay-integrity`    | Teeth Overlay Integrity | `error`             | Ensures tooth presence overlay entries use valid presence states.                         |
| `selection-integrity`        | Selection Integrity     | `error`             | Validates selection state teeth and surfaces without duplicates or malformed records.     |
| `options-validity`           | Options Validity        | `error` / `warning` | Enforces option types and warns on unknown option keys.                                   |

### Unknown Mark & Option Types Policy

- **Unknown Mark Types**: Odontogram supports extensible mark types. Custom mark types imported into the odontogram are **preserved intact** with all their properties (`id`, `type`, `target`, `status`, `text`, `metadata`, `style`, and custom attributes). Core does not strip or drop unknown mark types. Renderers fall back gracefully without crashing.
- **Unknown Options**: Options are validated against the known option schema. Unknown options generate diagnostic warnings (`WARN_UNKNOWN_OPTION`) to catch typos while preserving options in the bag.

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
| `state`                                     | Defensive deep clone of current state (mutations do not affect the store) |
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
