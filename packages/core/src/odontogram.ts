import {
  createDefaultState,
  DEFAULT_OPTIONS,
  getToothPresence as resolvePresence,
} from "./defaults.js";
import { OdontogramError, OdontogramValidationError, VALIDATION_CODES } from "./errors.js";
import {
  filterMarks,
  getMarksForSurface as filterMarksForSurface,
  getMarksForTooth as filterMarksForTooth,
  getMarkTargetSurfaces,
  getMarkTargetTeeth,
  markMatchesFilter,
  normalizeMark,
  normalizeMarks,
} from "./marks.js";
import {
  deepClone,
  isDeepEqual,
  registerValidNotation,
  unregisterValidNotation,
  validateOdontogramState,
  validateOptions,
} from "./validation.js";
import { renderLegend, renderToolbar } from "./controls.js";
import { getLocaleDirection, getLocaleText } from "./locale.js";
import { assertPluginApiCompatible, satisfiesVersion } from "./plugin.js";
import { exportOdontogramDocument, importOdontogramDocument } from "./interoperability.js";
import type {
  BatchOptions,
  ExportDocumentOptions,
  ImportDocumentOptions,
  MarkFilter,
  MarkInput,
  OdontogramCommand,
  OdontogramCommandResult,
  OdontogramDocument,
  OdontogramImportResult,
  HistoryChangeArg,
  OdontogramMode,
  OdontogramOptions,
  OdontogramPlugin,
  OdontogramState,
  OdontogramStateInput,
  OdontographicMark,
  ResetOptions,
  SelectionState,
  SetStateOptions,
  SetToothStateOptions,
  StateChangeSource,
  SurfaceId,
  ToothId,
  ToothPresence,
  ToothState,
  ValidationResult,
  ValidatorConfig,
  ViewDefinition,
  ViewOptions,
  ViewRenderContext,
  ViewType,
  OdontogramErrorArg,
  DentalRendererDefinition,
  OdontogramPluginContext,
  OdontogramSymbolDefinition,
  OdontogramToolDefinition,
  OdontogramNotationDefinition,
} from "./types.js";

const RECREATION_OPTIONS = new Set<keyof OdontogramOptions>([
  "plugins",
  "initialView",
  "mode",
  "instanceId",
  "toothResources",
  "toothResourceFallback",
]);

interface RegisteredPlugin {
  plugin: OdontogramPlugin;
  cleanup?: () => void;
}

export class Odontogram {
  private el: HTMLElement | null = null;
  private options: OdontogramOptions;
  private state: OdontogramState;
  private revision = 0;
  private viewMap: Map<ViewType, ViewDefinition> = new Map();
  private viewOwners = new Map<ViewType, string>();
  private plugins = new Map<string, RegisteredPlugin>();
  private dentalRendererMap = new Map<
    string,
    { pluginId: string; definition: DentalRendererDefinition }
  >();
  private symbolMap = new Map<
    string,
    { pluginId: string; definition: OdontogramSymbolDefinition }
  >();
  private symbolTypes = new Map<string, string>();
  private toolMap = new Map<string, { pluginId: string; definition: OdontogramToolDefinition }>();
  private notationMap = new Map<
    string,
    { pluginId: string; definition: OdontogramNotationDefinition }
  >();
  private activeView: ViewDefinition | null = null;
  private activeViewOwnerId: string | null = null;
  private viewContext: ViewRenderContext | null = null;
  private rendered = false;
  private batchDepth = 0;
  private renderQueued = false;
  private hostEl: HTMLElement | null = null;
  private chartEl: HTMLElement | null = null;
  private toolbarEl: HTMLElement | null = null;
  private legendEl: HTMLElement | null = null;

  // Transactional batch state
  private preBatchState: OdontogramState | null = null;
  private preBatchRevision: number | null = null;
  private preBatchOptions: OdontogramOptions | null = null;
  private activeMarkCommand: OdontogramCommand | null = null;
  private evaluatingMarkCommand = false;
  private undoStack: OdontogramState[] = [];
  private redoStack: OdontogramState[] = [];
  private applyingHistory = false;
  private callbackDepth = 0;

  constructor(el?: HTMLElement | null, options: OdontogramOptions = {}) {
    if (el !== undefined && el !== null) {
      if (typeof el !== "object" || !("appendChild" in el)) {
        throw new OdontogramError(
          getLocaleText(
            { locale: options.locale, localeText: options.localeText },
            "error.invalidContainer",
          ),
          VALIDATION_CODES.ERR_INVALID_CONTAINER,
        );
      }
      this.el = el;
    }

    const optionsValidation = validateOptions(options);
    if (!optionsValidation.valid) {
      throw new OdontogramValidationError(
        getLocaleText(
          { locale: options.locale, localeText: options.localeText },
          "error.invalidConfiguration",
        ),
        optionsValidation.issues,
        VALIDATION_CODES.ERR_INVALID_OPTION,
      );
    }

    for (const warning of optionsValidation.warnings) {
      console.warn(`[Odontogram] ${warning.message}`);
    }

    this.options = deepClone(options);
    this.state = createDefaultState(options.initialView ?? DEFAULT_OPTIONS.initialView);
    this.registerPlugins(options.plugins ?? []);
  }

  /** Current operating mode: "internal" (uncontrolled, default) or "controlled". */
  getMode(): OdontogramMode {
    return this.getOption("mode") ?? DEFAULT_OPTIONS.mode;
  }

  /** Monotonically increasing state revision counter. */
  getRevision(): number {
    return this.revision;
  }

  /**
   * Mount the odontogram into the container element.
   * If a container was not provided in the constructor, one can be passed here.
   */
  render(container?: HTMLElement): void {
    this.assertNotInCallback("render");
    if (container) {
      if (typeof container !== "object" || !("appendChild" in container)) {
        throw new OdontogramError(
          getLocaleText(
            { locale: this.getOption("locale"), localeText: this.getOption("localeText") },
            "error.invalidContainer",
          ),
          VALIDATION_CODES.ERR_INVALID_CONTAINER,
        );
      }
      this.el = container;
    }

    if (!this.el) {
      throw new OdontogramError(
        getLocaleText(
          { locale: this.getOption("locale"), localeText: this.getOption("localeText") },
          "error.noContainer",
        ),
        VALIDATION_CODES.ERR_NO_CONTAINER,
      );
    }

    if (this.rendered) {
      this.requestRender();
      return;
    }

    if (!this.runBeforeCallback("beforeMount", this.getOption("beforeMount"))) return;

    this.hostEl = document.createElement("div");
    this.hostEl.className = "odontogram-host";
    this.hostEl.dir = getLocaleDirection(this.getOption("locale"));
    this.hostEl.lang = this.getOption("locale") ?? "en";
    const width = this.getOption("width");
    this.hostEl.style.width = typeof width === "number" ? `${width}px` : String(width);
    const height = this.getOption("height");
    this.hostEl.style.height = typeof height === "number" ? `${height}px` : String(height);
    this.chartEl = document.createElement("div");
    this.chartEl.className = "odontogram-view";
    // Interface direction must never change canonical left/right dental orientation.
    this.chartEl.dir = "ltr";
    this.toolbarEl = document.createElement("div");
    this.legendEl = document.createElement("aside");
    this.hostEl.append(this.toolbarEl, this.chartEl, this.legendEl);
    this.el.appendChild(this.hostEl);

    this.rendered = true;
    this.renderControls();
    this.mountView();
    this.runCallback("mountDidMount", this.getOption("mountDidMount"));
  }

  destroy(): void {
    if (!this.rendered) return;

    this.unmountView();
    if (this.hostEl) {
      this.hostEl.remove();
      this.hostEl = null;
    }
    this.chartEl = null;
    this.toolbarEl = null;
    this.legendEl = null;
    this.rendered = false;
  }

  /** Register one odontogram extension and its contributions on this instance. */
  registerPlugin(plugin: OdontogramPlugin): void {
    this.assertNotInCallback("registerPlugin");
    this.registerPluginDefinition(plugin);
    this.refreshPluginContributions();
  }

  /** Unregister a plugin after cleaning up its instance resources. */
  unregisterPlugin(id: string): boolean {
    this.assertNotInCallback("unregisterPlugin");
    const record = this.plugins.get(id);
    if (!record) return false;
    if (this.activeViewOwnerId === id) {
      throw new OdontogramError(
        `Plugin "${id}" provides the active view "${this.state.view}". Change views before unregistering it.`,
        VALIDATION_CODES.ERR_PLUGIN_IN_USE,
      );
    }
    const dependent = [...this.plugins.entries()].find(([, candidate]) =>
      candidate.plugin.pluginDef.dependencies?.some((dependency) => dependency.id === id),
    );
    if (dependent) {
      throw new OdontogramError(
        `Plugin "${id}" is required by registered plugin "${dependent[0]}".`,
        VALIDATION_CODES.ERR_PLUGIN_MISSING_DEPENDENCY,
      );
    }

    const def = record.plugin.pluginDef;
    const context: OdontogramPluginContext = { odontogram: this, pluginId: id };
    if (record.cleanup) this.runPluginHook(id, "cleanup", record.cleanup);
    if (def.onUnregister) this.runPluginHook(id, "unregister", () => def.onUnregister!(context));
    this.removePluginContributions(record.plugin);
    this.plugins.delete(id);
    this.refreshPluginContributions();
    return true;
  }

  private refreshPluginContributions(): void {
    if (!this.rendered) return;
    this.renderControls();
    if (this.activeView) this.unmountView();
    this.mountView();
  }

  /** Get the registered plugin-rendered dental symbols available to a view. */
  getDentalRenderers(): DentalRendererDefinition[] {
    return [...this.dentalRendererMap.values()].map(({ pluginId, definition }) => ({
      ...definition,
      matches: (tooth) => {
        try {
          return definition.matches(tooth);
        } catch (error) {
          this.reportPluginFailure(pluginId, `dentalRenderer:${definition.id}:matches`, error);
          return false;
        }
      },
      render: (context) =>
        this.runPluginHook(pluginId, `dentalRenderer:${definition.id}`, () =>
          definition.render(context),
        ),
    }));
  }

