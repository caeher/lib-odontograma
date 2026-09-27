# API Reference

## Odontogram

### Constructor

```ts
new Odontogram(el?: HTMLElement | null, options?: OdontogramOptions)
```

| Parameter | Type                               | Description                                               |
| --------- | ---------------------------------- | --------------------------------------------------------- |
| `el`      | `HTMLElement \| null \| undefined` | Container element (optional for headless / non-DOM usage) |
| `options` | `OdontogramOptions`                | Configuration (see below)                                 |

### Methods

#### Interface locale

The `locale` option controls odontogram UI text independently from `notation`, view selection, and dental orientation. Built-in `en` and `es` catalogs cover integrated controls, legend, surface and tooth presence names, chart summary, accessible target names, orientation labels, and common runtime errors. Change language at runtime with `setOption("locale", "es")`; selection, marks, tooth state, and annotations remain in odontogram state and are preserved by the redraw.

Applications can register a locale and override any subset of messages. Missing messages fall back one key at a time to English. Lookup order is per-instance `localeText`, registered locale messages, English defaults, then the message key. Tags are matched by their base language (`es-MX` uses `es`).

```ts
import { Odontogram, registerLocale } from "@odontogram/core";

registerLocale("ar", {
  direction: "rtl",
  messages: {
    "ui.legend": "مفتاح المخطط",
    "surface.occlusal": "إطباقية",
  },
});

const chart = new Odontogram(container, {
  plugins: [svgPlugin],
  locale: "ar",
  localeText: { "ui.undo": "تراجع" },
});
chart.setOption("locale", "es"); // switches text without clearing chart state
```

`registerLocale(tag, locale)` merges messages when a tag is registered more than once. Set `direction` to `rtl` for an RTL interface. The host adopts that direction while the chart area remains `dir="ltr"`; tooth numbering, quadrant positions, surface codes, and anatomical orientation are never inferred from language direction. Custom controls and mark catalog labels remain application supplied text.

#### Lifecycle & View

##### Sizing and viewport interaction

The SVG renderer accepts `width` and `height` as positive pixel numbers or CSS size strings (`width` defaults to `"100%"`; `height` defaults to `400`). `fitToContainer` defaults to `true` and fits the full chart in the available host area while preserving the SVG aspect ratio. Set `minZoom` / `maxZoom` to bound interactive zoom ratios relative to that fitted view (defaults `1` and `4`).

The pointer and keyboard gestures are scoped to the chart. Ctrl/Command + wheel or trackpad pinch zooms around the pointer; `+` / `-` zooms around the chart center. A middle mouse drag pans at any zoom and a one-finger horizontal drag pans when zoomed in. Ordinary wheel and vertical one-finger movement remain available for page scrolling. Double-click or `Home` restores the fitted view. The SVG viewBox transforms all teeth, labels, surface hit regions, marks, and annotation anchors together. On resize, the current viewBox and selection are retained; hidden containers are ignored until they have measurable size.

```ts
const chart = new Odontogram(container, {
  plugins: [svgPlugin],
  width: "100%",
  height: "min(70vh, 560px)",
  fitToContainer: true,
  minZoom: 1,
  maxZoom: 5,
});
```

##### `render(container?: HTMLElement): void`

Mount the odontogram into the container. Creates a host element and renders the active view. Calling it again on a mounted instance requests an update without duplicating the host or view. If constructed headlessly without a container, passing `container` mounts the instance. `beforeMount` can synchronously return `false` to cancel the first mount.

##### `destroy(): void`

Unmount the odontogram, call view destroy hooks, remove DOM event listeners, and remove the host element. It is safe to call repeatedly; a later `render()` may mount the same instance again.

##### `getOption<K>(name: K): OdontogramOptions[K]`

Get the current value of an option. Returns the default if not explicitly set.

##### `setOption<K>(name: K, value: OdontogramOptions[K]): void`

Set a runtime-updatable option dynamically. Triggers an update of affected controls and the active view. Invalid values throw `OdontogramValidationError`.

**Recreation-only options** throw `OdontogramError` with code `ERR_IMMUTABLE_OPTION` when changed after construction:

- `plugins` — register plugins at construction time
- `initialView` — use `changeView()` to switch the active view
- `mode` — choose internal or controlled mode at construction
- `instanceId`, `toothResources`, and `toothResourceFallback` — establish DOM identity and resource resolution at construction

All other declared `OdontogramOptions` are runtime-updatable, including callbacks and presentation, selection, validation, and locale options. `viewOptions` is runtime-updatable; use `changeView(view, viewOptions)` when changing the active view and its scope together.

##### `changeView(view: ViewType, viewOptions?: ViewOptions): void`

Switch to a different view and optional sub-view configuration. Unmounts the previous view and mounts the target view while guaranteeing **zero data loss** (all marks, biological tooth overlays, and selection states are strictly preserved in model state).

`beforeViewChange({ previousView, view })` runs synchronously before a changed view commits. Return `false` to cancel. `viewDidChange({ previousView, view })` runs after the new view has mounted. A no-op change to the current view updates its options and requests a render without emitting view-change notifications.

**Supported View Types & Shorthands:**

- **Full Dentition**: `"permanent"` (32 teeth), `"deciduous"` / `"primary"` (20 teeth), `"mixed"` (52 teeth in anatomical 4-row layout).
- **Arch Views**: `"arch"` with `viewOptions: { arch: "upper" | "lower" }`, or shorthands `"upper"`, `"lower"`, `"maxillary"`, `"mandibular"`.
- **Quadrant Views**: `"quadrant"` with `viewOptions: { quadrant: 1..8 }`, or shorthands `"quadrant-1"` through `"quadrant-8"`.
- **Tooth Detail Views**: `"tooth"` / `"tooth-detail"` with `viewOptions: { tooth: "16" }`, or shorthands `"tooth-11"` through `"tooth-85"`.

