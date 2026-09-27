import type { Odontogram } from "./odontogram.js";

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
export type Notation = "fdi" | "universal" | "palmer" | (string & {});

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

/** A typed tooth or surface target that can be selected by the chart UI. */
export type SelectionTarget =
  { kind: "tooth"; tooth: ToothId } | { kind: "surface"; tooth: ToothId; surface: SurfaceId };

/** A domain action requested against the current odontogram selection or a mark id. */
export type OdontogramCommand =
  | { type: "apply-mark"; mark: Omit<MarkInput, "target" | "tooth" | "teeth" | "surfaces"> }
  | { type: "edit-mark"; markId: string; patch: Partial<MarkInput> }
  | { type: "delete-mark"; markId: string };

/** Result of a mark command. Rejected commands leave state and revision unchanged. */
export type OdontogramCommandResult =
  | {
      ok: true;
      command: OdontogramCommand["type"];
      changed: boolean;
      marks: OdontographicMark[];
      revision: number;
    }
  | {
      ok: false;
      command: OdontogramCommand["type"];
      error: Error;
      code?: string;
      issues?: ValidationIssue[];
      cancelled?: boolean;
      revision: number;
    };

/** Synchronous pre-commit hook. Return false to veto; asynchronous results are unsupported. */
export type BeforeMarkCommand = (arg: {
  command: OdontogramCommand;
  previousState: OdontogramState;
  nextState: OdontogramState;
}) => boolean | void;

/** Input state snapshot, allowing flexible / legacy mark inputs. */
export interface OdontogramStateInput<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  view?: ViewType;
  marks?: Array<MarkInput<TMeta>> | ReadonlyArray<MarkInput<TMeta>>;
  selection?: SelectionState;
  /** Sparse overlay; omitted tooth ids default to present for rendering only. */
  teeth?: Record<ToothId, ToothState> | Readonly<Record<ToothId, ToothState>>;
}

/** Serializable odontogram state snapshot. */
export interface OdontogramState {
  view: ViewType;
  marks: OdontographicMark[];
  selection: SelectionState;
  /** Sparse overlay; omitted tooth ids default to present for rendering only. */
  teeth: Record<ToothId, ToothState>;
}

/** Serializable visual presentation settings for the odontogram. */
export interface OdontogramVisualSettings {
  notation?: Notation;
  locale?: string;
  showOrientationLabels?: boolean;
  showMidline?: boolean;
  toothColor?: string;
  surfaceColor?: string;
  selectionColor?: string;
  markColors?: Record<string, string>;
  statusColors?: Record<string, string>;
  fitToContainer?: boolean;
  minZoom?: number;
  maxZoom?: number;
  [key: string]: unknown;
}

/**
 * Public interoperability document representing a serialized odontogram.
 * Excludes DOM nodes, event listeners, callbacks, and transient selection by default.
 */
export interface OdontogramDocument<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  $schema?: string;
  schemaVersion: string;
  view: ViewType;
  dentition?: "permanent" | "primary" | "deciduous" | "mixed" | (string & {});
  viewOptions?: ViewOptions;
  teeth: Record<ToothId, ToothState> | Readonly<Record<ToothId, ToothState>>;
  marks: Array<OdontographicMark<TMeta>> | ReadonlyArray<OdontographicMark<TMeta>>;
  visualSettings?: OdontogramVisualSettings;
  selection?: SelectionState;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Options for exporting an odontogram to a serializable document. */
export interface ExportDocumentOptions {
  /** Target schema version to export (defaults to CURRENT_SCHEMA_VERSION: "1.0.0"). */
  schemaVersion?: string;
  /** Whether to include serializable visual presentation settings. Default: false. */
  includeVisualSettings?: boolean;
  /** Whether to include transient selection state. Default: false. */
  includeSelection?: boolean;
  /** Arbitrary document-level metadata to attach to the exported document. */
  metadata?: Record<string, unknown>;
  /** Optional schema URI to populate $schema. */
  schemaUrl?: string;
  /** Custom root extension properties to preserve and emit. */
  extensions?: Record<string, unknown>;
}

/** Options for importing an odontogram document into an instance. */
export interface ImportDocumentOptions {
  /** Whether to apply serializable visual settings found in the document. Default: true. */
  applyVisualSettings?: boolean;
  /** Whether to restore transient selection if present in the document. Default: false. */
  preserveSelection?: boolean;
  /** Source tag for state change events. Default: "import". */
  source?: StateChangeSource;
  /** Custom validation configuration or validator function. */
  validator?: boolean | ValidatorConfig | ((state: OdontogramState) => ValidationResult);
  /** Strict validation mode (elevates warnings to errors). */
  strict?: boolean;
  /** Custom migrations to register or evaluate during import. */
  migrations?: DocumentMigration[];
}

