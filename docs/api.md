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

Return a snapshot of current state (view, marks, selection).

#### `setState(state: OdontogramState | Partial<OdontogramState>): void`

Update state. Partial updates merge with current state. Triggers `marksSet` callback and re-render.

#### `batchRendering(fn: () => void): void`

Execute `fn` with rendering deferred. Multiple `setOption` / `setState` / `changeView` calls inside a batch result in a single re-render when the batch completes. Nesting is supported.

---

## OdontogramOptions

| Option           | Type                               | Default       | Description          |
| ---------------- | ---------------------------------- | ------------- | -------------------- |
| `plugins`        | `OdontogramPlugin[]`               | `[]`          | Plugins to register  |
| `initialView`    | `ViewType`                         | `"permanent"` | Starting view        |
| `notation`       | `"fdi" \| "universal" \| "palmer"` | `"fdi"`       | Tooth label notation |
| `height`         | `number \| string`                 | `400`         | Container height     |
| `selectable`     | `boolean`                          | `true`        | Enable selection     |
| `toothColor`     | `string`                           | `"#f5f5f5"`   | Default tooth fill   |
| `surfaceColor`   | `string`                           | `"#e0e0e0"`   | Default surface fill |
| `selectionColor` | `string`                           | `"#90caf9"`   | Selection highlight  |
| `markColors`     | `Record<string, string>`           | `{}`          | Type-to-color map    |

### Callbacks

| Callback             | Argument                      | When                    |
| -------------------- | ----------------------------- | ----------------------- |
| `toothClick`         | `{ tooth, jsEvent }`          | User clicks a tooth     |
| `surfaceClick`       | `{ tooth, surface, jsEvent }` | User clicks a surface   |
| `selectionDidChange` | `{ selection }`               | Selection state changes |
| `marksSet`           | `{ marks }`                   | Marks array changes     |

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
}
```

### OdontographicMark

```ts
interface OdontographicMark {
  id: string;
  tooth: ToothId; // canonical FDI, e.g. "16"
  surfaces: SurfaceId[]; // "M" | "O" | "D" | "B" | "L"
  type: string; // open string, e.g. "caries"
  style?: MarkStyle;
}
```

### SelectionState

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
type SurfaceId = "M" | "O" | "D" | "B" | "L";
type Notation = "fdi" | "universal" | "palmer";
type ViewType = "permanent" | "deciduous" | "mixed" | string;
```