```ts
// Switch to quadrant 1 view with shorthand
odontogram.changeView("quadrant-1");

// Switch to lower arch view with explicit options
odontogram.changeView("arch", { arch: "lower", dentition: "permanent" });

// Switch to single tooth enlarged detail view
odontogram.changeView("tooth", { tooth: "16" });
```

#### State, Mode & Revisions

##### `getState(): OdontogramState`

Return a defensive deep clone of the current state (`view`, `marks`, `selection`, `teeth` overlay). Mutations on the returned object have no effect on internal state.

##### Local undo and redo

`undo(): boolean`, `redo(): boolean`, `canUndo(): boolean`, and `canRedo(): boolean` operate on bounded, in-memory odontogram snapshots. The `historyLimit` option sets the maximum number of undo snapshots (default `100`; `0` disables history). Each successful mutation is one step, and an outer `batch()` or `batchRendering()` commit is one step regardless of how many marks, teeth, or surfaces it changes. A new edit after undo clears redo. Undo and redo validate and notify state callbacks like other updates; `historyDidChange` receives `{ canUndo, canRedo, undoCount, redoCount }` after stack changes.

History belongs to an internal-mode instance and is discarded when the host calls `setState(..., { source: "external" })`, including when loading an imported snapshot. In controlled mode `canUndo()` and `canRedo()` are always false, and undo/redo return `false`; the host remains responsible for any history it needs. No history is serialized or persisted. This convenience feature is not a legal, durable, or complete clinical audit trail.

```ts
const chart = new Odontogram(container, {
  historyLimit: 50,
  historyDidChange: ({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  },
});

chart.batch(() => {
  chart.addMark({ tooth: "16", surfaces: ["M", "O"], type: "caries" });
  chart.setToothState("18", "missing");
});
chart.undo(); // reverses both changes as one odontogram step
```

##### `setState(state: OdontogramState | Partial<OdontogramState>, options?: SetStateOptions): void`

Update state atomically. Partial updates merge with current state. Normalizes mark inputs, increments revision, triggers `marksSet` and `stateDidChange` callbacks, executes validation if configured (triggering `validationDidChange`), and requests a re-render.

##### `getMode(): OdontogramMode`

Returns the operational mode: `"internal"` (default: instance manages its own state) or `"controlled"` (host application drives state).

##### `getRevision(): number`

Returns the monotonic integer revision number representing the count of successful state mutations since initialization.

#### Internal vs controlled mode

| Concern                                                | `mode: "internal"` (default)                    | `mode: "controlled"`                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Source of truth                                        | Odontogram instance                             | Host application                                                                                            |
| Imperative APIs (`addMark`, `selectTooth`, `batch`, …) | Allowed                                         | Throws `ERR_CONTROLLED_MUTATION`                                                                            |
| Host updates                                           | Optional via `setState`                         | Required via `setState` / `reset` with `source: "external"`                                                 |
| UI clicks                                              | Update selection internally (when `selectable`) | Fire `toothClick` / `surfaceClick` only; host updates `selection` via `setState`                            |
| Revision sync                                          | Auto-increment on change                        | Pass `revision` in `SetStateOptions`; regressions (`revision` &lt; current) throw `ERR_REVISION_REGRESSION` |

In controlled mode, compound host updates should use a **single** `setState` call (not `batch`).

#### Read-only interaction mode

Set `readOnly: true` to make rendered chart selection handlers no-ops. Tooth and surface click callbacks still run, and existing selection, marks, and query methods remain available. The integrated toolbar disables its mutation controls in read-only and controlled modes. Changing a selection through `setSelection()` and executing commands are programmatic operations and remain available in internal mode; `mode: "controlled"` continues to reject imperative mutations. Consumer-owned controls can use `ToolbarContext.readOnly` when deciding whether to enable actions. The option does not clear selection or mark data.

Set `disabled: true` to disable rendered tooth and surface activation and integrated toolbar actions. Unlike `readOnly`, disabled mode does not dispatch tooth or surface click callbacks. Both options preserve chart data.

#### Optional integrated controls, legends, and detail hooks

The schematic SVG implements the odontogram keyboard and screen-reader pattern described in [accessibility guidance](accessibility.md). It uses a roving tooth/surface focus sequence, exposes presence and marks in target names, and includes a synchronized text equivalent. The text equivalent summarizes the currently visible chart; consumers should retain their own textual record if they hide the SVG view.

The built-in controls are opt-in. Omit `toolbar` or set it to `false` for a chart without controls. `toolbar: {}` renders the standard view, mark, selection, and history groups. Set `position` to `top`, `bottom`, `left`, or `right`. Supply `groups` to replace and order the groups; each group's `controls` list can contain built-in ids (`views`, `marks`, `selection`, `history`) or custom buttons. The built-in mark group uses `executeCommand()` and history availability, and disables unavailable actions.

```ts
const chart = new Odontogram(container, {
  plugins: [svgPlugin],
  toolbar: {
    position: "top",
    groups: [
      { id: "navigation", label: "View", controls: ["views"] },
      { id: "editing", label: "Edit", controls: ["marks", "selection", "history"] },
      {
        id: "custom",
        controls: [
          {
            id: "apply-caries",
            label: "Apply caries",
            disabled: ({ readOnly, state }) =>
              readOnly ||
              (state.selection.teeth.length === 0 && state.selection.surfaces.length === 0),
            onClick: ({ executeCommand }) =>
              executeCommand({
                type: "apply-mark",
                mark: { type: "caries", status: "planned" },
              }),
          },
        ],
      },
    ],
  },
  markCatalog: [
    { type: "caries", status: "planned", label: "Caries", symbol: "×", color: "#d32f2f" },
  ],
});
```