/** Result of an import operation. */
export interface OdontogramImportResult {
  /** True when import succeeds. */
  ok: true;
  /** The restored odontogram state. */
  state: OdontogramState;
  /** The effective schemaVersion after any migrations. */
  schemaVersion: string;
  /** Whether a migration was applied during import. */
  migrated: boolean;
  /** The original schema version prior to migration, if migrated. */
  migratedFromVersion?: string;
  /** Restored visual presentation settings, if present. */
  visualSettings?: OdontogramVisualSettings;
  /** Restored document metadata, if present. */
  metadata?: Record<string, unknown>;
  /** Unknown extension fields preserved from the original document. */
  extensions?: Record<string, unknown>;
  /** Validation result computed during import. */
  validation: ValidationResult;
}

/** Definition of a schema version migration function. */
export interface DocumentMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Context provided to consumer async data loader functions.
 */
export interface OdontogramLoaderContext {
  /** AbortSignal connected to the current in-flight load request. */
  signal: AbortSignal;
  /** The target odontogram instance. */
  odontogram: Odontogram;
  /** Reason / origin trigger for this load operation (e.g. "initial", "refetch", "loadData", "setOption"). */
  reason: "initial" | "refetch" | "loadData" | "setOption" | (string & {});
  /** Arbitrary parameters passed by the consumer to refetch() or loadData(). */
  params?: Record<string, unknown>;
}

/**
 * Result data payload returned by a consumer-provided data loader.
 */
export type OdontogramLoaderPayload<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> =
  | OdontogramDocument<TMeta>
  | OdontogramState
  | OdontogramStateInput<TMeta>
  | Record<string, unknown>
  | null
  | undefined
  | void;

/**
 * Consumer async loader function.
 */
export type OdontogramDataLoader<TMeta extends Record<string, unknown> = Record<string, unknown>> =
  (
    context: OdontogramLoaderContext,
  ) => Promise<OdontogramLoaderPayload<TMeta>> | OdontogramLoaderPayload<TMeta>;

/**
 * Options for refetching or loading data.
 */
export interface RefetchOptions {
  /** If true, bypasses pending local edits check and overwrites pending unsaved changes. Default: false. */
  force?: boolean;
  /** Arbitrary parameters passed to the loader context. */
  params?: Record<string, unknown>;
  /** Source tag for state change events. Default: "import". */
  source?: StateChangeSource;
  /** Whether to apply serializable visual settings if returned in an OdontogramDocument. Default: true. */
  applyVisualSettings?: boolean;
  /** Whether to restore transient selection if returned in an OdontogramDocument. Default: false. */
  preserveSelection?: boolean;
  /** Custom validator or configuration for validating the loaded payload. */
  validator?: boolean | ValidatorConfig | ((state: OdontogramState) => ValidationResult);
  /** Strict validation mode (elevates warnings to errors). Default: false. */
  strict?: boolean;
}

/**
 * Result of a completed load operation.
 */
export interface OdontogramLoadResult {
  /** True when load and validation succeeded and state was applied. */
  ok: true;
  /** The applied state snapshot. */
  state: OdontogramState;
  /** If an OdontogramDocument was imported, the import result details (schemaVersion, migrations, etc.). */
  importResult?: OdontogramImportResult;
  /** The raw data returned by the loader function. */
  raw: OdontogramLoaderPayload;
}

/** Callback argument when data loading state changes. */
export interface DataLoadingChangeArg {
  /** Whether a data loader is actively executing. */
  loading: boolean;
}

/** Callback argument when data loading succeeds and passes validation. */
export interface DataLoadSuccessArg {
  /** The restored/applied odontogram state snapshot. */
  state: OdontogramState;
  /** The raw data returned by the loader function. */
  data: OdontogramLoaderPayload;
  /** If an OdontogramDocument was imported, the import result. */
  importResult?: OdontogramImportResult;
  /** The source identifier used for the state update. */
  source: StateChangeSource;
}

/** Callback argument when data loading fails, rejects, is aborted, or fails validation. */
export interface DataLoadFailArg {
  /** The error that occurred (e.g. loader rejection, validation error, unsaved edits error, abort). */
  error: unknown;
  /** Whether the load operation was aborted / cancelled. */
  aborted: boolean;
  /** Validation issues if the failure was due to validation errors. */
  issues?: ValidationIssue[];
}