  /** Resolve a symbol renderer by odontographic mark type. */
  getSymbol(markType: string): OdontogramSymbolDefinition | undefined {
    const id = this.symbolTypes.get(markType);
    if (!id) return undefined;
    const entry = this.symbolMap.get(id);
    if (!entry) return undefined;
    return {
      ...entry.definition,
      render: (context) =>
        this.runPluginHook(entry.pluginId, `symbol:${id}`, () => entry.definition.render(context)),
    };
  }

  /** Get a plugin tool by id for toolbar integrations. */
  getPluginTool(id: string): OdontogramToolDefinition | undefined {
    const entry = this.toolMap.get(id);
    if (!entry) return undefined;
    const disabled = entry.definition.disabled;
    return {
      ...entry.definition,
      disabled:
        typeof disabled === "function"
          ? (context) => {
              try {
                return disabled(context);
              } catch (error) {
                this.reportPluginFailure(entry.pluginId, `tool:${id}:disabled`, error);
                return true;
              }
            }
          : disabled,
    };
  }

  getPluginTools(): OdontogramToolDefinition[] {
    return [...this.toolMap.values()].map(({ definition }) => definition);
  }

  /** Run a registered tool through the plugin error-isolation boundary. */
  activatePluginTool(id: string): boolean {
    const entry = this.toolMap.get(id);
    if (!entry) return false;
    this.runPluginHook(entry.pluginId, `tool:${id}`, () =>
      entry.definition.onActivate({
        state: this.getState(),
        readOnly: this.getMode() === "controlled" || Boolean(this.getOption("readOnly")),
        disabled: Boolean(this.getOption("disabled")),
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        executeCommand: (command) => this.executeCommand(command),
      }),
    );
    return true;
  }

  /** Get a registered custom tooth numbering notation by id. */
  getNotation(id: string): OdontogramNotationDefinition | undefined {
    const entry = this.notationMap.get(id);
    if (!entry) return undefined;
    const def = entry.definition;
    return {
      ...def,
      format: (toothId) => {
        try {
          return def.format(toothId);
        } catch (error) {
          this.reportPluginFailure(entry.pluginId, `notation:${id}:format`, error);
          return toothId;
        }
      },
      formatAccessible: def.formatAccessible
        ? (toothId) => {
            try {
              return def.formatAccessible!(toothId);
            } catch (error) {
              this.reportPluginFailure(entry.pluginId, `notation:${id}:formatAccessible`, error);
              return def.format(toothId);
            }
          }
        : undefined,
      parse: def.parse
        ? (label) => {
            try {
              return def.parse!(label);
            } catch (error) {
              this.reportPluginFailure(entry.pluginId, `notation:${id}:parse`, error);
              return null;
            }
          }
        : undefined,
      isValid: def.isValid
        ? (label) => {
            try {
              return def.isValid!(label);
            } catch (error) {
              this.reportPluginFailure(entry.pluginId, `notation:${id}:isValid`, error);
              return false;
            }
          }
        : undefined,
    };
  }

  /** Get all registered plugin tooth numbering notation definitions. */
  getNotations(): OdontogramNotationDefinition[] {
    return [...this.notationMap.values()].map(({ definition }) => definition);
  }

  getOption<K extends keyof OdontogramOptions>(name: K): OdontogramOptions[K] {
    if (name in this.options) {
      return this.options[name];
    }
    if (name in DEFAULT_OPTIONS) {
      return DEFAULT_OPTIONS[name as keyof typeof DEFAULT_OPTIONS] as OdontogramOptions[K];
    }
    return undefined;
  }

  setOption<K extends keyof OdontogramOptions>(name: K, value: OdontogramOptions[K]): void {
    this.assertNotInCallback("setOption");
    if (RECREATION_OPTIONS.has(name)) {
      throw new OdontogramError(
        `Option "${String(name)}" can only be set when creating an Odontogram instance.`,
        VALIDATION_CODES.ERR_IMMUTABLE_OPTION,
      );
    }

    const candidateOptions: OdontogramOptions = { ...this.options, [name]: value };
    const validation = validateOptions(candidateOptions);
    if (!validation.valid) {
      throw new OdontogramValidationError(
        `Invalid option "${String(name)}": ${validation.errors[0]?.message}`,
        validation.issues,
        VALIDATION_CODES.ERR_INVALID_OPTION,
      );
    }

    for (const warning of validation.warnings) {
      if (warning.path === `options.${String(name)}`) {
        console.warn(`[Odontogram] ${warning.message}`);
      }
    }

    this.options = { ...this.options, [name]: deepClone(value) };
    if ((name === "locale" || name === "localeText") && this.hostEl) {
      this.hostEl.dir = getLocaleDirection(this.getOption("locale"));
      if (name === "locale") this.hostEl.lang = String(value);
    }
    if (name === "width" && this.hostEl) {
      this.hostEl.style.width = typeof value === "number" ? `${value}px` : String(value ?? "100%");
    }
    if (name === "height" && this.hostEl) {
      this.hostEl.style.height = typeof value === "number" ? `${value}px` : String(value ?? 400);
    }
    if (name === "historyLimit") {
      if (value === 0) this.clearHistory();
      else {
        const before = this.undoStack.length;
        this.trimUndoStack();
        if (this.undoStack.length !== before) this.notifyHistoryChange();
      }
    }
    this.renderControls();
    this.requestRender();
  }

  changeView(view: ViewType, viewOptions?: ViewOptions): void {
    this.assertNotInCallback("changeView");
    if (typeof view !== "string" || view.trim() === "") {
      throw new OdontogramValidationError(
        "View must be a non-empty string.",
        [
          {
            ruleId: "view-validity",
            code: VALIDATION_CODES.ERR_INVALID_STATE,
            severity: "error",
            message: "View must be a non-empty string.",
            path: "state.view",
          },
        ],
        VALIDATION_CODES.ERR_INVALID_STATE,
      );
    }

    this.assertMutable("change view");

    const mergedViewOptions: ViewOptions = {
      ...(this.options.viewOptions ?? {}),
      ...(viewOptions ?? {}),
    };

    if (view.startsWith("quadrant-")) {
      const qNum = parseInt(view.slice("quadrant-".length), 10);
      if (!isNaN(qNum)) mergedViewOptions.quadrant = qNum;
    } else if (view.startsWith("tooth-")) {
      const toothId = view.slice("tooth-".length);
      if (toothId) mergedViewOptions.tooth = toothId;
    } else if (view === "maxillary" || view === "upper") {
      mergedViewOptions.arch = "upper";
    } else if (view === "mandibular" || view === "lower") {
      mergedViewOptions.arch = "lower";
    }

    if (this.state.view === view) {
      this.options.viewOptions = mergedViewOptions;
      this.requestRender();
      return;
    }
    const previousOptions = this.options.viewOptions;
    this.options.viewOptions = mergedViewOptions;
    try {
      this.setState({ view }, { source: "internal" });
    } catch (error) {
      this.options.viewOptions = previousOptions;
      throw error;
    }
    if (this.state.view === view) return;
    // A canceled beforeViewChange leaves both the view and its options unchanged.
    this.options.viewOptions = previousOptions;
  }

  getState(): OdontogramState {
    return deepClone(this.state);
  }

  /**
   * Export the current odontogram chart into a portable OdontogramDocument.
   * Excludes DOM elements, event listeners, callbacks, and transient selection by default.
   */
  exportDocument(options?: ExportDocumentOptions): OdontogramDocument {
    return exportOdontogramDocument(this.state, options, this.options);
  }

  /**
   * Alias for exportDocument providing standard JSON.stringify(odontogram) compatibility.
   */
  toJSON(): OdontogramDocument {
    return this.exportDocument();
  }

  /**
   * Import an OdontogramDocument into this instance atomically.
   * Validates document structure and runs migrations before replacing state.
   * If validation fails, throws OdontogramValidationError and leaves previous state untouched.
   */
  importDocument(doc: unknown, options?: ImportDocumentOptions): OdontogramImportResult {
    this.assertNotInCallback("importDocument");
    const result = importOdontogramDocument(doc, options);

    // Apply visual presentation settings if requested and present
    if (options?.applyVisualSettings !== false && result.visualSettings) {
      for (const [key, val] of Object.entries(result.visualSettings)) {
        if (val !== undefined) {
          (this.options as any)[key] = deepClone(val);
        }
      }
      if (result.visualSettings.locale && this.hostEl) {
        this.hostEl.dir = getLocaleDirection(result.visualSettings.locale);
        this.hostEl.lang = result.visualSettings.locale;
      }
    }

    // Atomically apply state
    this.setState(result.state, {
      source: options?.source ?? "import",
    });

    if (this.rendered) {
      this.renderControls();
      this.requestRender();
    }

    return result;
  }

  /** Whether one local odontogram state change can be undone. */
  canUndo(): boolean {
    return this.getMode() === "internal" && this.undoStack.length > 0;
  }

  /** Whether the most recently undone local state change can be redone. */
  canRedo(): boolean {
    return this.getMode() === "internal" && this.redoStack.length > 0;
  }

  /** Restore the previous in-memory odontogram snapshot. Returns false when unavailable. */
  undo(): boolean {
    if (!this.canUndo() || this.batchDepth > 0) return false;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(deepClone(this.state));
    this.applyingHistory = true;
    try {
      this.setState(previous, { source: "undo" });
    } catch (error) {
      this.undoStack.push(previous);
      this.redoStack.pop();
      throw error;
    } finally {
      this.applyingHistory = false;
    }
    this.notifyHistoryChange();
    return true;
  }