The legend is generated from `markCatalog` plus mark types/statuses present in the current state. Entry labels, symbols, and colors may be customized through catalog entries. Use `legend: false` to hide it or `legend: { label, items }` to supply explicit entries. This catalog is for odontogram symbols/statuses; it does not change mark validation or serialization.

Built-in interface strings use `locale`. To replace one or more strings for one chart, set `localeText` to a partial message map; custom values override registered and English messages. The supported keys are the `LocaleMessageKey` TypeScript union exported by `@odontogram/core`.

`detailDidChange` is called when a tooth or surface receives keyboard focus or is activated by click/touch. Its argument contains the canonical tooth id, optional single surface, selected or marked surfaces on that tooth, matching marks, trigger, and source event. Consumers can use it to update an accessible live region, tooltip, or popover. The SVG chart's surface and tooth targets are keyboard focusable, and touch activation uses the same click path.

See the [integrated and consumer-owned UI example](../examples/controls/index.html) for both approaches using the same chart methods.

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

#### Selection mark commands

`executeCommand(command: OdontogramCommand): OdontogramCommandResult` provides a UI-independent command API. A built-in toolbar or a consumer-owned UI can call the same method; commands operate only on odontogram marks and their odontogram selection.

```ts
const applied = odontogram.executeCommand({
  type: "apply-mark",
  mark: { type: "restoration", status: "planned", text: "Composite" },
});

const edited = odontogram.executeCommand({
  type: "edit-mark",
  markId: "mark-123",
  patch: { status: "completed", metadata: { material: "composite" } },
});

const deleted = odontogram.executeCommand({ type: "delete-mark", markId: "mark-123" });
```

- `apply-mark` creates one mark for the current selection. Selected surfaces take precedence over selected teeth; surfaces on several teeth become one `complex` target. A whole tooth selection becomes a tooth target, and multiple teeth become one grouped target. Empty or locked targets reject the whole action.
- `edit-mark` changes only the named mark and preserves its id. `delete-mark` removes only the named mark and clears that id from selected annotations.
- The candidate state is validated before commit. A successful command makes one state update/revision and emits the normal state and mark callbacks once.
- Results have `ok: true` plus the affected marks and revision, or `ok: false` plus `error`, `code`, optional validation `issues`, and a `cancelled` flag for a veto or locked target. A rejected command leaves state and revision unchanged.
- `beforeMarkCommand` receives cloned previous and candidate state snapshots after validation and before commit. Return `false` synchronously to veto. Throwing also rejects the command; asynchronous callbacks are unsupported. The callback is invoked only for a command that would change marks.

Locked targets are configured through `lockedTeeth` and `lockedSurfaces`. If any target in an applied multi-target selection is locked, the command is cancelled atomically; no eligible subset is applied. Edit and delete commands are also cancelled when any target of that specific mark is locked. Existing CRUD methods remain available for lower-level programmatic integrations.

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

Return a defensive clone of current selection (`{ teeth; surfaces; annotations? }`). `annotations` contains selected mark ids.

##### `setSelection(selection: SelectionState): void`

Set selection directly. Validates selection and triggers `selectionDidChange`.

##### `selectTooth(toothId: ToothId, mode?: "replace" | "add" | "toggle"): void`

Select, append, or toggle tooth selection programmatically.

##### `selectSurface(toothId: ToothId, surface: SurfaceId, mode?: "replace" | "add" | "toggle"): void`

Select, append, or toggle surface selection programmatically.

The SVG view uses a normal click to replace selection (clicking the selected target again clears it), Shift+click to add to the current selection, and Ctrl/Cmd+click to toggle a target in a multiple selection. Enter or Space activates the focused tooth or surface; Shift+Enter/Space adds it. Surface controls and tooth groups are keyboard focusable. Touch uses the browser's click activation, so it follows the same single activation path as a mouse click without a separate touch handler.

Selection can be constrained with `lockedTeeth`, `lockedSurfaces`, `isToothSelectable`, and `isSurfaceSelectable`. Locked targets are ignored by `selectTooth` and `selectSurface` as well as chart interaction. `selectable: false` disables UI and imperative selection methods. `setSelection` and controlled `setState` remain the host synchronization APIs.

```ts
const odontogram = new Odontogram(container, {
  selectable: true,
  lockedTeeth: ["18"],
  lockedSurfaces: [{ tooth: "16", surface: "O" }],
  isSurfaceSelectable: (tooth, surface) => !(tooth === "11" && surface === "I"),
  toothClick: ({ target, selection, jsEvent }) => {
    console.log(target, selection, jsEvent);
  },
});
```

Tooth and surface click callbacks include a discriminated `target` (`{ kind: "tooth", tooth }` or `{ kind: "surface", tooth, surface }`), a defensive `selection` snapshot after the interaction, and the original `jsEvent` when the renderer has one. `jsEvent` is optional so custom renderers can report an activation without a DOM event.

##### `clearSelection(): void`

Clear all selected teeth, surfaces, and annotations.

##### `resetSelection(): void`

Alias for `clearSelection()`.

##### `isToothSelected(toothId: ToothId): boolean`

Returns `true` if the specified tooth is selected.

##### `isSurfaceSelected(toothId: ToothId, surface: SurfaceId): boolean`

Returns `true` if the specified surface is selected.

##### `selectAnnotation(markId: string): void` and `isAnnotationSelected(markId: string): boolean`

Select a mark, including a multi-tooth annotation, as one unit. The selected id is exposed in `getSelection().annotations`. In controlled mode, set the host-owned selection through `setState()`.

#### Atomic Batch Transactions & Maintenance

##### `batch<T>(fn: () => T, options?: BatchOptions): T`

Execute compound operations inside an atomic transaction:

- Changes are buffered until `fn` finishes.
- If an error or validation failure occurs inside `fn`, **all changes are rolled back** to the pre-batch snapshot.
- On success, triggers a single revision increment, single `stateDidChange` callback, and single DOM re-render.

##### `batchRendering(fn: () => void): void`