/** Callback argument for tooth click events. */
export interface ToothClickArg {
  target: Extract<SelectionTarget, { kind: "tooth" }>;
  tooth: ToothId;
  selection: SelectionState;
  jsEvent?: Event;
}

/** Callback argument for surface click events. */
export interface SurfaceClickArg {
  target: Extract<SelectionTarget, { kind: "surface" }>;
  tooth: ToothId;
  surface: SurfaceId;
  selection: SelectionState;
  jsEvent?: Event;
}

/** Callback argument for selection change events. */
export interface SelectionChangeArg {
  selection: SelectionState;
}

/** Cancelable pre-change hooks are synchronous; returning false rejects the change. */
export interface ViewChangeArg {
  previousView: ViewType;
  view: ViewType;
}
export interface SelectionWillChangeArg {
  previousSelection: SelectionState;
  selection: SelectionState;
}
export interface DataWillChangeArg {
  previousMarks: OdontographicMark[];
  marks: OdontographicMark[];
}
export interface OdontogramErrorArg {
  error: unknown;
  phase: string;
  callback?: string;
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
  isSelected?: boolean;
  presence?: ToothPresence;
  view?: ViewType;
}

/** Read-only presentation context for one tooth. */
export interface ToothContext {
  tooth: ToothId;
  isSelected: boolean;
  presence: ToothPresence;
  view: ViewType;
}

/** Context for a tooth's visible notation label. */
export interface ToothLabelContext extends ToothContext {
  label: string;
  accessibleLabel: string;
}

/** Read-only presentation context for one clinical surface. */
export interface SurfaceContext extends ToothContext {
  surface: SurfaceId;
}

/** Read-only presentation context for one annotation. */
export interface AnnotationContext {
  mark: OdontographicMark;
  isSelected: boolean;
  view: ViewType;
}

/** Surface lifecycle/content hook context, including its engine-owned element. */
export interface SurfaceHookArg extends SurfaceContext {
  el: Element;
}

/** Hook context for an annotation (odontographic mark). */
export interface AnnotationHookArg extends AnnotationContext {
  el: Element;
}

/** Read-only chart context available to custom view plugins. */
export interface ViewContext {
  view: ViewType;
  state: Readonly<OdontogramState>;
}

/** Strings are inserted as text; Nodes are cloned before insertion. */
export type CustomContent = string | Node | readonly (string | Node)[] | null | undefined;

/** Optional disposer returned by a custom mount hook. */
export type HookCleanup = () => void;

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
export type StateChangeSource =
  "internal" | "external" | "batch" | "reset" | "interaction" | "undo" | "redo" | "import";