  /** Reapply the most recently undone in-memory odontogram snapshot. Returns false when unavailable. */
  redo(): boolean {
    if (!this.canRedo() || this.batchDepth > 0) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(deepClone(this.state));
    this.trimUndoStack();
    this.applyingHistory = true;
    try {
      this.setState(next, { source: "redo" });
    } catch (error) {
      this.undoStack.pop();
      this.redoStack.push(next);
      throw error;
    } finally {
      this.applyingHistory = false;
    }
    this.notifyHistoryChange();
    return true;
  }

  /**
   * Updates state snapshot atomically.
   * If candidate state contains structural errors or fails active validation rules,
   * the update is rejected atomically and throws OdontogramValidationError,
   * leaving previous state completely intact.
   */
  setState(
    state: OdontogramState | OdontogramStateInput | Partial<OdontogramState>,
    options?: SetStateOptions,
  ): void {
    this.assertNotInCallback("setState");
    if (this.evaluatingMarkCommand) {
      throw new OdontogramError(
        "State cannot be mutated while beforeMarkCommand is evaluating a candidate.",
        VALIDATION_CODES.ERR_COMMAND_CANCELLED,
      );
    }
    if (!state || typeof state !== "object") {
      throw new OdontogramValidationError(
        "setState requires a valid state object.",
        [
          {
            ruleId: "state-structure",
            code: VALIDATION_CODES.ERR_INVALID_STATE,
            severity: "error",
            message: "State input must be a non-null object.",
            path: "state",
          },
        ],
        VALIDATION_CODES.ERR_INVALID_STATE,
      );
    }

    // Clone input to prevent caller mutations during evaluation
    const clonedInput = deepClone(state);
    const nextView = clonedInput.view ?? this.state.view;
    const nextMarks =
      clonedInput.marks !== undefined
        ? normalizeMarks(clonedInput.marks)
        : deepClone(this.state.marks);
    const nextSelection: SelectionState = clonedInput.selection ?? deepClone(this.state.selection);
    const nextTeeth = clonedInput.teeth ?? deepClone(this.state.teeth);

    const candidateState: OdontogramState = {
      view: nextView,
      marks: nextMarks,
      selection: {
        teeth: nextSelection.teeth ? [...nextSelection.teeth] : [],
        surfaces: nextSelection.surfaces ? [...nextSelection.surfaces] : [],
        ...(nextSelection.annotations?.length
          ? {
              annotations: nextSelection.annotations.filter((id) =>
                nextMarks.some((mark) => mark.id === id),
              ),
            }
          : {}),
      },
      teeth: { ...nextTeeth },
    };

    // Idempotency check: if candidate state is deeply equal to current state
    if (options?.revision !== undefined && options.revision < this.revision) {
      throw new OdontogramError(
        `Revision regression: incoming revision ${options.revision} is less than current revision ${this.revision}.`,
        VALIDATION_CODES.ERR_REVISION_REGRESSION,
      );
    }

    if (isDeepEqual(candidateState, this.state)) {
      if (options?.source === "external" && !this.applyingHistory) this.clearHistory();
      if (options?.revision !== undefined) {
        this.revision = options.revision;
      }
      return;
    }

    // 1. Structural integrity validation (respecting validator configuration if provided)
    const validatorOpt = this.getOption("validator");
    const baseConfig = typeof validatorOpt === "object" ? validatorOpt : {};
    const structuralResult = validateOdontogramState(candidateState, baseConfig);
    if (!structuralResult.valid) {
      throw new OdontogramValidationError(
        `State update rejected due to structural validation errors: ${structuralResult.errors[0]?.message}`,
        structuralResult.issues,
        VALIDATION_CODES.ERR_INVALID_STATE,
      );
    }

    // 2. Active instance validator enforcement (if configured as function or boolean)
    let activeValidationResult: ValidationResult | null = structuralResult;

    if (typeof validatorOpt === "function") {
      activeValidationResult = validatorOpt(candidateState);
    }

    if (activeValidationResult && !activeValidationResult.valid) {
      throw new OdontogramValidationError(
        `State update rejected due to configured validation rules: ${activeValidationResult.errors[0]?.message}`,
        activeValidationResult.issues,
        VALIDATION_CODES.ERR_INVALID_STATE,
      );
    }

    if (this.activeMarkCommand && !isDeepEqual(candidateState.marks, this.state.marks)) {
      const beforeCommit = this.getOption("beforeMarkCommand");
      if (beforeCommit) {
        this.evaluatingMarkCommand = true;
        let decision: boolean | void;
        try {
          decision = beforeCommit({
            command: deepClone(this.activeMarkCommand),
            previousState: deepClone(this.state),
            nextState: deepClone(candidateState),
          });
        } catch (error) {
          this.reportCallbackError("beforeMarkCommand", error);
          throw new OdontogramError(
            "Mark command was cancelled because beforeMarkCommand threw.",
            VALIDATION_CODES.ERR_COMMAND_CANCELLED,
          );
        } finally {
          this.evaluatingMarkCommand = false;
        }
        if (decision && typeof (decision as unknown as { then?: unknown }).then === "function") {
          throw new OdontogramError(
            "beforeMarkCommand must be synchronous; return false to veto a command.",
            VALIDATION_CODES.ERR_INVALID_OPTION,
          );
        }
        if (decision === false) {
          throw new OdontogramError(
            "Mark command was cancelled by beforeMarkCommand.",
            VALIDATION_CODES.ERR_COMMAND_CANCELLED,
          );
        }
      }
    }

    if (
      !isDeepEqual(candidateState.view, this.state.view) &&
      !this.runBeforeCallback("beforeViewChange", this.getOption("beforeViewChange"), {
        previousView: this.state.view,
        view: candidateState.view,
      })
    )
      return;
    if (
      !isDeepEqual(candidateState.selection, this.state.selection) &&
      !this.runBeforeCallback("beforeSelectionChange", this.getOption("beforeSelectionChange"), {
        previousSelection: deepClone(this.state.selection),
        selection: deepClone(candidateState.selection),
      })
    )
      return;
    if (
      !isDeepEqual(candidateState.marks, this.state.marks) &&
      !this.runBeforeCallback("beforeDataChange", this.getOption("beforeDataChange"), {
        previousMarks: deepClone(this.state.marks),
        marks: deepClone(candidateState.marks),
      })
    )
      return;

    // 3. Atomically apply the validated state
    const previousState = this.state;
    const changedProperties: Array<keyof OdontogramState> = [];

    if (candidateState.view !== previousState.view) changedProperties.push("view");
    if (!isDeepEqual(candidateState.marks, previousState.marks)) changedProperties.push("marks");
    if (!isDeepEqual(candidateState.selection, previousState.selection))
      changedProperties.push("selection");
    if (!isDeepEqual(candidateState.teeth, previousState.teeth)) changedProperties.push("teeth");

    const changeSource: StateChangeSource =
      options?.source ?? (this.batchDepth > 0 ? "batch" : "internal");
    if (changeSource === "external" && !this.applyingHistory) {
      this.clearHistory();
    } else if (!this.applyingHistory && this.batchDepth === 0) {
      this.recordHistory(previousState);
    }

    this.state = candidateState;

    if (options?.revision !== undefined) {
      this.revision = options.revision;
    } else if (this.batchDepth === 0) {
      this.revision += 1;
    }

    const source = changeSource;

    // Callback notifications (deferred if batched)
    if (!options?.silent) {
      if (this.batchDepth === 0) {
        if (changedProperties.includes("marks")) {
          this.runCallback("marksSet", this.getOption("marksSet"), {
            marks: deepClone(this.state.marks),
          });
        }

        if (changedProperties.includes("selection")) {
          this.emitSelectionChange();
        }

        if (changedProperties.includes("teeth")) {
          const toothCallback = this.getOption("toothStateDidChange");
          if (toothCallback) {
            const allTeeth = new Set([
              ...Object.keys(previousState.teeth),
              ...Object.keys(candidateState.teeth),
            ]);
            for (const toothId of allTeeth) {
              const prev = previousState.teeth[toothId] ?? { presence: "present" };
              const curr = candidateState.teeth[toothId] ?? { presence: "present" };
              if (!isDeepEqual(prev, curr)) {
                this.runCallback("toothStateDidChange", toothCallback, {
                  toothId,
                  state: deepClone(curr),
                  previousState: deepClone(prev),
                });
              }
            }
          }
        }

        const validationCallback = this.getOption("validationDidChange");
        if (validationCallback) {
          const finalResult = activeValidationResult ?? this.validate();
          this.runCallback("validationDidChange", validationCallback, { result: finalResult });
        }

        const stateArg = {
          state: deepClone(this.state),
          previousState: deepClone(previousState),
          revision: this.revision,
          source,
          changedProperties,
        };
        this.runCallback("stateDidChange", this.getOption("stateDidChange"), stateArg);
        this.runCallback("editDidChange", this.getOption("editDidChange"), stateArg);
      }
    }

    if (changedProperties.includes("view") && this.rendered && this.batchDepth === 0) {
      this.unmountView();
      this.mountView();
      this.runCallback("viewDidChange", this.getOption("viewDidChange"), {
        previousView: previousState.view,
        view: this.state.view,
      });
    } else {
      this.requestRender();
    }
  }

  /** Run validation against the current state snapshot. */
  validate(config?: ValidatorConfig): ValidationResult {
    const validatorOpt = this.getOption("validator");
    if (typeof validatorOpt === "function") {
      return validatorOpt(this.getState());
    }
    const baseConfig = typeof validatorOpt === "object" ? validatorOpt : {};
    const mergedConfig = config ? { ...baseConfig, ...config } : baseConfig;
    return validateOdontogramState(this.getState(), mergedConfig);
  }

  // ==========================================================================
  // Marks CRUD & Query Operations
  // ==========================================================================

  /** Get all marks in the odontogram, optionally filtered. */
  getMarks(filter?: MarkFilter): OdontographicMark[] {
    return deepClone(filterMarks(this.state.marks, filter));
  }