Compatibility form of `batch`: executes `fn` transactionally with state notifications and rendering deferred until completion. The outermost batch emits each changed data/selection notification once, one edit notification, and one render. Nested batches commit at the outermost boundary. `batchRendering` retains its `void` return type; use `batch<T>(fn)` when the callback result is needed.

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

#### Interoperability & Document Serialization (Stage 07)

Stage 07 allows consumer systems (EHRs, practice management systems, clinical registries) to cleanly serialize, save, validate, migrate, and restore an odontogram in their own systems. The domain contract is strictly limited to the odontogram domain, requiring no patient identity or storage dependencies.

##### `exportDocument(options?: ExportDocumentOptions): OdontogramDocument`

Export the current chart model to a clean, schema-compliant `OdontogramDocument` object.

- **Exclusion by default**: DOM elements, functions, event listeners, and transient selection state are excluded by default.
- **Optional visual settings**: Pass `includeVisualSettings: true` to include serializable presentation options (`notation`, `locale`, `showOrientationLabels`, `showMidline`, `toothColor`, `surfaceColor`, `selectionColor`, `markColors`, `statusColors`, `minZoom`, `maxZoom`).
- **Optional selection**: Pass `includeSelection: true` to include transient selection state.
- **Metadata & Extensions**: Custom document-level `metadata` and custom top-level `extensions` can be supplied and are persisted in the exported payload.

```ts
const document = odontogram.exportDocument({
  includeVisualSettings: true,
  metadata: {
    exportDate: new Date().toISOString(),
    clinicId: "clinic-101",
  },
});
```

##### `toJSON(): OdontogramDocument`

Alias for `exportDocument()` providing native `JSON.stringify(odontogram)` serialization compatibility.

##### `importDocument(doc: unknown, options?: ImportDocumentOptions): OdontogramImportResult`

Import a serialized `OdontogramDocument` into the chart instance atomically.

- **Atomic validation**: Validates document structure, schema version, tooth presence coexistence, and clinical targets before replacing state. If validation fails, throws `OdontogramValidationError` with detailed diagnostic issues, leaving the existing instance state and revision completely untouched.
- **Automatic migration**: Automatically executes schema migrations for older document versions (e.g. legacy/unversioned snapshots -> `"1.0.0"`).
- **Future version rejection**: Rejects documents with a `schemaVersion` newer than supported (e.g. `"2.0.0"` > `"1.0.0"`) with diagnostic code `ERR_UNSUPPORTED_FUTURE_VERSION`.
- **Preservation of unknown extensions**: Strictly preserves unknown extension properties and custom metadata across save and restore cycles without data loss.

```ts
try {
  const result = odontogram.importDocument(jsonPayload, {
    applyVisualSettings: true,
  });
  console.log("Document restored successfully, schema version:", result.schemaVersion);
} catch (error) {
  if (error instanceof OdontogramValidationError) {
    console.error("Document import rejected atomically:", error.issues);
  }
}
```

##### `validateOdontogramDocument(doc: unknown, config?: ValidatorConfig): ValidationResult`

Pure validation function to validate a candidate document against the schema and clinical rules without needing an active Odontogram instance.

##### `migrateOdontogramDocument(rawDoc: unknown, targetVersion?: string, customMigrations?: DocumentMigration[])`

Pure function to execute registered or custom migrations on a raw document.

##### `registerDocumentMigration(migration: DocumentMigration): void`

Register a custom migration function from one schema version to another.

##### JSON Schema Specification

The canonical JSON schema for exported documents is available at:
`https://lib-odontograma.dev/schemas/odontogram-document.schema.json`
Or bundled in the `@odontogram/core` package at:
`@odontogram/core/schema/odontogram-document.schema.json`.

#### Data Loading & Concurrency Handling (Stage 07)

Odontogram supports loading data from consumer-provided asynchronous functions or static initial data snapshots while guaranteeing race-condition safety, request cancellation via standard `AbortSignal`, validation before applying results, and protection against accidental data loss of pending local edits.

The data loading architecture is strictly decoupled from any backend, URL, or authentication protocol. The consumer provides a pure async loader function:

```ts
import { Odontogram, type OdontogramDataLoader } from "@odontogram/core";

const fetchPatientChart: OdontogramDataLoader = async ({ signal, reason, params }) => {
  const response = await fetch(`/api/patients/${params?.patientId}/odontogram`, { signal });
  if (!response.ok) throw new Error("Failed to load chart from clinical backend");
  return response.json();
};

const chart = new Odontogram(container, {
  loader: fetchPatientChart,
  autoload: true,
  dataLoadingDidChange: ({ loading }) => {
    loadingSpinner.style.display = loading ? "block" : "none";
  },
  dataDidLoad: ({ state, source }) => {
    console.log("Chart loaded successfully with", state.marks.length, "marks");
  },
  dataLoadDidFail: ({ error, aborted }) => {
    if (!aborted) showToast(`Failed to load chart: ${error.message}`);
  },
});
```

##### `refetch(options?: RefetchOptions): Promise<OdontogramLoadResult>`

Trigger a data reload using the configured `loader` function.

- **Concurrency & Cancellation**: Aborts any active in-flight loader request via its `AbortSignal` and increments the internal request identifier.
- **Stale Response Dropping**: If multiple loads occur or responses arrive out-of-order, stale responses are dropped without updating instance state.
- **Validation Before Application**: Validates the returned payload (document or state) against structural, coexistence, and clinical rules. If invalid, throws `OdontogramValidationError` and leaves existing state untouched.
- **Pending Local Edits Safety**: If the chart contains unsaved local edits (`hasPendingEdits() === true`), `refetch()` rejects with `ERR_UNSAVED_EDITS` to prevent silent data loss. To intentionally overwrite local edits, pass `refetch({ force: true })`.