/** Availability of the in-memory odontogram undo and redo stacks. */
export interface HistoryChangeArg {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

/** Built-in odontogram toolbar controls. */
export type ToolbarControlId = "views" | "marks" | "selection" | "history";

/** State exposed to consumer-owned toolbar buttons. */
export interface ToolbarContext {
  state: OdontogramState;
  readOnly: boolean;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  executeCommand: (command: OdontogramCommand) => OdontogramCommandResult;
}

export interface ToolbarCustomButton {
  id: string;
  label: string;
  title?: string;
  disabled?: boolean | ((context: ToolbarContext) => boolean);
  onClick: (context: ToolbarContext) => void;
}

export interface ToolbarGroup {
  id: string;
  label?: string;
  controls: Array<ToolbarControlId | ToolbarCustomButton | PluginToolControl>;
}

/** Reference a tool contributed by an Odontogram plugin. */
export interface PluginToolControl {
  tool: string;
}

/** Opt-in integrated toolbar arrangement. Groups and controls are rendered in array order. */
export interface ToolbarOptions {
  position?: "top" | "bottom" | "left" | "right";
  groups?: ToolbarGroup[];
}

/** A mark type/status supported by the active odontogram symbol catalog. */
export interface MarkCatalogEntry {
  type: string;
  status?: MarkStatus;
  label?: string;
  symbol?: string;
  color?: string;
}

export interface LegendOptions {
  /** Explicit entries replace entries generated from `markCatalog` and current marks. */
  items?: MarkCatalogEntry[];
  /** Change the accessible heading for the generated legend. */
  label?: string;
}

/** Extensible text catalog for the odontogram UI. Missing keys use the selected locale's English fallback. */
export type LocaleMessageKey =
  | "ui.view"
  | "ui.marks"
  | "ui.selection"
  | "ui.history"
  | "ui.views"
  | "ui.markType"
  | "ui.markStatus"
  | "ui.finding"
  | "ui.existing"
  | "ui.planned"
  | "ui.completed"
  | "ui.applyMark"
  | "ui.editSelected"
  | "ui.deleteSelected"
  | "ui.clearSelection"
  | "ui.undo"
  | "ui.redo"
  | "ui.controls"
  | "ui.legend"
  | "view.permanent"
  | "view.deciduous"
  | "view.primary"
  | "view.mixed"
  | "view.upper"
  | "view.lower"
  | "view.quadrant"
  | "view.tooth"
  | "mark.caries"
  | "mark.restoration"
  | "mark.crown"
  | "mark.bridge"
  | "mark.sealant"
  | "mark.extraction"
  | "mark.implant"
  | "surface.mesial"
  | "surface.occlusal"
  | "surface.incisal"
  | "surface.distal"
  | "surface.buccal"
  | "surface.lingual"
  | "presence.present"
  | "presence.missing"
  | "presence.unerupted"
  | "a11y.chart"
  | "a11y.summary"
  | "a11y.patientRight"
  | "a11y.patientLeft"
  | "a11y.quadrant"
  | "a11y.tooth"
  | "a11y.surface"
  | "a11y.marks"
  | "a11y.noMarks"
  | "error.invalidConfiguration"
  | "error.invalidContainer"
  | "error.noContainer"
  | "error.noSelection"
  | "error.controlledMutation"
  | "error.invalidState";

/** Partial registered locale. Unspecified messages fall back to English; direction defaults to ltr. */
export interface OdontogramLocale {
  direction?: "ltr" | "rtl";
  messages?: Partial<Record<LocaleMessageKey, string>>;
}

export interface DetailChangeArg {
  tooth: ToothId;
  /** Present when a single clinical surface is the detail target. */
  surface?: SurfaceId;
  /** Surfaces in the tooth's current selection or represented by its marks. */
  surfaces: SurfaceId[];
  /** Marks on the tooth, narrowed to the target surface when `surface` is present. */
  marks: OdontographicMark[];
  trigger: "focus" | "click";
  jsEvent?: Event;
}

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
  /** Maximum in-memory odontogram snapshots retained for undo (default: 100; 0 disables history). */
  historyLimit?: number;
  initialView?: ViewType;
  /** UI language tag. Defaults to `en`; independent from tooth notation and anatomical orientation. */
  locale?: string;
  /** Per-instance text overrides, applied after the registered locale and before English fallback. */
  localeText?: Partial<Record<LocaleMessageKey, string>>;
  notation?: Notation;
  /** CSS width of the odontogram host (default: 100%). */
  width?: number | string;
  height?: number | string;
  /** Fit the complete chart inside its host while preserving the SVG aspect ratio (default: true). */
  fitToContainer?: boolean;
  /** Minimum and maximum interactive zoom ratios relative to the fitted chart (defaults: 1 and 4). */
  minZoom?: number;
  maxZoom?: number;
  selectable?: boolean;
  /** Disable rendered interactions and integrated toolbar actions. */
  disabled?: boolean;
  /** Disable mutations originating from rendered chart interactions; imperative APIs remain available. */
  readOnly?: boolean;
  /** Optional integrated odontogram controls. Omit or set false for a chart-only instance. */
  toolbar?: false | ToolbarOptions;
  /** Hide the built-in mark legend, or customize its items and heading. */
  legend?: false | LegendOptions;
  /** Active mark type/status catalog used by the legend and mark controls. */
  markCatalog?: MarkCatalogEntry[];
  /** Teeth excluded from user and programmatic selection. */
  lockedTeeth?: ToothId[];
  /** Surfaces excluded from user and programmatic selection. */
  lockedSurfaces?: Array<{ tooth: ToothId; surface: SurfaceId }>;
  /** Optional application rules for selection eligibility. */
  isToothSelectable?: (tooth: ToothId) => boolean;
  isSurfaceSelectable?: (tooth: ToothId, surface: SurfaceId) => boolean;
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
  /** Inline contract-compliant SVG markup overrides, keyed by FDI tooth id. */
  toothResources?: Record<ToothId, string>;
  /** Behavior for invalid toothResources entries. Defaults to the built-in schematic. */
  toothResourceFallback?: "schematic" | "error";