  /** Get a single mark by unique persistent ID. */
  getMark<TMeta = Record<string, unknown>>(id: string): OdontographicMark<TMeta> | undefined {
    const mark = this.state.marks.find((m) => m.id === id);
    return mark ? (deepClone(mark) as OdontographicMark<TMeta>) : undefined;
  }

  /** Check if a mark with the given ID exists. */
  hasMark(id: string): boolean {
    return this.state.marks.some((m) => m.id === id);
  }

  /** Execute a validated odontogram mark action. This API is shared by UI and host consumers. */
  executeCommand(command: OdontogramCommand): OdontogramCommandResult {
    const previousState = this.getState();
    try {
      if (this.evaluatingMarkCommand) {
        throw new OdontogramError(
          "Mark commands cannot be nested inside beforeMarkCommand.",
          VALIDATION_CODES.ERR_COMMAND_CANCELLED,
        );
      }
      this.assertMutable(`execute ${command.type} command`);
      let nextMarks = [...this.state.marks];
      if (command.type === "apply-mark") {
        const selection = this.state.selection;
        if (selection.surfaces.length === 0 && selection.teeth.length === 0) {
          throw new OdontogramError(
            getLocaleText(
              { locale: this.getOption("locale"), localeText: this.getOption("localeText") },
              "error.noSelection",
            ),
            VALIDATION_CODES.ERR_INVALID_SELECTION,
          );
        }
        const targets: Array<{ tooth: ToothId; surface?: SurfaceId }> = selection.surfaces.length
          ? selection.surfaces.map(({ tooth, surface }) => ({ tooth, surface }))
          : selection.teeth.map((tooth) => ({ tooth }));
        const locked = targets.find(({ tooth, surface }) =>
          surface
            ? this.isToothLocked(tooth) || this.isSurfaceLocked(tooth, surface)
            : this.isToothLocked(tooth),
        );
        if (locked) {
          throw new OdontogramError(
            `Cannot apply a mark because selected target ${locked.tooth}${locked.surface ? `/${locked.surface}` : ""} is locked.`,
            VALIDATION_CODES.ERR_COMMAND_LOCKED_TARGET,
          );
        }
        const target = selection.surfaces.length
          ? this.selectionAsMarkTarget(selection.surfaces)
          : selection.teeth.length === 1
            ? { kind: "tooth" as const, tooth: selection.teeth[0]! }
            : { kind: "teeth" as const, teeth: [...selection.teeth] };
        const mark = normalizeMark({ ...command.mark, target });
        nextMarks = [...nextMarks, mark as OdontographicMark];
      } else if (command.type === "edit-mark") {
        const existing = this.getMark(command.markId);
        if (!existing)
          throw new OdontogramError(
            `Mark with id "${command.markId}" was not found.`,
            VALIDATION_CODES.ERR_MARK_NOT_FOUND,
          );
        if (this.isMarkLocked(existing)) {
          throw new OdontogramError(
            `Cannot edit mark "${command.markId}" because one or more of its targets are locked.`,
            VALIDATION_CODES.ERR_COMMAND_LOCKED_TARGET,
          );
        }
        const updated = normalizeMark({ ...existing, ...command.patch, id: command.markId });
        if (this.isMarkLocked(updated)) {
          throw new OdontogramError(
            `Cannot move mark "${command.markId}" onto a locked target.`,
            VALIDATION_CODES.ERR_COMMAND_LOCKED_TARGET,
          );
        }
        nextMarks = this.state.marks.map((mark) => (mark.id === command.markId ? updated : mark));
      } else {
        const existing = this.getMark(command.markId);
        if (!existing)
          throw new OdontogramError(
            `Mark with id "${command.markId}" was not found.`,
            VALIDATION_CODES.ERR_MARK_NOT_FOUND,
          );
        if (this.isMarkLocked(existing)) {
          throw new OdontogramError(
            `Cannot delete mark "${command.markId}" because one or more of its targets are locked.`,
            VALIDATION_CODES.ERR_COMMAND_LOCKED_TARGET,
          );
        }
        nextMarks = this.state.marks.filter((mark) => mark.id !== command.markId);
      }

      const nextSelection =
        command.type === "delete-mark"
          ? {
              ...this.state.selection,
              annotations: (this.state.selection.annotations ?? []).filter(
                (id) => id !== command.markId,
              ),
            }
          : this.state.selection;
      this.activeMarkCommand = deepClone(command);
      this.setState({ marks: nextMarks, selection: nextSelection }, { source: "internal" });
      const resultMarks =
        command.type === "apply-mark"
          ? this.getMarks().filter(
              (mark) => !previousState.marks.some((oldMark) => oldMark.id === mark.id),
            )
          : command.type === "edit-mark"
            ? [this.getMark(command.markId)!]
            : [];
      return {
        ok: true,
        command: command.type,
        changed: !isDeepEqual(previousState, this.state),
        marks: resultMarks,
        revision: this.revision,
      };
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      const detail = caught instanceof OdontogramValidationError ? caught.issues : undefined;
      return {
        ok: false,
        command: command.type,
        error,
        code: caught instanceof OdontogramError ? caught.code : undefined,
        issues: detail,
        cancelled:
          caught instanceof OdontogramError &&
          (caught.code === VALIDATION_CODES.ERR_COMMAND_CANCELLED ||
            caught.code === VALIDATION_CODES.ERR_COMMAND_LOCKED_TARGET),
        revision: this.revision,
      };
    } finally {
      this.activeMarkCommand = null;
    }
  }

  /** Get all marks referencing a specific tooth. */
  getMarksForTooth(toothId: ToothId): OdontographicMark[] {
    return deepClone(filterMarksForTooth(this.state.marks, toothId));
  }

  /** Get all marks referencing a specific surface on a tooth. */
  getMarksForSurface(toothId: ToothId, surface: SurfaceId): OdontographicMark[] {
    return deepClone(filterMarksForSurface(this.state.marks, toothId, surface));
  }

  /**
   * Add a single mark. Automatically generates a stable ID if omitted.
   * Validates atomically and returns the created canonical mark.
   */
  addMark<TMeta extends Record<string, unknown> = Record<string, unknown>>(
    input: MarkInput<TMeta>,
  ): OdontographicMark<TMeta> {
    this.assertMutable("add mark");
    const newMark = normalizeMark(input);
    this.setState(
      { marks: [...this.state.marks, newMark as OdontographicMark] },
      { source: "internal" },
    );
    return deepClone(this.getMark(newMark.id)! as OdontographicMark<TMeta>);
  }

  /**
   * Add multiple marks in a single atomic update.
   * Returns array of created canonical marks with generated IDs.
   */
  addMarks<TMeta extends Record<string, unknown> = Record<string, unknown>>(
    inputs: Array<MarkInput<TMeta>>,
  ): Array<OdontographicMark<TMeta>> {
    this.assertMutable("add marks");
    const newMarks = normalizeMarks(inputs);
    this.setState(
      { marks: [...this.state.marks, ...(newMarks as OdontographicMark[])] },
      { source: "internal" },
    );
    return newMarks.map((m) => deepClone(this.getMark(m.id)! as OdontographicMark<TMeta>));
  }

  /**
   * Update a mark by ID. Guarantees ID stability (id cannot be modified).
   * Throws OdontogramError if mark is not found.
   */
  updateMark<TMeta extends Record<string, unknown> = Record<string, unknown>>(
    id: string,
    updater:
      | Partial<MarkInput<TMeta>>
      | ((prev: OdontographicMark<TMeta>) => Partial<MarkInput<TMeta>> | OdontographicMark<TMeta>),
  ): OdontographicMark<TMeta> {
    this.assertMutable("update mark");
    const existing = this.getMark<TMeta>(id);
    if (!existing) {
      throw new OdontogramError(
        `Mark with id "${id}" was not found.`,
        VALIDATION_CODES.ERR_MARK_NOT_FOUND,
      );
    }

    const patch = typeof updater === "function" ? updater(deepClone(existing)) : updater;
    const mergedInput: MarkInput<TMeta> = {
      ...existing,
      ...patch,
      id, // Preserve ID unconditionally
    };

    const updatedMark = normalizeMark(mergedInput);
    const nextMarks = this.state.marks.map((m) =>
      m.id === id ? (updatedMark as OdontographicMark) : m,
    );

    this.setState({ marks: nextMarks }, { source: "internal" });
    return deepClone(this.getMark(id)! as OdontographicMark<TMeta>);
  }

  /**
   * Remove a mark by ID.
   * Returns true if removed, false if not found.
   */
  removeMark(id: string): boolean {
    this.assertMutable("remove mark");
    if (!this.hasMark(id)) return false;
    this.setState(
      {
        marks: this.state.marks.filter((m) => m.id !== id),
        selection: {
          ...this.state.selection,
          annotations: (this.state.selection.annotations ?? []).filter((markId) => markId !== id),
        },
      },
      { source: "internal" },
    );
    return true;
  }

  /**
   * Remove multiple marks by ID.
   * Returns the count of removed marks.
   */
  removeMarks(ids: string[]): number {
    this.assertMutable("remove marks");
    const targetIds = new Set(ids);
    const initialCount = this.state.marks.length;
    const remaining = this.state.marks.filter((m) => !targetIds.has(m.id));
    const removedCount = initialCount - remaining.length;
    if (removedCount > 0) {
      this.setState(
        {
          marks: remaining,
          selection: {
            ...this.state.selection,
            annotations: (this.state.selection.annotations ?? []).filter(
              (id) => !targetIds.has(id),
            ),
          },
        },
        { source: "internal" },
      );
    }
    return removedCount;
  }