```ts
// Unforced reload (safely rejects if user made unsaved edits)
await chart.refetch({ params: { encounterId: "enc-102" } });

// Forced reload (explicitly overwrites local edits)
await chart.refetch({ force: true });
```

##### `loadData(loader: OdontogramDataLoader, options?: RefetchOptions): Promise<OdontogramLoadResult>`

Execute an ad-hoc consumer-provided loader function against the chart instance.

##### `isLoading(): boolean`

Returns `true` if an asynchronous data loader is currently in progress.

##### `isDirty(): boolean` / `hasPendingEdits(): boolean`

Returns `true` if the chart state differs from the baseline snapshot established on initialization, import, or last successful data load.

##### `markClean(): void`

Sets the current state snapshot as the clean baseline (e.g. after the host application saves local edits to its database).

##### `getBaselineState(): OdontogramState | null`

Returns a defensive copy of the current clean baseline state snapshot.

---

## OdontogramOptions

| Option                 | Type                                                                           | Default       | Description                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------- |
| `mode`                 | `"internal" \| "controlled"`                                                   | `"internal"`  | Operational state management mode                                                             |
| `plugins`              | `OdontogramPlugin[]`                                                           | `[]`          | Plugins to register                                                                           |
| `initialView`          | `ViewType`                                                                     | `"permanent"` | Starting view                                                                                 |
| `notation`             | `"fdi" \| "universal" \| "palmer"`                                             | `"fdi"`       | Tooth label notation                                                                          |
| `height`               | `number \| string`                                                             | `400`         | Container height                                                                              |
| `width`                | `number \| string`                                                             | `"100%"`      | Container width                                                                               |
| `fitToContainer`       | `boolean`                                                                      | `true`        | Fit complete SVG chart in host while preserving aspect ratio                                  |
| `minZoom` / `maxZoom`  | `number`                                                                       | `1` / `4`     | Interactive zoom bounds relative to the fitted chart                                          |
| `selectable`           | `boolean`                                                                      | `true`        | Enable selection                                                                              |
| `disabled`             | `boolean`                                                                      | `false`       | Disable rendered activation and built-in toolbar actions                                      |
| `readOnly`             | `boolean`                                                                      | `false`       | Ignore selection mutations from rendered chart interactions; imperative APIs remain available |
| `toolbar`              | `false \| ToolbarOptions`                                                      | `undefined`   | Optional integrated controls, their position, ordered groups, and custom buttons              |
| `legend`               | `false \| LegendOptions`                                                       | auto          | Hide the generated mark legend or customize its heading and entries                           |
| `markCatalog`          | `MarkCatalogEntry[]`                                                           | `[]`          | Active mark type/status labels and symbols used by controls and legend                        |
| `toothColor`           | `string`                                                                       | `"#f5f5f5"`   | Default tooth fill                                                                            |
| `surfaceColor`         | `string`                                                                       | `"#e0e0e0"`   | Default surface fill                                                                          |
| `selectionColor`       | `string`                                                                       | `"#90caf9"`   | Selection highlight                                                                           |
| `markColors`           | `Record<string, string>`                                                       | `{}`          | Type-to-color map                                                                             |
| `statusColors`         | `Record<string, string>`                                                       | `{}`          | Status-to-color map (e.g. planned/completed)                                                  |
| `instanceId`           | `string`                                                                       | auto-assigned | Unique DOM ID prefix for multi-instance defs                                                  |
| `validator`            | `boolean \| ValidatorConfig \| ((state: OdontogramState) => ValidationResult)` | `undefined`   | Auto-validate on state updates                                                                |
| `initialData` / `data` | `OdontogramDocument \| OdontogramState \| OdontogramStateInput`                | `undefined`   | Initial static snapshot to synchronously populate the chart baseline                          |
| `loader`               | `OdontogramDataLoader`                                                         | `undefined`   | Async data loader function receiving AbortSignal and context                                  |
| `autoload`             | `boolean`                                                                      | `true`        | Automatically trigger `loader` on instantiation                                               |

### Callbacks

The lifecycle and state callbacks use this order:

1. `beforeMount` runs before first mount; returning `false` cancels it. `viewDidMount` runs after the view renderer mounts, then `mountDidMount` runs after initial mounting completes.
2. For each state update, applicable cancelable pre-hooks run before commit in this order: `beforeMarkCommand` for a mark command, `beforeViewChange`, `beforeSelectionChange`, then `beforeDataChange`. Returning `false` vetoes the update. A thrown pre-hook is reported through `errorDidOccur` and also vetoes it.
3. After commit, notifications run in this order: `marksSet`, `selectionDidChange`, `toothStateDidChange` (per changed tooth), `validationDidChange`, `stateDidChange`, then `editDidChange`.
4. A view transition then calls `viewWillUnmount`, the view destroy/render hooks, `viewDidMount`, and `viewDidChange`. `detailDidChange` and click callbacks follow the originating DOM interaction.

Pre-hooks are synchronous. Odontogram mutations from any callback are rejected with `ERR_TRANSACTION_FAILED`; schedule them after the callback returns. Read-only queries are safe. Destroying the instance in a callback is allowed and prevents further rendering. Exceptions thrown by notification callbacks do not roll back committed state or stop later notifications; they are passed to `errorDidOccur({ error, phase: "callback", callback })`. If the error callback throws, that exception is logged with `console.error`. Without an error callback, notification exceptions are logged. Exceptions raised during ordinary API calls (for example validation errors) remain thrown to the caller.