  /** Initial static data snapshot or document to populate the chart baseline synchronously. */
  initialData?:
    OdontogramDocument | OdontogramState | OdontogramStateInput | Record<string, unknown>;
  /** Alias for initialData. */
  data?: OdontogramDocument | OdontogramState | OdontogramStateInput | Record<string, unknown>;
  /** Async consumer-provided data loader function receiving AbortSignal and context. */
  loader?: OdontogramDataLoader;
  /** Whether to automatically trigger the loader on instantiation (default: true if loader is provided). */
  autoload?: boolean;

  validator?: boolean | ValidatorConfig | ((state: OdontogramState) => ValidationResult);

  toothClick?: (arg: ToothClickArg) => void;
  surfaceClick?: (arg: SurfaceClickArg) => void;
  selectionDidChange?: (arg: SelectionChangeArg) => void;
  marksSet?: (arg: MarksSetArg) => void;
  validationDidChange?: (arg: ValidationChangeArg) => void;
  stateDidChange?: (arg: StateChangeArg) => void;
  /** Called when local undo/redo availability changes. */
  historyDidChange?: (arg: HistoryChangeArg) => void;
  /** Receives focus and activation details for accessible consumer-owned popovers. */
  detailDidChange?: (arg: DetailChangeArg) => void;
  /** Synchronously veto a validated mark command by returning false. */
  beforeMarkCommand?: BeforeMarkCommand;
  toothStateDidChange?: (arg: ToothStateChangeArg) => void;
  /** Called when async data loader starts or finishes. */
  dataLoadingDidChange?: (arg: DataLoadingChangeArg) => void;
  /** Called when data is loaded, validated, and successfully applied. */
  dataDidLoad?: (arg: DataLoadSuccessArg) => void;
  /** Called when data loading fails, rejects, is aborted, or fails validation. */
  dataLoadDidFail?: (arg: DataLoadFailArg) => void;

  toothClassNames?: (arg: ToothClassNamesArg) => string | string[];
  toothLabelClassNames?: (arg: ToothLabelContext) => string | string[];
  toothLabelContent?: (arg: ToothLabelContext) => string;
  surfaceClassNames?: (arg: SurfaceHookArg) => string | string[];
  markClassNames?: (arg: MarkClassNamesArg) => string | string[];
  annotationClassNames?: (arg: AnnotationHookArg) => string | string[];
  toothContent?: (arg: ToothMountArg & ToothContext) => CustomContent;
  surfaceContent?: (arg: SurfaceHookArg) => CustomContent;
  annotationContent?: (arg: AnnotationHookArg) => CustomContent;
  toothDidMount?: (arg: ToothMountArg) => void | HookCleanup;
  toothWillUnmount?: (arg: ToothMountArg) => void;
  surfaceDidMount?: (arg: SurfaceHookArg) => void | HookCleanup;
  surfaceWillUnmount?: (arg: SurfaceHookArg) => void;
  annotationDidMount?: (arg: AnnotationHookArg) => void | HookCleanup;
  annotationWillUnmount?: (arg: AnnotationHookArg) => void;
  markDidMount?: (arg: MarkMountArg) => void | HookCleanup;
  markWillUnmount?: (arg: MarkMountArg) => void;
  viewDidMount?: (arg: ViewMountArg) => void;
  viewWillUnmount?: (arg: ViewMountArg) => void;
  /** Runs before the first mount. Return false to cancel render(). */
  beforeMount?: () => boolean | void;
  /** Runs after the host and initial view have mounted. */
  mountDidMount?: () => void;
  /** Cancelable pre-change hooks; return false to leave the current state unchanged. */
  beforeViewChange?: (arg: ViewChangeArg) => boolean | void;
  viewDidChange?: (arg: ViewChangeArg) => void;
  beforeSelectionChange?: (arg: SelectionWillChangeArg) => boolean | void;
  beforeDataChange?: (arg: DataWillChangeArg) => boolean | void;
  /** Post-commit notification for any odontogram state edit. */
  editDidChange?: (arg: StateChangeArg) => void;
  /** Receives exceptions thrown by callbacks. Exceptions from this handler are logged. */
  errorDidOccur?: (arg: OdontogramErrorArg) => void;
  /** Called when a plugin hook or contribution throws; plugin failures remain isolated. */
  pluginDidError?: (arg: { pluginId: string; phase: string; error: unknown }) => void;
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
  selectTooth: (tooth: ToothId, mode?: "replace" | "add" | "toggle") => void;
  selectSurface: (tooth: ToothId, surface: SurfaceId, mode?: "replace" | "add" | "toggle") => void;
  selectAnnotation: (markId: string) => void;
  toggleSurfaceSelection: (
    tooth: ToothId,
    surface: SurfaceId,
    mode?: "replace" | "add" | "toggle",
  ) => void;
  emitToothClick: (tooth: ToothId, jsEvent?: Event) => void;
  emitSurfaceClick: (tooth: ToothId, surface: SurfaceId, jsEvent?: Event) => void;
  emitToothDetail?: (tooth: ToothId, trigger: "focus" | "click", jsEvent?: Event) => void;
  emitSurfaceDetail?: (
    tooth: ToothId,
    surface: SurfaceId,
    trigger: "focus" | "click",
    jsEvent?: Event,
  ) => void;
  /** Dental anatomy renderers registered by active odontogram plugins. */
  getDentalRenderers?: () => DentalRendererDefinition[];
  /** Find a registered symbol for one odontographic mark type. */
  getSymbol?: (markType: string) => OdontogramSymbolDefinition | undefined;
  /** Find a registered notation system definition by identifier. */
  getNotation?: (notation: string) => OdontogramNotationDefinition | undefined;
  /** All registered notation system definitions. */
  getNotations?: () => OdontogramNotationDefinition[];
}