  /**
   * Remove all marks that target the given tooth.
   * Returns the count of removed marks.
   */
  removeMarksForTooth(toothId: ToothId): number {
    this.assertMutable("remove marks for tooth");
    const initialCount = this.state.marks.length;
    const remaining = this.state.marks.filter((m) => !getMarkTargetTeeth(m).includes(toothId));
    const removedCount = initialCount - remaining.length;
    if (removedCount > 0) {
      const remainingIds = new Set(remaining.map((mark) => mark.id));
      this.setState(
        {
          marks: remaining,
          selection: {
            ...this.state.selection,
            annotations: (this.state.selection.annotations ?? []).filter((id) =>
              remainingIds.has(id),
            ),
          },
        },
        { source: "internal" },
      );
    }
    return removedCount;
  }

  /**
   * Clear all marks or marks matching optional filter.
   * Returns the count of cleared marks.
   */
  clearMarks(filter?: MarkFilter): number {
    this.assertMutable("clear marks");
    if (!filter) {
      const count = this.state.marks.length;
      if (count > 0) {
        this.setState({ marks: [] }, { source: "internal" });
      }
      return count;
    }

    const initialCount = this.state.marks.length;
    const remaining = this.state.marks.filter((m) => !markMatchesFilter(m, filter));

    const removedCount = initialCount - remaining.length;
    if (removedCount > 0) {
      this.setState({ marks: remaining }, { source: "internal" });
    }
    return removedCount;
  }

  // ==========================================================================
  // Tooth State (Presence Overlay) Operations
  // ==========================================================================

  /**
   * Get the state overlay for a tooth.
   * If not explicitly stored, returns default { presence: "present" }.
   */
  getToothState(toothId: ToothId): ToothState {
    const entry = this.state.teeth[toothId];
    return entry ? deepClone(entry) : { presence: "present" };
  }

  /** Get the resolved presence for a tooth ("present" | "missing" | "unerupted"). */
  getToothPresence(toothId: ToothId): ToothPresence {
    return resolvePresence(this.state.teeth, toothId);
  }

  /** Get a snapshot of all explicit tooth presence overlays. */
  getTeethState(): Record<ToothId, ToothState> {
    return deepClone(this.state.teeth);
  }

  /** Check if a tooth has an explicit overlay entry. */
  hasToothOverlay(toothId: ToothId): boolean {
    return toothId in this.state.teeth;
  }

  /**
   * Set the presence state of a tooth.
   * Passing null, undefined, or "present" removes the explicit sparse overlay.
   */
  setToothState(
    toothId: ToothId,
    toothState: ToothState | ToothPresence | null | undefined,
    options?: SetToothStateOptions,
  ): void {
    this.assertMutable("set tooth state");
    const nextTeeth = { ...this.state.teeth };
    let nextMarks = this.state.marks;

    if (
      toothState === null ||
      toothState === undefined ||
      toothState === "present" ||
      (typeof toothState === "object" && toothState.presence === "present")
    ) {
      delete nextTeeth[toothId];
    } else {
      const presence: ToothPresence =
        typeof toothState === "string" ? toothState : toothState.presence;
      nextTeeth[toothId] = { presence };

      if (options?.pruneMarks) {
        if (presence === "missing") {
          nextMarks = nextMarks.filter((m) => {
            const teeth = getMarkTargetTeeth(m);
            if (!teeth.includes(toothId)) return true;
            return getMarkTargetSurfaces(m, toothId).length === 0;
          });
        } else if (presence === "unerupted") {
          nextMarks = nextMarks.filter((m) => {
            const teeth = getMarkTargetTeeth(m);
            if (!teeth.includes(toothId)) return true;
            const surfaces = getMarkTargetSurfaces(m, toothId);
            if (surfaces.length > 0 && (m.type === "caries" || m.type === "restoration")) {
              return false;
            }
            return true;
          });
        }
      }
    }

    this.setState({ teeth: nextTeeth, marks: nextMarks }, { source: "internal" });
  }

  /** Bulk update teeth presence overlay. */
  setTeethState(
    teeth: Record<ToothId, ToothState | ToothPresence | null | undefined>,
    options?: SetToothStateOptions,
  ): void {
    this.assertMutable("set teeth state");
    const nextTeeth = { ...this.state.teeth };
    let nextMarks = this.state.marks;

    for (const [toothId, val] of Object.entries(teeth)) {
      if (
        val === null ||
        val === undefined ||
        val === "present" ||
        (typeof val === "object" && val.presence === "present")
      ) {
        delete nextTeeth[toothId];
      } else {
        const presence: ToothPresence = typeof val === "string" ? val : val.presence;
        nextTeeth[toothId] = { presence };

        if (options?.pruneMarks) {
          if (presence === "missing") {
            nextMarks = nextMarks.filter((m) => {
              const targetTeeth = getMarkTargetTeeth(m);
              if (!targetTeeth.includes(toothId)) return true;
              return getMarkTargetSurfaces(m, toothId).length === 0;
            });
          } else if (presence === "unerupted") {
            nextMarks = nextMarks.filter((m) => {
              const targetTeeth = getMarkTargetTeeth(m);
              if (!targetTeeth.includes(toothId)) return true;
              const surfaces = getMarkTargetSurfaces(m, toothId);
              if (surfaces.length > 0 && (m.type === "caries" || m.type === "restoration")) {
                return false;
              }
              return true;
            });
          }
        }
      }
    }
    this.setState({ teeth: nextTeeth, marks: nextMarks }, { source: "internal" });
  }

  /** Reset a single tooth's presence overlay back to default (present). */
  resetToothState(toothId: ToothId): void {
    this.assertMutable("reset tooth state");
    if (toothId in this.state.teeth) {
      const nextTeeth = { ...this.state.teeth };
      delete nextTeeth[toothId];
      this.setState({ teeth: nextTeeth }, { source: "internal" });
    }
  }

  /** Reset all tooth presence overlays back to default (all present). */
  resetTeethState(): void {
    this.assertMutable("reset teeth state");
    if (Object.keys(this.state.teeth).length > 0) {
      this.setState({ teeth: {} }, { source: "internal" });
    }
  }

  // ==========================================================================
  // Selection Operations (DOM-Independent)
  // ==========================================================================

  /** Get current selection state snapshot. */
  getSelection(): SelectionState {
    return deepClone(this.state.selection);
  }

  /** Replace selection state. */
  setSelection(
    selection:
      | SelectionState
      | {
          teeth?: ToothId[];
          surfaces?: Array<{ tooth: ToothId; surface: SurfaceId }>;
          annotations?: string[];
        },
  ): void {
    this.assertMutable("set selection");
    this.setState(
      {
        selection: {
          teeth: selection.teeth ? [...selection.teeth] : [],
          surfaces: selection.surfaces ? [...selection.surfaces] : [],
          ...(selection.annotations ? { annotations: [...selection.annotations] } : {}),
        },
      },
      { source: "interaction" },
    );
  }

  /** Programmatically select a tooth. */
  selectTooth(tooth: ToothId, mode: "replace" | "toggle" | "add" = "replace"): void {
    this.assertMutable("select tooth");
    if (!this.getOption("selectable") || !this.canSelectTooth(tooth)) return;

    let teeth: ToothId[];
    let surfaces = this.state.selection.surfaces;

    if (mode === "replace") {
      teeth = [tooth];
      surfaces = [];
    } else if (mode === "add") {
      teeth = this.state.selection.teeth.includes(tooth)
        ? [...this.state.selection.teeth]
        : [...this.state.selection.teeth, tooth];
    } else {
      // toggle
      teeth = this.state.selection.teeth.includes(tooth)
        ? this.state.selection.teeth.filter((t) => t !== tooth)
        : [...this.state.selection.teeth, tooth];
    }

    this.setState({ selection: { teeth, surfaces } }, { source: "interaction" });
  }

  /** Programmatically select a surface. */
  selectSurface(
    tooth: ToothId,
    surface: SurfaceId,
    mode: "replace" | "toggle" | "add" = "replace",
  ): void {
    this.assertMutable("select surface");
    if (!this.getOption("selectable") || !this.canSelectSurface(tooth, surface)) return;

    let teeth = this.state.selection.teeth;
    let surfaces: Array<{ tooth: ToothId; surface: SurfaceId }>;

    const exists = this.state.selection.surfaces.some(
      (s) => s.tooth === tooth && s.surface === surface,
    );

    if (mode === "replace") {
      teeth = [];
      surfaces = [{ tooth, surface }];
    } else if (mode === "add") {
      surfaces = exists
        ? [...this.state.selection.surfaces]
        : [...this.state.selection.surfaces, { tooth, surface }];
    } else {
      // toggle
      surfaces = exists
        ? this.state.selection.surfaces.filter((s) => !(s.tooth === tooth && s.surface === surface))
        : [...this.state.selection.surfaces, { tooth, surface }];
    }

    this.setState({ selection: { teeth, surfaces } }, { source: "interaction" });
  }

  /** Select a mark or multi-tooth annotation as one unit. */
  selectAnnotation(markId: string): void {
    this.assertMutable("select annotation");
    if (!this.getOption("selectable")) return;
    if (!this.state.marks.some((mark) => mark.id === markId)) return;
    this.setState(
      { selection: { teeth: [], surfaces: [], annotations: [markId] } },
      { source: "interaction" },
    );
  }

  /** Check whether a mark or annotation is selected. */
  isAnnotationSelected(markId: string): boolean {
    return this.state.selection.annotations?.includes(markId) ?? false;
  }

  /** Clear all tooth and surface selection. */
  clearSelection(): void {
    this.assertMutable("clear selection");
    if (
      this.state.selection.teeth.length > 0 ||
      this.state.selection.surfaces.length > 0 ||
      (this.state.selection.annotations?.length ?? 0) > 0
    ) {
      this.setState({ selection: { teeth: [], surfaces: [] } }, { source: "interaction" });
    }
  }

  /** Alias for {@link clearSelection}. */
  resetSelection(): void {
    this.clearSelection();
  }