| Callback                | Argument                                | When                                          |
| ----------------------- | --------------------------------------- | --------------------------------------------- |
| `beforeMount`           | `() => boolean or void`                 | Before first mount; `false` cancels           |
| `mountDidMount`         | `() => void`                            | After initial mount completes                 |
| `beforeViewChange`      | `{ previousView, view }`                | Before view state commits; `false` cancels    |
| `viewDidChange`         | `{ previousView, view }`                | After target view mounts                      |
| `beforeSelectionChange` | `{ previousSelection, selection }`      | Before selection commits; `false` cancels     |
| `beforeDataChange`      | `{ previousMarks, marks }`              | Before mark data commits; `false` cancels     |
| `toothClick`            | `{ tooth, jsEvent }`                    | User clicks a tooth                           |
| `surfaceClick`          | `{ tooth, surface, jsEvent }`           | User clicks a surface                         |
| `selectionDidChange`    | `{ selection }`                         | Selection state changes                       |
| `marksSet`              | `{ marks }`                             | Marks array changes                           |
| `stateDidChange`        | `{ state, revision, source }`           | Any state change occurs                       |
| `editDidChange`         | `StateChangeArg`                        | After each committed state edit               |
| `beforeMarkCommand`     | `{ command, previousState, nextState }` | Synchronous pre-commit veto for mark commands |
| `toothStateDidChange`   | `{ toothId, state, previousState }`     | Tooth presence overlay changes                |
| `validationDidChange`   | `{ result }`                            | Validation issues change on state update      |
| `detailDidChange`       | `DetailChangeArg`                       | Tooth/surface receives focus or activation    |
| `dataLoadingDidChange`  | `{ loading }`                           | Async data loader starts or finishes          |
| `dataDidLoad`           | `DataLoadSuccessArg`                    | Data loader validates and applies state       |
| `dataLoadDidFail`       | `DataLoadFailArg`                       | Data loader rejects, aborts, or fails check   |
| `errorDidOccur`         | `{ error, phase, callback? }`           | A notification callback throws                |

### Hooks

| Hook                                                                | Argument                                    | When                                                        |
| ------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `toothClassNames` / `surfaceClassNames` / `annotationClassNames`    | Typed tooth, surface, or annotation context | Return a class string or string array                       |
| `toothLabelClassNames` / `toothLabelContent`                        | Tooth context plus notation labels          | Customize the visible tooth label's classes or text         |
| `toothContent` / `surfaceContent` / `annotationContent`             | Typed context including the target element  | Return text, a DOM `Node`, an array of either, or `null`    |
| `toothDidMount` / `surfaceDidMount` / `annotationDidMount`          | Typed context including the mounted element | Mount callback; may return a cleanup function               |
| `toothWillUnmount` / `surfaceWillUnmount` / `annotationWillUnmount` | Matching typed context                      | Called before the owned view element is removed             |
| `markClassNames`, `markDidMount`, `markWillUnmount`                 | `{ mark, el }`                              | Compatibility hooks for annotations and surface/tooth marks |
| `viewDidMount`                                                      | `{ view, el }`                              | View rendered                                               |
| `viewWillUnmount`                                                   | `{ view, el }`                              | View destroyed                                              |

### Custom tooth resources and content ownership

`toothResources` accepts inline SVG markup keyed by FDI tooth id. Each resource must pass the `@odontogram/svg` contract: `viewBox="0 0 44 52"`, all required layers, an outline, the three anchors, and applicable clinical surfaces for that tooth. The renderer embeds the resource anatomy with per-instance prefixed ids and retains its own surface interaction groups, so selection and canonical `data-tooth` / `data-surface` identity remain stable. `toothResourceFallback` is `"schematic"` by default; invalid resources use the built-in schematic. Set it to `"error"` to make an invalid override fail during render.

Content hooks may return strings, DOM nodes, arrays, or `null`/`undefined`. Strings become text nodes (never parsed as HTML). Returned DOM nodes are cloned into an engine-owned SVG group, so the original remains owned by the application. Content hooks run again after view state updates and their returned group is replaced. Mount hooks may return a disposer; the renderer calls it once before the corresponding unmount hook or when an annotation is removed. Consumers should release subscriptions, observers, or other external resources in that disposer. The view element and its children remain renderer-owned; custom code should add content through the hooks and should not detach or replace renderer nodes.

The read-only `ToothContext`, `ToothLabelContext`, `SurfaceContext`, `AnnotationContext`, and `ViewContext` types, plus lifecycle contexts (`ToothMountArg`, `SurfaceHookArg`, `AnnotationHookArg`) and class hook types, are exported from `@odontogram/core`. Custom view plugins receive `ViewRenderContext` with the current chart state and selection methods. Resource validation helpers and the normative SVG structure are documented in [the SVG resource contract](svg-contract.md).

```ts
new Odontogram(container, {
  plugins: [svgPlugin],
  surfaceClassNames: ({ surface, isSelected }) => [
    `surface-${surface.toLowerCase()}`,
    ...(isSelected ? ["is-selected"] : []),
  ],
  surfaceContent: ({ surface }) => `Surface ${surface}`,
  annotationDidMount: ({ mark, el }) => {
    const observer = observeAnnotation(mark, el);
    return () => observer.disconnect();
  },
});
```

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
  | {
      kind?: "teeth" | "group";
      teeth: ToothId[]; // ordered target ids
      targets?: Array<{
        tooth: ToothId;
        role?: "support" | "pontic" | string;
        anchor?: "anchor-center" | "anchor-mesial" | "anchor-distal";
      }>;
    } // Multi-tooth annotation (e.g. bridge)
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

For connected symbols, keep `teeth` in drawing order. `targets`, when provided, must list the same tooth ids in the same order; roles and anchor names remain explicit data. A bridge example:

```ts
odontogram.addMark({
  id: "bridge-14-16",
  type: "bridge",
  text: "Planned three-unit span",
  target: {
    kind: "teeth",
    teeth: ["14", "15", "16"],
    targets: [
      { tooth: "14", role: "support", anchor: "anchor-distal" },
      { tooth: "15", role: "pontic", anchor: "anchor-center" },
      { tooth: "16", role: "support", anchor: "anchor-mesial" },
    ],
  },
});
```

