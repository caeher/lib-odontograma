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
export type ViewType =
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
  | "quadrant-1"
  | "quadrant-2"
  | "quadrant-3"
  | "quadrant-4"
  | "quadrant-5"
  | "quadrant-6"
  | "quadrant-7"
  | "quadrant-8"
  | "tooth"
  | "tooth-detail"
  | (string & {});

/** Configuration options for active view presentation and scoping. */
export interface ViewOptions {
  /** Target dentition system for view scoping. */
  dentition?: "permanent" | "primary" | "deciduous" | "mixed";
  /** Target dental arch for arch views. */
  arch?: "maxillary" | "mandibular" | "upper" | "lower";
  /** Target quadrant (1-8) for quadrant views. */
  quadrant?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | number;
  /** Target tooth ID for single-tooth detail views. */
  tooth?: ToothId;
  /** Explicit whitelist filter of visible teeth. */
  visibleTeeth?: ToothId[];
  /** Whether to render patient right/left orientation indicators (default: true). */
  showOrientationLabels?: boolean;
  /** Whether to render anatomical midline dividers (default: true). */
  showMidline?: boolean;
}

/** Visual style overrides for marks or teeth. */
export interface MarkStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/** Semantic lifecycle status of a finding or procedure. */
export type MarkStatus =
  "existing" | "planned" | "completed" | "proposed" | "referred" | (string & {});

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
  /** Ordered tooth ids. Order is preserved by renderers for connected annotations. */
  teeth: ToothId[];
  /** Optional per-tooth roles for symbols that distinguish supports from pontics. */
  targets?: MultiToothTargetEntry[];
  surfaces?: never;
}

/** Ordered tooth entry for a multi-tooth odontographic symbol. */
export interface MultiToothTargetEntry {
  tooth: ToothId;
  role?: "support" | "pontic" | (string & {});
  /** Stable renderer anchor name to use for this tooth (defaults to anchor-center). */
  anchor?: string;
}

/** Target specifying multiple teeth with optional per-tooth surface specifications. */
export interface ComplexTarget {
  kind?: "complex" | "elements";
  elements: Array<{ tooth: ToothId; surfaces?: SurfaceId[] }>;
}

/** Target scope descriptor for an odontographic mark or annotation. */
export type MarkTarget = ToothSurfaceTarget | WholeToothTarget | MultiToothTarget | ComplexTarget;

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
      id?: string;
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
  /** Rule identifier (e.g. "mark-id-unique", "surface-applicability"). */
  ruleId: string;
  /** Typed machine-readable diagnostic code (e.g. "ERR_DUPLICATE_MARK_ID", "ERR_INAPPLICABLE_SURFACE"). */
  code?: string;
  /** Severity level ("error" or "warning"). */
  severity: ValidationSeverity;
  /** Human-readable explanation of the issue. */
  message: string;
  /** Property or field path where the issue originated (e.g. "marks[0].target.surfaces[1]", "teeth.16.presence"). */
  path?: string;
  /** Identifier of the affected mark, if applicable. */
  markId?: string;
  /** Identifier of the affected tooth, if applicable. */
  toothId?: ToothId;
  /** Identifier of the affected surface, if applicable. */
  surface?: SurfaceId;
  /** Additional diagnostic context or metadata. */
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
  rules?: Record<string, boolean | { severity?: ValidationSeverity; enabled?: boolean }>;
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
  /** Selected odontographic marks, including multi-tooth annotations. */
  annotations?: string[];
}

/** Input state snapshot, allowing flexible / legacy mark inputs. */
export interface OdontogramStateInput<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  view?: ViewType;
  marks?: Array<MarkInput<TMeta>>;
  selection?: SelectionState;
  /** Sparse overlay; omitted tooth ids default to present for rendering only. */
  teeth?: Record<ToothId, ToothState>;
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

/** Operating mode of the odontogram instance. */
export type OdontogramMode = "internal" | "controlled";

/** Source of a state change event. */
export type StateChangeSource = "internal" | "external" | "batch" | "reset" | "interaction";

/** Criteria for filtering or querying marks. */
export interface MarkFilter {
  tooth?: ToothId;
  type?: string;
  status?: MarkStatus;
}

/** Options for state reset operations. */
export interface ResetOptions {
  /** If true, preserves the current active view; otherwise resets to initialView. */
  keepView?: boolean;
  /** If true, preserves the current selection; otherwise clears selection. */
  keepSelection?: boolean;
  /** Specific view to reset to (overrides initialView). */
  initialView?: ViewType;
}

/** Options for per-tooth state mutations. */
export interface SetToothStateOptions {
  /** If true, automatically prunes marks that become invalid under the new tooth presence. */
  pruneMarks?: boolean;
}

/** Options for setState operations. */
export interface SetStateOptions {
  /** Explicit revision identifier to synchronize with host state. */
  revision?: number;
  /** If true, suppresses callback dispatch (render is still queued unless batched). */
  silent?: boolean;
  /** Source tag for the state update. */
  source?: StateChangeSource;
}

/** Options for batch execution. */
export interface BatchOptions {
  /** If true (default), automatically rolls back state if an error is thrown inside the batch. */
  transactional?: boolean;
}

/** Callback argument for general state change events. */
export interface StateChangeArg {
  /** Current state snapshot after the update. */
  state: OdontogramState;
  /** Snapshot of state before the update. */
  previousState: OdontogramState;
  /** Current revision counter. */
  revision: number;
  /** Origin source of the state change. */
  source: StateChangeSource;
  /** Root state properties that were modified. */
  changedProperties: Array<keyof OdontogramState>;
}

/** Callback argument for individual tooth presence change events. */
export interface ToothStateChangeArg {
  toothId: ToothId;
  state: ToothState;
  previousState: ToothState;
}

/** Odontogram configuration options. */
export interface OdontogramOptions {
  plugins?: OdontogramPlugin[];
  mode?: OdontogramMode;
  initialView?: ViewType;
  notation?: Notation;
  height?: number | string;
  selectable?: boolean;
  toothColor?: string;
  surfaceColor?: string;
  selectionColor?: string;
  markColors?: Record<string, string>;
  statusColors?: Record<string, string>;
  instanceId?: string;
  viewOptions?: ViewOptions;
  showOrientationLabels?: boolean;
  showMidline?: boolean;
  visibleTeeth?: ToothId[];

  validator?: boolean | ValidatorConfig | ((state: OdontogramState) => ValidationResult);

  toothClick?: (arg: ToothClickArg) => void;
  surfaceClick?: (arg: SurfaceClickArg) => void;
  selectionDidChange?: (arg: SelectionChangeArg) => void;
  marksSet?: (arg: MarksSetArg) => void;
  validationDidChange?: (arg: ValidationChangeArg) => void;
  stateDidChange?: (arg: StateChangeArg) => void;
  toothStateDidChange?: (arg: ToothStateChangeArg) => void;

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
  update?: (ctx: ViewRenderContext) => void;
  destroy?: (ctx: ViewRenderContext) => void;
}

/** Context passed to view renderers. */
export interface ViewRenderContext {
  el: HTMLElement;
  options: OdontogramOptions;
  state: OdontogramState;
  viewOptions?: ViewOptions;
  requestRender: () => void;
  selectTooth: (tooth: ToothId) => void;
  selectSurface: (tooth: ToothId, surface: SurfaceId) => void;
  selectAnnotation: (markId: string) => void;
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