  /** Check if a tooth is selected. */
  isToothSelected(tooth: ToothId): boolean {
    return this.state.selection.teeth.includes(tooth);
  }

  /** Check if a surface is selected. */
  isSurfaceSelected(tooth: ToothId, surface: SurfaceId): boolean {
    return this.state.selection.surfaces.some((s) => s.tooth === tooth && s.surface === surface);
  }

  // ==========================================================================
  // Atomic Batches with Transactional Rollback
  // ==========================================================================

  /**
   * Execute compound operations in an atomic batch.
   * If any error occurs inside the batch, changes are rolled back completely.
   * When successful, callbacks and re-render execute exactly once.
   */
  batch<T>(fn: () => T, options: BatchOptions = { transactional: true }): T {
    this.assertNotInCallback("batch");
    this.assertMutable("execute batch");
    if (this.batchDepth === 0) {
      this.preBatchState = deepClone(this.state);
      this.preBatchRevision = this.revision;
      this.preBatchOptions = deepClone(this.options);
    }

    this.batchDepth++;

    let result: T;
    try {
      result = fn();
    } catch (err) {
      if (options.transactional !== false && this.preBatchState) {
        this.state = this.preBatchState;
        this.revision = this.preBatchRevision!;
        this.options = this.preBatchOptions!;
        this.renderQueued = false;
      }
      throw err;
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        const preState = this.preBatchState;
        this.preBatchState = null;
        this.preBatchRevision = null;
        this.preBatchOptions = null;

        if (preState && !isDeepEqual(this.state, preState)) {
          if (!this.applyingHistory) this.recordHistory(preState);
          this.revision += 1;

          const changedProperties: Array<keyof OdontogramState> = [];
          if (this.state.view !== preState.view) changedProperties.push("view");
          if (!isDeepEqual(this.state.marks, preState.marks)) changedProperties.push("marks");
          if (!isDeepEqual(this.state.selection, preState.selection))
            changedProperties.push("selection");
          if (!isDeepEqual(this.state.teeth, preState.teeth)) changedProperties.push("teeth");

          if (changedProperties.includes("marks")) {
            this.runCallback("marksSet", this.getOption("marksSet"), {
              marks: deepClone(this.state.marks),
            });
          }
          if (changedProperties.includes("selection")) {
            this.emitSelectionChange();
          }
          if (changedProperties.includes("teeth")) {
            const toothCallback = this.getOption("toothStateDidChange");
            if (toothCallback) {
              const allTeeth = new Set([
                ...Object.keys(preState.teeth),
                ...Object.keys(this.state.teeth),
              ]);
              for (const toothId of allTeeth) {
                const prev = preState.teeth[toothId] ?? { presence: "present" };
                const curr = this.state.teeth[toothId] ?? { presence: "present" };
                if (!isDeepEqual(prev, curr)) {
                  this.runCallback("toothStateDidChange", toothCallback, {
                    toothId,
                    state: deepClone(curr),
                    previousState: deepClone(prev),
                  });
                }
              }
            }
          }

          const validationCallback = this.getOption("validationDidChange");
          if (validationCallback) {
            this.runCallback("validationDidChange", validationCallback, {
              result: this.validate(),
            });
          }

          const stateArg = {
            state: deepClone(this.state),
            previousState: deepClone(preState),
            revision: this.revision,
            source: "batch" as const,
            changedProperties,
          };
          this.runCallback("stateDidChange", this.getOption("stateDidChange"), stateArg);
          this.runCallback("editDidChange", this.getOption("editDidChange"), stateArg);
          if (changedProperties.includes("view") && this.rendered) {
            this.unmountView();
            this.mountView();
            this.runCallback("viewDidChange", this.getOption("viewDidChange"), {
              previousView: preState.view,
              view: this.state.view,
            });
            this.renderQueued = false;
          }
        }

        if (this.renderQueued) {
          this.renderQueued = false;
          this.performRender();
        }
      }
    }

