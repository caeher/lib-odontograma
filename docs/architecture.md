# Architecture

## Overview

The library follows a layered, plugin-based architecture inspired by [FullCalendar](https://fullcalendar.io)'s design patterns — configuration via options, imperative methods, lifecycle hooks, and opt-in plugins. **No FullCalendar code or resources are used or bundled.**

```
┌─────────────────────────────────────────────┐
│  Host application (vanilla, React, Vue…)    │
├─────────────────────────────────────────────┤
│  Adapters (future)                          │
├─────────────────────────────────────────────┤
│  Plugins: @odontogram/svg, interaction…     │
├─────────────────────────────────────────────┤
│  @odontogram/core                           │
│  Odontogram · options · state · hooks       │
├─────────────────────────────────────────────┤
│  @odontogram/dentition                      │
│  Numbering · surfaces · tooth catalogs      │
└─────────────────────────────────────────────┘
```

## Layer boundaries

### Core (`@odontogram/core`)

**Responsibility:** Instance lifecycle, configuration, state management, mark and target normalization, validation engine, structural coexistence enforcement, plugin registry, hooks/callbacks, `batchRendering`.

**Does not:** Draw SVG/DOM, define tooth geometry, import FullCalendar or any renderer.

**Exports:** `Odontogram`, `createPlugin`, `validateOdontogramState`, `createValidator`, mark query helpers, serialization examples, all option/state/hook types.

### Dental resources (`@odontogram/dentition`)

**Responsibility:** Canonical dental model (tooth records, identifiers, applicable surfaces), tooth numbering labels (FDI, Universal, Palmer), clinical-to-graphic surface mapping, dentition catalogs (permanent, primary, mixed), arch/quadrant metadata, tooth and surface validation predicates.

**Does not:** Render anything, depend on core or svg.

**Pure data layer** — usable independently for validation, conversion, or server-side logic.

See [`dental-review.md`](dental-review.md) for catalog fixtures and professional review gate.

## Separation of Concerns: Model, Data, and Presentation

The library strictly enforces a three-tier separation of concerns:

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. Tooth Chart State (OdontogramState.teeth)                          │
│  - Biological presence overlay (present / missing / unerupted)         │
│  - Sparse map; omitted teeth are default present                       │
├────────────────────────────────────────────────────────────────────────┤
│  2. Recorded Findings & Annotations (OdontogramState.marks)            │
│  - Persistent ID, extensible type, targets, lifecycle status, text     │
│  - Consumer metadata (materials, provider, lab notes, timestamps)      │
│  - Domain recording only — NOT an automated clinical recommendation    │
├────────────────────────────────────────────────────────────────────────┤
│  3. Visual Representation & Styling (Renderer / Options / Plugins)     │
│  - Render plugins (@odontogram/svg), CSS class hooks, style overrides  │
│  - markColors, statusColors, fill/stroke presentation hints            │
└────────────────────────────────────────────────────────────────────────┘
```

### Clinical Recommendation Boundary

A recorded mark is a record of clinical observation, historical finding, or planned procedure. The library **never** transforms recorded marks into automated diagnostic decisions or treatment recommendations. Clinical decision support remains exclusively within the domain of the host application or clinician.

### SVG renderer (`@odontogram/svg`)

**Responsibility:** Interactive incremental SVG view plugin registering `permanent`, `deciduous` (`primary`), `mixed`, `arch`, `quadrant`, and `tooth-detail` views. Renders geometric tooth shapes structured into arch groups, quadrant groups, orientation badges, midline divider, a multi-tooth annotation layer, and per-tooth contract layers (`#layer-anatomy`, `#layer-interaction`, `#layer-focus`, `#layer-marks`, `#layer-labels`). Owns the **tooth SVG resource contract** ([`svg-contract.md`](svg-contract.md)) via `@odontogram/svg/contract`.

**Key Capabilities (Stage 03):**

- **Multi-View Navigation & Zero Data Loss:** Seamless transitions between full dentitions (permanent, deciduous, mixed), single arches (upper/lower), quadrants (1–8), and enlarged single-tooth detail views without losing state, biological overlays, annotations, or selections.
- **Mixed Dentition 4-Row Anatomical Layout:** Arranges 52 teeth across 4 rows (Permanent Upper, Deciduous Upper, Deciduous Lower, Permanent Lower) with exact successor/predecessor horizontal alignment and zero bounding-box overlaps.
- **Orientation & Midline Guides:** Displays clinical patient right (`R` / screen left) and patient left (`L` / screen right) badges and central midline divider across all arch and quadrant configurations.
- **Fine-Grained Incremental Diffing:** `update()` modifies only affected elements in place, preserving DOM nodes and active keyboard/pointer focus during live mutations.
- **Multi-Instance Defs Isolation:** All `<defs>`, clip paths, patterns, and element IDs use instance-scoped prefixes to ensure zero ID collisions when multiple charts are mounted concurrently.
- **Multi-Tooth Annotation Layer:** Dedicated layer rendering connected spans (e.g. bridges across abutments and pontics) with stable mark identity across partial and full views.
- **Container Resilience:** Purely coordinate-based vector layout ensuring flawless rendering in initially hidden containers (`display: none`), responsive resizing, and clean listener/observer teardown on `destroy()`.

**Depends on:** `@odontogram/core` (plugin API, view context), `@odontogram/dentition` (tooth lists, notation labels, surface mapping).

**Does not:** Manage state — reads from `ViewRenderContext.state` and calls context methods for interactions. The default view uses the procedural schematic renderer with incremental updates; shipped **catalog art** is resolved via `@odontogram/svg/catalog` for review tooling and resource validation.

### Plugins

Plugins are created with `createPlugin()` using a stable id, semantic version, plugin API compatibility range, optional dependencies, and registration/cleanup hooks. Contributions can provide views, dental anatomy renderers, odontographic mark symbols, chart tools, and dental numbering systems (notations). The core validates dependency order and compatibility, owns registration lifetimes, and isolates contribution failures. Plugins can be loaded on demand by dynamically importing the module and calling `registerPlugin()`; `unregisterPlugin()` runs cleanup and removes contributions.

The SVG plugin is one renderer implementation. Other view plugins can consume dental renderers and symbols through `ViewRenderContext`, while tools use the core odontogram command interface.

### Adapters (future)

Thin wrappers for React, Vue, Svelte, etc. that manage `Odontogram` lifecycle (mount/unmount) and bridge props to options/state. **Documented as the standard integration pattern:**

- **Packaging structure:** Dedicated packages (e.g. `@odontogram/react`, `@odontogram/vue`).
- **Dependencies:** Declare `@odontogram/core` and the host framework (e.g. `react >= 18`) as `peerDependencies`. Adapters never bundle core to prevent instance duplication.
- **Renderer agnosticism:** Adapters accept `plugins` (e.g. `[svgPlugin]`) as props rather than hardcoding a specific renderer.
- **Controlled vs Uncontrolled:** Prop updates trigger `setOption()` / `setState()` wrapped in `batchRendering()`, and callbacks notify parent component state.

## Distribution and packaging strategy

### Package scope independence

Package names use `@odontogram/*` by default (`@odontogram/core`, `@odontogram/dentition`, `@odontogram/svg`). The architecture makes no assumptions about specific npm scope availability:

- Packages can be republished under alternative scopes (e.g. `@my-org/core`) or unscoped (`odontogram-core`) without internal code changes.
- Internal workspace dependencies use standard version ranges (`0.1.0`).

### Public entry points and CSS

Each package explicitly defines public entry points in `package.json` `exports`:

- **JavaScript & Types:** ESM bundle (`dist/index.js`) and TypeScript declarations (`dist/index.d.ts`).
- **Styles:** Distributable CSS is exposed via `@odontogram/core/style.css` and `@odontogram/svg/style.css`.
- **Contract:** Tooth SVG validation and types via `@odontogram/svg/contract` (see [`svg-contract.md`](svg-contract.md)).
- **Catalog:** Manifest + resolver via `@odontogram/svg/catalog` (see [`svg-catalog.md`](svg-catalog.md)); assets under `packages/svg/resources/catalog/`.
- **Tree-shaking:** `sideEffects` is declared explicitly (`false` for dentition; `["dist/style.css"]` for packages distributing CSS).

## Dependency rules

```
adapters → core
svg → core, dentition
plugins → core
core → (no internal deps)
dentition → (no internal deps)
```

- Core must never import svg, dentition, or adapters.
- Dentition must never import core or svg.
- Svg may import core and dentition.
- Host apps compose packages at the top level.

## FullCalendar inspiration (not dependency)

| FullCalendar concept             | Odontogram equivalent                      |
| -------------------------------- | ------------------------------------------ |
| `Calendar` class                 | `Odontogram` class                         |
| `plugins` option                 | `plugins` option                           |
| `initialView` / `changeView`     | `initialView` / `changeView`               |
| `getOption` / `setOption`        | `getOption` / `setOption`                  |
| Events / event sources           | Marks / state                              |
| `batchRendering`                 | `batchRendering`                           |
| View plugins (dayGrid, timeGrid) | View plugins (permanent, deciduous, mixed) |
| `eventClick`, `dateClick`        | `toothClick`, `surfaceClick`               |
| `eventDidMount`                  | `toothDidMount`, `markDidMount`            |
| Connectors (React, Vue)          | Adapters (future)                          |

The goal is API familiarity for developers who know FullCalendar, without any runtime coupling.

## State Management & Programmatic Operations

### Separation of State and DOM

`@odontogram/core` is strictly decoupled from the DOM. An `Odontogram` instance can be instantiated, queried, and updated headlessly:

- `new Odontogram(null, options)` or `new Odontogram(undefined, options)` runs entirely in memory without requiring a DOM container or window environment.
- All query and mutation operations (`getState()`, `getMarks()`, `addMark()`, `updateMark()`, `removeMark()`, `setToothState()`, `getToothPresence()`, `selectTooth()`, `batch()`, `reset()`, `validate()`) operate directly on the internal state store.
- When an instance is mounted with `.render(container)`, rendering hooks and view plugins subscribe to state changes. When running headlessly, mutations update state and fire data callbacks without DOM rendering errors.

### Defensive Immutability & Stable IDs

To protect internal state integrity across arbitrary consumer access:

- **Defensive Clones**: All state query methods (`getState()`, `getMarks()`, `getMark()`, `getToothState()`, `getSelection()`, `getTeethState()`) return deep-cloned copies. External mutations to returned objects cannot compromise instance state.
- **Input Isolation**: Candidate mark and state payloads passed to `addMark()`, `updateMark()`, `setState()`, or `setToothState()` are cloned before insertion.
- **ID Immutability**: Mark identifiers (`id`) are stable and immutable. Attempting to modify `id` during `updateMark()` or `patch` is ignored or rejected; IDs remain permanent for life of the mark.

### Transactional State Machine & Batch Rollback

Compound dental operations (e.g. placing a multi-unit bridge while extracting an abutment or marking adjacent caries) often require modifying multiple marks and tooth records concurrently:

```ts
odontogram.batch(() => {
  odontogram.addMark({ tooth: "14", type: "restoration", surfaces: ["M", "O"] });
  odontogram.setToothState("15", "missing", { pruneMarks: true });
  odontogram.addMark({ type: "bridge", target: { teeth: ["14", "15", "16"] } });
});
```

The transactional execution engine guarantees:

1. **Atomic Snapshot**: A deep clone of state, options, and revision is captured prior to entering `batch(fn)`.
2. **Transactional Rollback**: If any operation or callback throws an exception or fails validation within `fn`, the entire transaction aborts and state rolls back to the initial snapshot immediately.
3. **Single Revision Increment**: Successful batch transactions increment `revision` exactly once for the whole transaction.
4. **Single Render & Notification**: Subscribed views receive a single consolidated re-render, and `stateDidChange` fires once with the complete compound change.

### Operating Modes: Internal vs. Controlled

`Odontogram` supports two operational paradigms via `mode: "internal" | "controlled"`:

```
┌────────────────────────────────────────────────────────┐
│                   Internal Mode (Default)              │
│  - Odontogram owns authoritative state store           │
│  - Direct UI interactions mutate internal state        │
│  - Helper methods (addMark, setToothState) apply live  │
│  - Increments revision monotonically                   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                   Controlled Mode                      │
│  - Host application owns single source of truth        │
│  - UI interactions fire events/callbacks only          │
│  - State updates arrive via explicit setState()        │
│  - Prevents uncontrolled internal state divergence     │
└────────────────────────────────────────────────────────┘
```

- **`mode: "internal"`**: The instance manages its own state lifecycle. User interactions (e.g. clicking surfaces) directly update internal state, and consumer calls to CRUD methods apply immediately.
- **`mode: "controlled"`**: Used for declarative integrations (such as React or Vue state stores). In controlled mode, internal mutation operations that would cause state drift without host awareness are intercepted (`ERR_CONTROLLED_MUTATION`), ensuring the host application maintains absolute control over the single source of truth. The host pushes snapshots via `setState(..., { source: "external", revision })` and may call `reset()`. View plugins receive a deep-cloned `state` on `ViewRenderContext` and must not mutate selection directly—clicks emit callbacks only.

### Revision contract (controlled)

- `getRevision()` reflects the last applied revision (explicit `SetStateOptions.revision` or auto-increment in internal mode).
- If `setState` is called with `revision` strictly less than the current revision, the update is rejected with `ERR_REVISION_REGRESSION` and state is unchanged.

## Data flow

```
User click on surface (internal mode)
  → svg view handler
  → ctx.toggleSurfaceSelection()
  → core updates state.selection
  → core calls selectionDidChange callback
  → core calls stateDidChange callback (source: "interaction")
  → core calls requestRender()
  → svg view re-renders with updated selection highlight
```

```
User click on surface (controlled mode)
  → svg view handler
  → ctx.emitSurfaceClick() only (selection helpers are no-ops)
  → host handles surfaceClick callback
  → host calls setState({ selection: ... }, { source: "external", revision })
  → core calls selectionDidChange / stateDidChange
  → requestRender() → svg re-renders host-driven selection
```

```
Host app calls addMark(...) or batch(...)
  → core validates candidate update
  → core updates internal state & increments revision
  → core calls marksSet & stateDidChange callbacks (source: "api")
  → core calls requestRender() (or defers until batch end)
  → svg view re-renders with mark colors
```