/** Plugin definition shape. */
export interface OdontogramPluginDef {
  /** Stable, globally unique id (for example `@clinic/occlusal-symbols`). */
  id: string;
  /** Plugin package version using semantic versioning. */
  version: string;
  /** Supported Odontogram plugin API version range (for example `^1.0.0`). */
  apiCompatibility: string;
  /** Set to `isolate` to report and suppress exceptions from view render hooks. */
  errorPolicy?: "isolate" | "throw";
  /** Required plugin ids and compatible plugin version ranges. */
  dependencies?: OdontogramPluginDependency[];
  /** Called after contributions are registered; may return an instance cleanup function. */
  onRegister?: (context: OdontogramPluginContext) => void | HookCleanup;
  /** Called during unregistration after the returned cleanup function runs. */
  onUnregister?: (context: OdontogramPluginContext) => void;
  views?: ViewDefinition[];
  dentalRenderers?: DentalRendererDefinition[];
  symbols?: OdontogramSymbolDefinition[];
  tools?: OdontogramToolDefinition[];
  notations?: OdontogramNotationDefinition[];
}

export interface OdontogramPluginDependency {
  id: string;
  version?: string;
}

export interface OdontogramPluginContext {
  odontogram: Odontogram;
  pluginId: string;
}

/** Append odontogram-specific anatomy to the SVG tooth anatomy layer. */
export interface DentalRendererDefinition {
  id: string;
  matches: (tooth: ToothId) => boolean;
  render: (context: DentalRendererContext) => void;
}

export interface DentalRendererContext {
  tooth: ToothId;
  element: SVGGElement;
  bounds: { x: number; y: number; width: number; height: number };
  presence: ToothPresence;
  label: string;
  selected: boolean;
}

/** Custom SVG symbol renderer for one or more odontographic mark types. */
export interface OdontogramSymbolDefinition {
  id: string;
  markTypes: string[];
  render: (context: OdontogramSymbolContext) => void;
}

export interface OdontogramSymbolContext {
  mark: OdontographicMark;
  element: SVGGElement;
  targets: Array<{ tooth: ToothId; x: number; y: number; role?: string }>;
  selected: boolean;
  color: string;
}

/** A toolbar tool that performs an odontogram operation. */
export interface OdontogramToolDefinition {
  id: string;
  label: string;
  title?: string;
  disabled?: boolean | ((context: OdontogramToolContext) => boolean);
  onActivate: (context: OdontogramToolContext) => void;
}

export interface OdontogramToolContext {
  state: Readonly<OdontogramState>;
  readOnly: boolean;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  executeCommand: (command: OdontogramCommand) => OdontogramCommandResult;
}

/** Custom tooth numbering / notation system registered by a plugin. */
export interface OdontogramNotationDefinition {
  id: string;
  name: string;
  description?: string;
  format: (toothId: ToothId) => string;
  formatAccessible?: (toothId: ToothId) => string;
  parse?: (label: string) => ToothId | null;
  isValid?: (label: string) => boolean;
}

/** A plugin instance created via createPlugin(). */
export interface OdontogramPlugin {
  pluginDef: OdontogramPluginDef;
}
