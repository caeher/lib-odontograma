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

/** Semantic lifecycle status of a finding or procedure. */
export type MarkStatus =
  | "existing"
  | "planned"
  | "completed"
  | "proposed"
  | "referred"
  | (string & {});

/** Target specifying one or more clinical surfaces on a single tooth. */
export interface ToothSurfaceTarget {
  kind?: "surface" | "surfaces";
  tooth: ToothId;
  surfaces: SurfaceId[];
}

/** Target specifying an entire single tooth (e.g. crown, extraction, implant). */
export interface WholeToothTarget {
  kind?: "tooth";
  tooth: ToothId;
  surfaces?: never;
}

/** Target specifying a group or range of teeth (e.g. bridge, archwire, splint). */
export interface MultiToothTarget {
  kind?: "teeth" | "group";
  teeth: ToothId[];
  surfaces?: never;
}

/** Target specifying multiple teeth with optional per-tooth surface specifications. */
export interface ComplexTarget {
  kind?: "complex" | "elements";
  elements: Array<{ tooth: ToothId; surfaces?: SurfaceId[] }>;
}

/** Target scope descriptor for an odontographic mark or annotation. */
export type MarkTarget =
  | ToothSurfaceTarget
  | WholeToothTarget
  | MultiToothTarget
  | ComplexTarget;

/** An odontographic mark recorded on a tooth, surfaces, or a group of teeth. */
export interface OdontographicMark<TMetadata = Record<string, unknown>> {
  /** Unique persistent identifier for the mark. */
  id: string;
  /** Extensible semantic type of finding or procedure (e.g. "caries", "restoration", "crown", "bridge"). */
  type: string;
  /** Semantic lifecycle status of the finding or procedure. */
  status?: MarkStatus;
  /** Target scope: surfaces on a tooth, a whole tooth, or a multi-tooth group. */
  target: MarkTarget;
  /** Optional clinician observation, notes, or description. */
  text?: string;
  /** Arbitrary consumer/application metadata (e.g. material, fee code, lab info, date). */
  metadata?: TMetadata;
  /** Visual styling overrides (renderer-agnostic presentation hints). */
  style?: MarkStyle;

  /** Convenience/legacy getter for single-tooth target. */
  tooth?: ToothId;
  /** Convenience/legacy getter for surface targets. */
  surfaces?: SurfaceId[];
}

/** Flexible input format for creating or setting marks. */
export type MarkInput<TMetadata = Record<string, unknown>> =
  | OdontographicMark<TMetadata>
  | {
      id: string;
      type: string;
      status?: MarkStatus;
      target?: MarkTarget;
      tooth?: ToothId;
      teeth?: ToothId[];
      surfaces?: SurfaceId[];
      text?: string;
      metadata?: TMetadata;
      style?: MarkStyle;
    };

/** Validation issue severity level. */
export type ValidationSeverity = "error" | "warning";

/** A single validation diagnostic issue. */
export interface ValidationIssue {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  markId?: string;
  toothId?: ToothId;
  surface?: SurfaceId;
  details?: Record<string, unknown>;
}

/** Aggregated validation result. */
export interface ValidationResult {
  /** True if there are zero issues with severity 'error'. */
  valid: boolean;
  /** All issues (both errors and warnings). */
  issues: ValidationIssue[];
  /** Issues with severity 'error'. */
  errors: ValidationIssue[];
  /** Issues with severity 'warning'. */
  warnings: ValidationIssue[];
}

/** Context provided to custom validation rules. */
export interface ValidationContext {
  state: OdontogramState;
  teeth: Record<ToothId, ToothState>;
  marks: OdontographicMark[];
}

/** A custom validation rule function. */
export type CustomValidationRule = (
  state: OdontogramState,
  context: ValidationContext,
) => ValidationIssue[] | ValidationIssue | null | undefined;

/** Configuration options for the odontogram validator. */
export interface ValidatorConfig {
  /** Enable/disable specific rules by ID or configure their severity. */
  rules?: Record<
    string,
    boolean | { severity?: ValidationSeverity; enabled?: boolean }
  >;
  /** Whether to allow marks on missing teeth (default: false). */
  allowMissingToothMarks?: boolean;
  /** Whether to allow marks on unerupted teeth (default: false). */
  allowUneruptedToothMarks?: boolean;
  /** Known incompatible mark type pairs on the same tooth/surface. */
  incompatibleTypes?: Array<[string, string]>;
  /** Custom validation rules. */
  customRules?: CustomValidationRule[];
  /** Custom surface applicability predicate. */
  isSurfaceApplicable?: (tooth: ToothId, surface: SurfaceId) => boolean;
  /** Custom tooth identifier predicate. */
  isValidTooth?: (tooth: ToothId) => boolean;
  /** Strict mode: elevate all warnings to errors. */
  strict?: boolean;
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

/** Callback argument for validation result changes. */
export interface ValidationChangeArg {
  result: ValidationResult;
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
  statusColors?: Record<string, string>;

  validator?:
    | boolean
    | ValidatorConfig
    | ((state: OdontogramState) => ValidationResult);

  toothClick?: (arg: ToothClickArg) => void;
  surfaceClick?: (arg: SurfaceClickArg) => void;
  selectionDidChange?: (arg: SelectionChangeArg) => void;
  marksSet?: (arg: MarksSetArg) => void;
  validationDidChange?: (arg: ValidationChangeArg) => void;

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