    return result!;
  }

  /** Backwards-compatible alias for batch(). */
  batchRendering(fn: () => void): void {
    this.batch(fn);
  }

  // ==========================================================================
  // Reset & Referential Integrity Cleanup
  // ==========================================================================

  /**
   * Reset odontogram state to initial clean state.
   */
  reset(options?: ResetOptions): void {
    const targetView =
      options?.initialView ??
      (options?.keepView
        ? this.state.view
        : (this.getOption("initialView") ?? DEFAULT_OPTIONS.initialView));
    const targetSelection: SelectionState = options?.keepSelection
      ? deepClone(this.state.selection)
      : { teeth: [], surfaces: [] };

    this.setState(
      {
        view: targetView,
        marks: [],
        selection: targetSelection,
        teeth: {},
      },
      { source: "reset" },
    );
  }

  /** Reset all marks. */
  resetMarks(): void {
    this.assertMutable("reset marks");
    this.clearMarks();
  }

  /** Reset all teeth overlay entries. */
  resetTeeth(): void {
    this.assertMutable("reset teeth");
    this.resetTeethState();
  }

  /**
   * Prune marks that conflict with current tooth presence states
   * (e.g. surface marks on teeth marked as missing).
   * Returns count of pruned marks.
   */
  pruneOrphanedMarks(): number {
    this.assertMutable("prune orphaned marks");
    const initialCount = this.state.marks.length;
    const validMarks = this.state.marks.filter((m) => {
      const teeth = getMarkTargetTeeth(m);
      for (const toothId of teeth) {
        const presence = this.getToothPresence(toothId);
        if (presence === "missing") {
          if (getMarkTargetSurfaces(m, toothId).length > 0) return false;
        } else if (presence === "unerupted") {
          if (
            (m.type === "caries" || m.type === "restoration") &&
            getMarkTargetSurfaces(m, toothId).length > 0
          ) {
            return false;
          }
        }
      }
      return true;
    });

    const removedCount = initialCount - validMarks.length;
    if (removedCount > 0) {
      this.setState({ marks: validMarks }, { source: "internal" });
    }
    return removedCount;
  }

  // ==========================================================================
  // Private View & Rendering Lifecycle
  // ==========================================================================

  private registerPlugins(plugins: OdontogramPlugin[]): void {
    const byId = new Map<string, OdontogramPlugin>();
    for (const plugin of plugins) {
      this.validatePluginDefinition(plugin);
      const id = plugin.pluginDef.id;
      if (byId.has(id)) {
        throw new OdontogramError(
          `Duplicate plugin id "${id}".`,
          VALIDATION_CODES.ERR_PLUGIN_DUPLICATE_ID,
        );
      }
      byId.set(id, plugin);
    }
    const order: OdontogramPlugin[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new OdontogramError(
          `Plugin dependency cycle includes "${id}".`,
          VALIDATION_CODES.ERR_PLUGIN_DEPENDENCY_CYCLE,
        );
      }
      visiting.add(id);
      const plugin = byId.get(id)!;
      for (const dependency of plugin.pluginDef.dependencies ?? []) {
        const target = byId.get(dependency.id);
        if (!target) {
          throw new OdontogramError(
            `Plugin "${id}" requires missing plugin "${dependency.id}".`,
            VALIDATION_CODES.ERR_PLUGIN_MISSING_DEPENDENCY,
          );
        }
        if (dependency.version && !satisfiesVersion(target.pluginDef.version, dependency.version)) {
          throw new OdontogramError(
            `Plugin "${id}" requires "${dependency.id}" at "${dependency.version}", but found "${target.pluginDef.version}".`,
            VALIDATION_CODES.ERR_PLUGIN_VERSION_MISMATCH,
          );
        }
        visit(dependency.id);
      }
      visiting.delete(id);
      visited.add(id);
      order.push(plugin);
    };
    for (const id of byId.keys()) visit(id);
    const installed: string[] = [];
    const failed = new Set<string>();
    for (const plugin of order) {
      const def = plugin.pluginDef;
      const unavailableDependency = def.dependencies?.find((dependency) =>
        failed.has(dependency.id),
      );
      if (unavailableDependency) {
        failed.add(def.id);
        this.reportPluginFailure(
          def.id,
          "dependency",
          new OdontogramError(
            `Plugin "${def.id}" was skipped because dependency "${unavailableDependency.id}" failed registration.`,
            VALIDATION_CODES.ERR_PLUGIN_REGISTRATION_FAILED,
          ),
        );
        continue;
      }
      try {
        this.registerPluginDefinition(plugin);
        installed.push(plugin.pluginDef.id);
      } catch (error) {
        if (
          error instanceof OdontogramError &&
          error.code === VALIDATION_CODES.ERR_PLUGIN_REGISTRATION_FAILED
        ) {
          failed.add(def.id);
          continue;
        }
        for (const id of installed.reverse()) this.unregisterPlugin(id);
        throw error;
      }
    }
  }

  private validatePluginDefinition(plugin: OdontogramPlugin): void {
    const def = plugin?.pluginDef;
    if (!def || !def.id?.trim() || !def.version || !def.apiCompatibility) {
      throw new OdontogramError(
        "A plugin requires a non-empty id, version, and apiCompatibility range.",
        VALIDATION_CODES.ERR_INVALID_OPTION,
      );
    }
    assertPluginApiCompatible(def);
    if (!satisfiesVersion(def.version)) {
      throw new OdontogramError(
        `Plugin "${def.id}" has invalid semantic version "${def.version}".`,
        VALIDATION_CODES.ERR_INVALID_OPTION,
      );
    }
  }

  private registerPluginDefinition(plugin: OdontogramPlugin): void {
    this.validatePluginDefinition(plugin);
    const def = plugin.pluginDef;
    if (this.plugins.has(def.id))
      throw new OdontogramError(
        `Duplicate plugin id "${def.id}".`,
        VALIDATION_CODES.ERR_PLUGIN_DUPLICATE_ID,
      );
    for (const dependency of def.dependencies ?? []) {
      const target = this.plugins.get(dependency.id)?.plugin.pluginDef;
      if (!target)
        throw new OdontogramError(
          `Plugin "${def.id}" requires missing plugin "${dependency.id}".`,
          VALIDATION_CODES.ERR_PLUGIN_MISSING_DEPENDENCY,
        );
      if (dependency.version && !satisfiesVersion(target.version, dependency.version)) {
        throw new OdontogramError(
          `Plugin "${def.id}" requires "${dependency.id}" at "${dependency.version}", but found "${target.version}".`,
          VALIDATION_CODES.ERR_PLUGIN_VERSION_MISMATCH,
        );
      }
    }
    const localViews = new Set<string>();
    for (const view of def.views ?? []) {
      if (localViews.has(view.type)) this.throwContributionConflict("view", view.type);
      localViews.add(view.type);
      if (this.viewMap.has(view.type)) this.throwContributionConflict("view", view.type);
    }
    const localRenderers = new Set<string>();
    for (const renderer of def.dentalRenderers ?? []) {
      if (localRenderers.has(renderer.id))
        this.throwContributionConflict("dental renderer", renderer.id);
      localRenderers.add(renderer.id);
      if (this.dentalRendererMap.has(renderer.id))
        this.throwContributionConflict("dental renderer", renderer.id);
    }
    const localSymbols = new Set<string>();
    const localMarkTypes = new Set<string>();
    for (const symbol of def.symbols ?? []) {
      if (localSymbols.has(symbol.id)) this.throwContributionConflict("symbol", symbol.id);
      localSymbols.add(symbol.id);
      if (this.symbolMap.has(symbol.id)) this.throwContributionConflict("symbol", symbol.id);
      for (const markType of symbol.markTypes) {
        if (localMarkTypes.has(markType))
          this.throwContributionConflict("symbol mark type", markType);
        localMarkTypes.add(markType);
        if (this.symbolTypes.has(markType))
          this.throwContributionConflict("symbol mark type", markType);
      }
    }
    const localTools = new Set<string>();
    for (const tool of def.tools ?? []) {
      if (localTools.has(tool.id)) this.throwContributionConflict("tool", tool.id);
      localTools.add(tool.id);
      if (this.toolMap.has(tool.id)) this.throwContributionConflict("tool", tool.id);
    }
    const localNotations = new Set<string>();
    for (const notation of def.notations ?? []) {
      if (!notation.id || !notation.id.trim() || typeof notation.format !== "function") {
        throw new OdontogramError(
          `Plugin "${def.id}" has an invalid notation contribution without id or format function.`,
          VALIDATION_CODES.ERR_INVALID_OPTION,
        );
      }
      if (localNotations.has(notation.id)) this.throwContributionConflict("notation", notation.id);
      localNotations.add(notation.id);
      if (this.notationMap.has(notation.id))
        this.throwContributionConflict("notation", notation.id);
    }

    this.plugins.set(def.id, { plugin });
    for (const view of def.views ?? []) {
      this.viewMap.set(view.type, this.wrapPluginView(def.id, view));
      this.viewOwners.set(view.type, def.id);
    }
    for (const renderer of def.dentalRenderers ?? [])
      this.dentalRendererMap.set(renderer.id, { pluginId: def.id, definition: renderer });
    for (const symbol of def.symbols ?? []) {
      this.symbolMap.set(symbol.id, { pluginId: def.id, definition: symbol });
      for (const markType of symbol.markTypes) this.symbolTypes.set(markType, symbol.id);
    }
    for (const tool of def.tools ?? [])
      this.toolMap.set(tool.id, { pluginId: def.id, definition: tool });
    for (const notation of def.notations ?? []) {
      this.notationMap.set(notation.id, { pluginId: def.id, definition: notation });
      registerValidNotation(notation.id);
    }

    if (def.onRegister) {
      const context: OdontogramPluginContext = { odontogram: this, pluginId: def.id };
      try {
        const cleanup = def.onRegister(context);
        if (cleanup) this.plugins.get(def.id)!.cleanup = cleanup;
      } catch (error) {
        this.removePluginContributions(plugin);
        this.plugins.delete(def.id);
        this.reportPluginFailure(def.id, "register", error);
        throw new OdontogramError(
          `Plugin "${def.id}" failed during registration: ${String(error)}`,
          VALIDATION_CODES.ERR_PLUGIN_REGISTRATION_FAILED,
        );
      }
    }
  }

  private removePluginContributions(plugin: OdontogramPlugin): void {
    const def = plugin.pluginDef;
    for (const view of def.views ?? []) {
      this.viewMap.delete(view.type);
      this.viewOwners.delete(view.type);
    }
    for (const renderer of def.dentalRenderers ?? []) this.dentalRendererMap.delete(renderer.id);
    for (const symbol of def.symbols ?? []) {
      this.symbolMap.delete(symbol.id);
      for (const markType of symbol.markTypes) this.symbolTypes.delete(markType);
    }
    for (const tool of def.tools ?? []) this.toolMap.delete(tool.id);
    for (const notation of def.notations ?? []) {
      this.notationMap.delete(notation.id);
      unregisterValidNotation(notation.id);
    }
  }

  private throwContributionConflict(kind: string, id: string): never {
    throw new OdontogramError(
      `Duplicate plugin ${kind} contribution "${id}".`,
      VALIDATION_CODES.ERR_PLUGIN_CONTRIBUTION_CONFLICT,
    );
  }

  private wrapPluginView(pluginId: string, view: ViewDefinition): ViewDefinition {
    return {
      ...view,
      render: (context) =>
        this.invokePluginView(pluginId, `view:${view.type}:render`, () => view.render(context)),
      ...(view.update
        ? {
            update: (context: ViewRenderContext) =>
              this.invokePluginView(pluginId, `view:${view.type}:update`, () =>
                view.update!(context),
              ),
          }
        : {}),
      ...(view.destroy
        ? {
            destroy: (context: ViewRenderContext) =>
              this.invokePluginView(pluginId, `view:${view.type}:destroy`, () =>
                view.destroy!(context),
              ),
          }
        : {}),
    };
  }

  private invokePluginView(pluginId: string, phase: string, render: () => void): void {
    try {
      render();
    } catch (error) {
      if (this.plugins.get(pluginId)?.plugin.pluginDef.errorPolicy !== "isolate") throw error;
      this.reportPluginFailure(pluginId, phase, error);
    }
  }

  private runPluginHook(pluginId: string, phase: string, hook: () => void): void {
    try {
      hook();
    } catch (error) {
      this.reportPluginFailure(pluginId, phase, error);
    }
  }

  private reportPluginFailure(pluginId: string, phase: string, error: unknown): void {
    const callback = this.getOption("pluginDidError");
    if (!callback) {
      console.error(`[Odontogram] Plugin "${pluginId}" failed during ${phase}`, error);
      return;
    }
    try {
      callback({ pluginId, phase, error });
    } catch (reportingError) {
      console.error("[Odontogram] pluginDidError callback threw", reportingError);
    }
  }

  private resolveViewDefinition(viewType: string): ViewDefinition | undefined {
    if (this.viewMap.has(viewType)) {
      return this.viewMap.get(viewType);
    }
    if (viewType === "primary" && this.viewMap.has("deciduous")) {
      return this.viewMap.get("deciduous");
    }
    if (viewType === "deciduous" && this.viewMap.has("primary")) {
      return this.viewMap.get("primary");
    }
    if (
      (viewType === "upper" ||
        viewType === "lower" ||
        viewType === "maxillary" ||
        viewType === "mandibular") &&
      this.viewMap.has("arch")
    ) {
      return this.viewMap.get("arch");
    }
    if (viewType.startsWith("quadrant-") && this.viewMap.has("quadrant")) {
      return this.viewMap.get("quadrant");
    }
    if (
      viewType.startsWith("tooth-") &&
      (this.viewMap.has("tooth") || this.viewMap.has("tooth-detail"))
    ) {
      return this.viewMap.get("tooth") ?? this.viewMap.get("tooth-detail");
    }
    return undefined;
  }

  private mountView(): void {
    const viewDef = this.resolveViewDefinition(this.state.view);
    if (!viewDef) {
      console.warn(
        `[Odontogram] No view implementation registered for "${this.state.view}". Add a view plugin (e.g. @odontogram/svg) to render.`,
      );
      return;
    }

    if (!this.chartEl) return;

    this.activeView = viewDef;
    this.activeViewOwnerId = this.viewOwners.get(viewDef.type) ?? null;
    this.viewContext = this.createViewContext();
    viewDef.render(this.viewContext);

    const viewDidMount = this.getOption("viewDidMount");
    if (viewDidMount && this.chartEl?.firstElementChild) {
      this.runCallback("viewDidMount", viewDidMount, {
        view: this.state.view,
        el: this.chartEl.firstElementChild,
      });
    }
  }

  private unmountView(): void {
    if (!this.activeView || !this.viewContext) return;

    const viewWillUnmount = this.getOption("viewWillUnmount");
    if (viewWillUnmount && this.chartEl?.firstElementChild) {
      this.runCallback("viewWillUnmount", viewWillUnmount, {
        view: this.state.view,
        el: this.chartEl.firstElementChild,
      });
    }

    this.activeView.destroy?.(this.viewContext);

    if (this.chartEl) {
      this.chartEl.innerHTML = "";
    }

    this.activeView = null;
    this.activeViewOwnerId = null;
    this.viewContext = null;
  }

  private createViewContext(): ViewRenderContext {
    const el = this.chartEl!;
    const controlled = this.getMode() === "controlled";
    const uiReadOnly =
      controlled ||
      Boolean(this.getOption("readOnly")) ||
      Boolean(this.getOption("disabled")) ||
      !this.getOption("selectable");
    return {
      el,
      options: this.options,
      state: deepClone(this.state),
      viewOptions: deepClone(this.options.viewOptions),
      requestRender: () => this.requestRender(),
      selectTooth: uiReadOnly
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (tooth, mode = "replace") => this.selectTooth(tooth, mode),
      selectSurface: uiReadOnly
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (tooth, surface, mode = "replace") => this.selectSurface(tooth, surface, mode),
      selectAnnotation: uiReadOnly
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (markId) => this.selectAnnotation(markId),
      toggleSurfaceSelection: uiReadOnly
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (tooth, surface, mode = "toggle") => this.selectSurface(tooth, surface, mode),
      emitToothClick: (tooth, jsEvent) => this.emitToothClick(tooth, jsEvent),
      emitSurfaceClick: (tooth, surface, jsEvent) => this.emitSurfaceClick(tooth, surface, jsEvent),
      emitToothDetail: (tooth, trigger, jsEvent) =>
        this.emitDetail(tooth, undefined, trigger, jsEvent),
      emitSurfaceDetail: (tooth, surface, trigger, jsEvent) =>
        this.emitDetail(tooth, surface, trigger, jsEvent),
      getDentalRenderers: () => this.getDentalRenderers(),
      getSymbol: (markType) => this.getSymbol(markType),
      getNotation: (notation) => this.getNotation(notation),
      getNotations: () => this.getNotations(),
    };
  }

  private assertMutable(_operation: string): void {
    if (this.getMode() === "controlled") {
      throw new OdontogramError(
        getLocaleText(
          { locale: this.getOption("locale"), localeText: this.getOption("localeText") },
          "error.controlledMutation",
        ),
        VALIDATION_CODES.ERR_CONTROLLED_MUTATION,
      );
    }
  }

  private getHistoryLimit(): number {
    return this.getOption("historyLimit") ?? 100;
  }

  private recordHistory(state: OdontogramState): void {
    const limit = this.getHistoryLimit();
    if (limit <= 0) return;
    this.undoStack.push(deepClone(state));
    this.trimUndoStack();
    this.redoStack = [];
    this.notifyHistoryChange();
  }

  private trimUndoStack(): void {
    const limit = this.getHistoryLimit();
    if (this.undoStack.length > limit) this.undoStack.splice(0, this.undoStack.length - limit);
  }

  private clearHistory(): void {
    if (this.undoStack.length === 0 && this.redoStack.length === 0) return;
    this.undoStack = [];
    this.redoStack = [];
    this.notifyHistoryChange();
  }

  private notifyHistoryChange(): void {
    const callback = this.getOption("historyDidChange");
    if (!callback) return;
    const change: HistoryChangeArg = {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
    this.runCallback("historyDidChange", callback, change);
  }

  private requestRender(): void {
    if (!this.rendered) return;

    if (this.batchDepth > 0) {
      this.renderQueued = true;
      return;
    }

    this.performRender();
  }

  private performRender(): void {
    this.renderControls();
    if (!this.activeView || !this.viewContext || !this.chartEl) return;

    this.viewContext.state = deepClone(this.state);
    this.viewContext.options = this.options;

    if (typeof this.activeView.update === "function") {
      this.activeView.update(this.viewContext);
    } else {
      this.activeView.destroy?.(this.viewContext);
      this.chartEl.innerHTML = "";
      this.activeView.render(this.viewContext);
    }
  }

  private canSelectTooth(tooth: ToothId): boolean {
    return (
      !this.getOption("lockedTeeth")?.includes(tooth) &&
      (this.getOption("isToothSelectable")?.(tooth) ?? true)
    );
  }

  private isToothLocked(tooth: ToothId): boolean {
    return this.getOption("lockedTeeth")?.includes(tooth) ?? false;
  }

  private isSurfaceLocked(tooth: ToothId, surface: SurfaceId): boolean {
    return (
      this.getOption("lockedSurfaces")?.some(
        (item) => item.tooth === tooth && item.surface === surface,
      ) ?? false
    );
  }

  private isMarkLocked(mark: OdontographicMark): boolean {
    const target = mark.target;
    if ("elements" in target) {
      return target.elements.some(
        (element) =>
          this.isToothLocked(element.tooth) ||
          (element.surfaces
            ? element.surfaces.some((surface) => this.isSurfaceLocked(element.tooth, surface))
            : false),
      );
    }
    if ("teeth" in target) return target.teeth.some((tooth) => this.isToothLocked(tooth));
    if ("surfaces" in target && Array.isArray(target.surfaces)) {
      return (
        this.isToothLocked(target.tooth) ||
        target.surfaces.some((surface) => this.isSurfaceLocked(target.tooth, surface))
      );
    }
    return this.isToothLocked(target.tooth);
  }

  private selectionAsMarkTarget(
    surfaces: Array<{ tooth: ToothId; surface: SurfaceId }>,
  ): OdontographicMark["target"] {
    const grouped = new Map<ToothId, SurfaceId[]>();
    for (const { tooth, surface } of surfaces) {
      const toothSurfaces = grouped.get(tooth) ?? [];
      toothSurfaces.push(surface);
      grouped.set(tooth, toothSurfaces);
    }
    const elements = [...grouped].map(([tooth, toothSurfaces]) => ({
      tooth,
      surfaces: toothSurfaces,
    }));
    if (elements.length === 1) return { kind: "surface", ...elements[0]! };
    return { kind: "complex", elements };
  }

  private canSelectSurface(tooth: ToothId, surface: SurfaceId): boolean {
    return (
      this.canSelectTooth(tooth) &&
      !this.getOption("lockedSurfaces")?.some(
        (item) => item.tooth === tooth && item.surface === surface,
      ) &&
      (this.getOption("isSurfaceSelectable")?.(tooth, surface) ?? true)
    );
  }

  private emitToothClick(tooth: ToothId, jsEvent?: Event): void {
    this.runCallback("toothClick", this.getOption("toothClick"), {
      target: { kind: "tooth", tooth },
      tooth,
      selection: this.getSelection(),
      jsEvent,
    });
  }

  private emitSurfaceClick(tooth: ToothId, surface: SurfaceId, jsEvent?: Event): void {
    this.runCallback("surfaceClick", this.getOption("surfaceClick"), {
      target: { kind: "surface", tooth, surface },
      tooth,
      surface,
      selection: this.getSelection(),
      jsEvent,
    });
  }

  private emitSelectionChange(): void {
    const selection: SelectionState = {
      teeth: [...this.state.selection.teeth],
      surfaces: [...this.state.selection.surfaces],
      ...(this.state.selection.annotations
        ? { annotations: [...this.state.selection.annotations] }
        : {}),
    };
    this.runCallback("selectionDidChange", this.getOption("selectionDidChange"), { selection });
  }

  private emitDetail(
    tooth: ToothId,
    surface: SurfaceId | undefined,
    trigger: "focus" | "click",
    jsEvent?: Event,
  ): void {
    const marks = surface
      ? filterMarksForSurface(this.state.marks, tooth, surface)
      : filterMarksForTooth(this.state.marks, tooth);
    const targetSurfaces = new Set<SurfaceId>(surface ? [surface] : []);
    if (!surface) {
      for (const selected of this.state.selection.surfaces) {
        if (selected.tooth === tooth) targetSurfaces.add(selected.surface);
      }
      for (const mark of marks) {
        for (const targetSurface of getMarkTargetSurfaces(mark, tooth))
          targetSurfaces.add(targetSurface);
      }
    }
    this.runCallback("detailDidChange", this.getOption("detailDidChange"), {
      tooth,
      ...(surface ? { surface } : {}),
      surfaces: [...targetSurfaces],
      marks: deepClone(marks),
      trigger,
      jsEvent,
    });
  }

  private assertNotInCallback(operation: string): void {
    if (this.callbackDepth > 0) {
      throw new OdontogramError(
        `Cannot call ${operation} from an Odontogram callback. Schedule the operation after the callback returns.`,
        VALIDATION_CODES.ERR_TRANSACTION_FAILED,
      );
    }
  }

  private runCallback<T>(
    name: string,
    callback: ((arg: T) => unknown) | (() => unknown) | undefined,
    arg?: T,
  ): void {
    if (!callback) return;
    this.callbackDepth++;
    try {
      callback(arg as T);
    } catch (error) {
      this.reportCallbackError(name, error);
    } finally {
      this.callbackDepth--;
    }
  }

  private runBeforeCallback<T>(
    name: string,
    callback: ((arg: T) => boolean | void) | (() => boolean | void) | undefined,
    arg?: T,
  ): boolean {
    if (!callback) return true;
    this.callbackDepth++;
    try {
      return callback(arg as T) !== false;
    } catch (error) {
      this.reportCallbackError(name, error);
      return false;
    } finally {
      this.callbackDepth--;
    }
  }

  private reportCallbackError(callback: string, error: unknown): void {
    const onError = this.getOption("errorDidOccur");
    if (onError) {
      this.callbackDepth++;
      try {
        onError({ error, phase: "callback", callback } satisfies OdontogramErrorArg);
      } catch (reportingError) {
        console.error("[Odontogram] errorDidOccur callback threw", reportingError);
      } finally {
        this.callbackDepth--;
      }
    } else {
      console.error(`[Odontogram] ${callback} callback threw`, error);
    }
  }

  private renderControls(): void {
    if (!this.rendered || !this.toolbarEl || !this.legendEl) return;
    renderToolbar(this, this.toolbarEl);
    renderLegend(this, this.legendEl);
    const toolbar = this.getOption("toolbar");
    const position = toolbar && typeof toolbar === "object" ? (toolbar.position ?? "top") : "top";
    this.hostEl?.classList.toggle(
      "odontogram-layout-horizontal",
      position === "left" || position === "right",
    );
    if (position === "bottom" || position === "right") {
      if (this.hostEl?.lastElementChild !== this.toolbarEl) this.hostEl?.append(this.toolbarEl);
    } else if (this.hostEl?.firstElementChild !== this.toolbarEl) {
      this.hostEl?.prepend(this.toolbarEl);
    }
  }
}
