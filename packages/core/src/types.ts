/** Canonical tooth identifier (FDI notation string, e.g. "16"). */
export type ToothId = string;

/** Standard clinical surface codes. */
export type SurfaceId = "M" | "O" | "I" | "D" | "B" | "L";

/** Explicit tooth presence in the chart (omitted ids are not missing or unerupted). */
export type ToothPresence = "present" | "missing" | "unerupted";

/** Per-tooth chart overlay (sparse; only explicit entries are stored). */
export interface ToothState {
  presence: ToothPresence;
}

/** Supported tooth numbering notations. */
export type Notation = "fdi" | "universal" | "palmer";

/** Built-in view types; plugins may register additional views. */
export type ViewType = "permanent" | "deciduous" | "mixed" | string;

/** Visual style overrides for marks or teeth. */
export interface MarkStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/** An odontographic mark recorded on one or more surfaces of a tooth. */
export interface OdontographicMark {
  id: string;
  tooth: ToothId;
  surfaces: SurfaceId[];
  type: string;
  style?: MarkStyle;
}

/** Current selection state. */
export interface SelectionState {
  teeth: ToothId[];
  surfaces: Array<{ tooth: ToothId; surface: SurfaceId }>;
}

/** Serializable odontogram state snapshot. */
export interface OdontogramState {
  view: ViewType;
  marks: OdontographicMark[];
  selection: SelectionState;
  /** Sparse overlay; omitted tooth ids default to present for rendering only. */
  teeth: Record<ToothId, ToothState>;
}

/** Callback argument for tooth click events. */
export interface ToothClickArg {
  tooth: ToothId;
  jsEvent: MouseEvent;
}

/** Callback argument for surface click events. */
export interface SurfaceClickArg {
  tooth: ToothId;
  surface: SurfaceId;
  jsEvent: MouseEvent;
}

/** Callback argument for selection change events. */
export interface SelectionChangeArg {
  selection: SelectionState;
}

/** Callback argument for marks change events. */
export interface MarksSetArg {
  marks: OdontographicMark[];
}

/** Hook argument for tooth mount/unmount. */
export interface ToothMountArg {
  tooth: ToothId;
  el: Element;
}

/** Hook argument for mark mount/unmount. */
export interface MarkMountArg {
  mark: OdontographicMark;
  el: Element;
}

/** Hook argument for view mount/unmount. */
export interface ViewMountArg {
  view: ViewType;
  el: Element;
}

/** Class name hook context for a tooth. */
export interface ToothClassNamesArg {
  tooth: ToothId;
  isSelected: boolean;
}

/** Class name hook context for a mark. */
export interface MarkClassNamesArg {
  mark: OdontographicMark;
}

/** Odontogram configuration options. */
export interface OdontogramOptions {
  plugins?: OdontogramPlugin[];
  initialView?: ViewType;
  notation?: Notation;
  height?: number | string;
  selectable?: boolean;
  toothColor?: string;
  surfaceColor?: string;
  selectionColor?: string;
  markColors?: Record<string, string>;

  toothClick?: (arg: ToothClickArg) => void;
  surfaceClick?: (arg: SurfaceClickArg) => void;
  selectionDidChange?: (arg: SelectionChangeArg) => void;
  marksSet?: (arg: MarksSetArg) => void;

  toothClassNames?: (arg: ToothClassNamesArg) => string | string[];
  markClassNames?: (arg: MarkClassNamesArg) => string | string[];
  toothDidMount?: (arg: ToothMountArg) => void;
  toothWillUnmount?: (arg: ToothMountArg) => void;
  markDidMount?: (arg: MarkMountArg) => void;
  markWillUnmount?: (arg: MarkMountArg) => void;
  viewDidMount?: (arg: ViewMountArg) => void;
  viewWillUnmount?: (arg: ViewMountArg) => void;
}

/** View definition registered by a plugin. */
export interface ViewDefinition {
  type: ViewType;
  render: (ctx: ViewRenderContext) => void;
  destroy?: (ctx: ViewRenderContext) => void;
}

/** Context passed to view renderers. */
export interface ViewRenderContext {
  el: HTMLElement;
  options: OdontogramOptions;
  state: OdontogramState;
  requestRender: () => void;
  selectTooth: (tooth: ToothId) => void;
  selectSurface: (tooth: ToothId, surface: SurfaceId) => void;
  toggleSurfaceSelection: (tooth: ToothId, surface: SurfaceId) => void;
  emitToothClick: (tooth: ToothId, jsEvent: MouseEvent) => void;
  emitSurfaceClick: (tooth: ToothId, surface: SurfaceId, jsEvent: MouseEvent) => void;
}

/** Plugin definition shape. */
export interface OdontogramPluginDef {
  name: string;
  views?: ViewDefinition[];
}

/** A plugin instance created via createPlugin(). */
export interface OdontogramPlugin {
  pluginDef: OdontogramPluginDef;
}