The SVG renderer reads the named anchors from the tooth SVG coordinate space and recomputes annotation geometry after view changes and resize notifications. Hidden targets keep their place in the mark data; only visible targets render, and a connector is drawn only between adjacent visible entries. If no target is visible, the annotation remains in state without geometry. Removing a referenced tooth with `removeMarksForTooth()` removes the whole annotation. Select, edit, and delete the annotation as one mark using `selectAnnotation()`, `updateMark()`, and `removeMark()`; its SVG group has a keyboard focus target and an accessible description from `text` or type and tooth ids. These renderings record annotation geometry and do not infer clinical decisions.

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

interface OdontogramPluginDef {
  id: string;
  version: string;
  apiCompatibility: string;
  errorPolicy?: "isolate" | "throw";
  dependencies?: Array<{ id: string; version?: string }>;
  onRegister?: (context: OdontogramPluginContext) => void | (() => void);
  onUnregister?: (context: OdontogramPluginContext) => void;
  views?: ViewDefinition[];
  dentalRenderers?: DentalRendererDefinition[];
  symbols?: OdontogramSymbolDefinition[];
  tools?: OdontogramToolDefinition[];
  notations?: OdontogramNotationDefinition[];
}
```

Create a typed odontogram extension. Every plugin has a stable `id`, its own semantic `version`, and an `apiCompatibility` semver range. `ODONTOGRAM_PLUGIN_API_VERSION` reports the plugin API provided by this core release. Supported ranges are exact versions, `^`, `~`, `>=`, and `*`.

Dependencies are resolved before registration. Missing ids, incompatible versions, cycles, duplicate plugin or contribution ids, and incompatible core API ranges throw an `OdontogramError` with a specific `ERR_PLUGIN_*` code. Registration calls `onRegister` after contributions are installed. Unregistration first calls the cleanup function returned by `onRegister`, then `onUnregister`, and removes contributions. Cleanup and contribution exceptions are isolated and reported to `pluginDidError`; a failing `pluginDidError` handler is logged.

If a constructor-supplied plugin's `onRegister` throws, that plugin and plugins depending on it are skipped, while unrelated plugins remain registered. The failure is reported through `pluginDidError`. A runtime `registerPlugin()` call reports the failure and throws `ERR_PLUGIN_REGISTRATION_FAILED` to its caller.

```ts
chart.registerPlugin(plugin);
chart.unregisterPlugin("@clinic/bridge-tools"); // returns false when not registered
```

Plugins supplied in the constructor and plugins registered later use the same dependency checks. Dependencies register before dependents and must be unregistered after them. A plugin that owns the active view cannot be unregistered until the chart switches to another view. To load only extensions needed on a particular screen, dynamically import the plugin module at that point and then call `registerPlugin()`; the core does not import plugin packages on its own.

### Odontogram plugin contributions

- **Views** use the existing `ViewDefinition` and `ViewRenderContext`. Contexts expose `getDentalRenderers()`, `getSymbol(markType)`, and `getNotation(id)` so views can consume other registered odontogram contributions.
- **Dental renderers** use `{ id, matches(tooth), render(context) }`. The bundled SVG view invokes the first matching renderer for each tooth, inside its anatomy layer. It passes the tooth id, bounds, notation label, presence, and selection state. Surface geometry and tooth selection remain core/view responsibilities.
- **Symbols** use `{ id, markTypes, render(context) }`. The bundled SVG view invokes the matching renderer for multi-tooth annotations and passes target anchor coordinates, mark, selection, and resolved color.
- **Tools** use `{ id, label, disabled?, onActivate(context) }`. The default integrated toolbar adds a tools group when tools are registered. Custom groups can reference a tool with `{ tool: "tool-id" }`. Tools receive a read-only state snapshot and the odontogram command API.
- **Numbering / Notations** use `{ id, name, description?, format(toothId), formatAccessible?(toothId), parse?(label), isValid?(label) }`. The bundled SVG view and core formatters update rendered tooth labels and screen reader attributes according to the custom numbering system.

Dental renderer, symbol, tool, notation, and lifecycle cleanup failures are reported through `pluginDidError` and isolated from the rest of the odontogram. View `render`, `update`, and `destroy` failures propagate by default so strict renderers can reject invalid dental resources; set `errorPolicy: "isolate"` to report and suppress view failures. A failing `pluginDidError` handler is logged.

### Optional plugin examples

#### Custom bridge symbol and tool

The example in [`examples/plugins/custom-bridge-plugin.ts`](../examples/plugins/custom-bridge-plugin.ts) adds a molar anatomy overlay, a bridge symbol, and an “Apply bridge” toolbar tool. Load it dynamically only where bridge editing is enabled:

```ts
if (bridgeEditingEnabled) {
  const { customBridgePlugin } = await import("../examples/plugins/custom-bridge-plugin.js");
  chart.registerPlugin(customBridgePlugin);
}
```

#### Custom numbering system (Victor Haderup notation)

The example in [`examples/plugins/custom-haderup-notation-plugin.ts`](../examples/plugins/custom-haderup-notation-plugin.ts) adds support for the Scandinavian Victor Haderup `+`/`-` dental notation:

```ts
import { customHaderupNotationPlugin } from "../examples/plugins/custom-haderup-notation-plugin.js";

