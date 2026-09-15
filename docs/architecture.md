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

**Responsibility:** Instance lifecycle, configuration, state management, plugin registry, hooks/callbacks, `batchRendering`.

**Does not:** Draw SVG/DOM, define tooth geometry, import FullCalendar or any renderer.

**Exports:** `Odontogram`, `createPlugin`, all option/state/hook types.

### Dental resources (`@odontogram/dentition`)

**Responsibility:** Tooth numbering (FDI, Universal, Palmer), surface code definitions, dentition catalogs (permanent, deciduous, mixed), arch/quadrant metadata.

**Does not:** Render anything, depend on core or svg.

**Pure data layer** — usable independently for validation, conversion, or server-side logic.

### SVG renderer (`@odontogram/svg`)

**Responsibility:** Schematic SVG view plugin registering `permanent`, `deciduous`, and `mixed` views. Renders geometric tooth shapes with five clickable surface regions and mark overlays.

**Depends on:** `@odontogram/core` (plugin API, view context), `@odontogram/dentition` (tooth lists, notation labels).

**Does not:** Manage state — reads from `ViewRenderContext.state` and calls context methods for interactions.

### Plugins

Plugins are created with `createPlugin()` and registered via the `plugins` constructor option. A plugin can register one or more **views**. The core dispatches render/destroy to the active view.

Stage 01 ships one plugin: `@odontogram/svg`. Future plugins may include:

- Interaction (drag-select, keyboard navigation)
- Anatomical renderer (detailed tooth paths)
- Theme/styling presets

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

## Data flow

```
User click on surface
  → svg view handler
  → ctx.toggleSurfaceSelection()
  → core updates state.selection
  → core calls selectionDidChange callback
  → core calls requestRender()
  → svg view re-renders with updated selection highlight
```

```
Host app calls setState({ marks: [...] })
  → core updates state.marks
  → core calls marksSet callback
  → core calls requestRender() (or defers if inside batchRendering)
  → svg view re-renders with mark colors
```