const chart = new Odontogram(container, {
  plugins: [svgPlugin, customHaderupNotationPlugin],
  notation: "haderup",
});
```

For compatibility, `createPlugin({ name, views })` is still accepted for existing view-only extensions and normalizes `name` into an id with default metadata. New extensions should always declare `id`, `version`, and `apiCompatibility`.

```ts
interface ViewDefinition {
  type: ViewType;
  render: (ctx: ViewRenderContext) => void;
  update?: (ctx: ViewRenderContext) => void;
  destroy?: (ctx: ViewRenderContext) => void;
}
```

### Incremental View Updating Protocol

When state or options change, the core invokes `activeView.update(ctx)` if defined on the `ViewDefinition`. This allows view plugins to perform fine-grained DOM diffing (updating colors, classes, presence styles, and multi-tooth annotation layers) in place without unmounting or destroying existing DOM elements, ensuring `document.activeElement` focus and selections remain preserved. If `update` is omitted or the active view type changes (e.g. permanent → deciduous), the engine cleanly falls back to unmounting and mounting.

### ViewRenderContext

Passed to view `render` and `destroy` functions:

| Property / Method                           | Description                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `el`                                        | Host HTMLElement                                                          |
| `options`                                   | Current options                                                           |
| `state`                                     | Defensive deep clone of current state (mutations do not affect the store) |
| `requestRender()`                           | Request a re-render                                                       |
| `selectTooth(tooth)`                        | Select a tooth                                                            |
| `selectSurface(tooth, surface)`             | Select a single surface                                                   |
| `toggleSurfaceSelection(tooth, surface)`    | Toggle surface in selection                                               |
| `emitToothClick(tooth, jsEvent)`            | Fire toothClick callback                                                  |
| `emitSurfaceClick(tooth, surface, jsEvent)` | Fire surfaceClick callback                                                |
| `getDentalRenderers()`                      | Return registered dental renderer contributions                           |
| `getSymbol(markType)`                       | Resolve a custom mark symbol renderer                                     |
| `getNotation(notation)`                     | Resolve a custom tooth numbering notation definition                      |
| `getNotations()`                            | Return all registered custom notation definitions                         |

---

## Types

```ts
type ToothId = string; // FDI canonical, e.g. "16"
type SurfaceId = "M" | "O" | "I" | "D" | "B" | "L";
type ToothPresence = "present" | "missing" | "unerupted";
type Notation = "fdi" | "universal" | "palmer";
type ViewType =
  | "permanent"
  | "deciduous"
  | "primary"
  | "mixed"
  | "arch"
  | "upper"
  | "lower"
  | "maxillary"
  | "mandibular"
  | "quadrant"
  | `quadrant-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
  | "tooth"
  | "tooth-detail"
  | (string & {});

interface ViewOptions {
  arch?: "upper" | "lower" | "maxillary" | "mandibular";
  quadrant?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  tooth?: ToothId;
  teeth?: ToothId[];
  dentition?: "permanent" | "deciduous" | "primary" | "mixed";
  notation?: Notation;
  orientationLabels?: boolean;
  showMidline?: boolean;
}
```

### Model-Driven Selection Retention on Hidden Targets

Selection in `@odontogram` is strictly model-driven and decoupled from the active view DOM:

- If a user selects teeth in full dentition (e.g. `16`, `36`, and `46`) and then transitions to a partial view (e.g. Upper Arch or Quadrant 1 where `36` and `46` are not rendered), the non-visible teeth **remain preserved** in `state.selection.teeth`.
- When using `visibleTeeth: ToothId[]` filtering, any selected teeth that are temporarily filtered out remain in `state.selection`.
- When switching back to a view where those teeth become visible again, their visual highlights and `aria-selected` attributes are automatically restored without losing any selection context.
- Programmatic selections targeting teeth outside the current active view are committed directly to `state.selection` without error.

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

## `@odontogram/svg/contract`

Normative tooth SVG resource API (Stage 03). Full spec: [`svg-contract.md`](svg-contract.md). Authoring: [`svg-resource-authoring.md`](svg-resource-authoring.md).

```ts
import {
  SVG_CONTRACT_VERSION,
  validateToothSvg,
  parseToothSvgMetadataJson,
  prefixElementIds,
  expectedSurfacesForToothClass,
} from "@odontogram/svg/contract";
```

| Export                                                | Description                                         |
| ----------------------------------------------------- | --------------------------------------------------- |
| `SVG_CONTRACT_VERSION`                                | Contract semver string (`1.0.0`)                    |
| `validateToothSvg(svg, options?)`                     | Validate markup; optional metadata sidecar          |
| `parseToothSvgMetadata` / `parseToothSvgMetadataJson` | Parse JSON sidecar                                  |
| `prefixElementIds(svg, { prefix })`                   | Prefix ids for multi-instance charts                |
| `expectedSurfacesForToothClass`                       | Delegates to `@odontogram/dentition`                |
| `DEFAULT_TOOTH_VIEWBOX`, `CONTRACT_LAYER_IDS`, …      | Constants from [`svg-contract.md`](svg-contract.md) |

CLI (monorepo root): `npm run validate:svg -- [--metadata sidecar.json] file.svg`

JSON schema: `packages/svg/schema/tooth-svg-metadata.schema.json`. Template: `packages/svg/resources/template/`.

## `@odontogram/svg/catalog`

Occlusal schematic tooth art catalog (Stage 03, issue #9). Overview: [`svg-catalog.md`](svg-catalog.md).

```ts
import {
  getManifest,
  getOrientationKey,
  listCatalogFamilies,
  resolveToothSvgResource,
} from "@odontogram/svg/catalog";
```

| Export                                               | Description                                             |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `getManifest()`                                      | `families` (16) + `teeth` (52 FDI bindings)             |
| `getOrientationKey(toothId)`                         | Patient side + arch key for catalog lookup              |
| `resolveToothSvgResource(toothId)`                   | `resourceId`, paths under `resources/`, manifest fields |
| `listCatalogFamilies()` / `listCatalogResourceIds()` | Enumerate shared art families                           |
| `listTeethForCatalogResource(resourceId)`            | FDI ids sharing one SVG family                          |
| `assertManifestCoversCatalog(toothIds)`              | Test helper — manifest vs dentition                     |

Node disk loader: `import { loadCatalogSvgMarkup } from "@odontogram/svg/catalog/node"`.

Review gallery: `npm run gallery` (`examples/svg-gallery`).
