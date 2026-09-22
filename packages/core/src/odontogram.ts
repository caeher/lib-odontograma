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
import { deepClone, isDeepEqual, validateOdontogramState, validateOptions } from "./validation.js";
import type {
  BatchOptions,
  MarkFilter,
  MarkInput,
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
} from "./types.js";

const IMMUTABLE_OPTIONS = new Set<keyof OdontogramOptions>(["plugins", "initialView"]);

export class Odontogram {
  private el: HTMLElement | null = null;
  private options: OdontogramOptions;
  private state: OdontogramState;
  private revision = 0;
  private viewMap: Map<ViewType, ViewDefinition> = new Map();
  private activeView: ViewDefinition | null = null;
  private viewContext: ViewRenderContext | null = null;
  private rendered = false;
  private batchDepth = 0;
  private renderQueued = false;
  private hostEl: HTMLElement | null = null;

  // Transactional batch state
  private preBatchState: OdontogramState | null = null;
  private preBatchRevision: number | null = null;
  private preBatchOptions: OdontogramOptions | null = null;

  constructor(el?: HTMLElement | null, options: OdontogramOptions = {}) {
    if (el !== undefined && el !== null) {
      if (typeof el !== "object" || !("appendChild" in el)) {
        throw new OdontogramError(
          "A valid HTMLElement container is required to instantiate Odontogram with a container.",
          VALIDATION_CODES.ERR_INVALID_CONTAINER,
        );
      }
      this.el = el;
    }

    const optionsValidation = validateOptions(options);
    if (!optionsValidation.valid) {
      throw new OdontogramValidationError(
        `Invalid odontogram configuration options: ${optionsValidation.errors[0]?.message}`,
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
    if (container) {
      if (typeof container !== "object" || !("appendChild" in container)) {
        throw new OdontogramError(
          "A valid HTMLElement container is required to render Odontogram.",
          VALIDATION_CODES.ERR_INVALID_CONTAINER,
        );
      }
      this.el = container;
    }

    if (!this.el) {
      throw new OdontogramError(
        "No HTMLElement container available to render Odontogram. Pass a container to constructor or render(container).",
        VALIDATION_CODES.ERR_NO_CONTAINER,
      );
    }

    if (this.rendered) {
      this.requestRender();
      return;
    }

    this.hostEl = document.createElement("div");
    this.hostEl.className = "odontogram-host";
    this.hostEl.style.width = "100%";
    const height = this.getOption("height");
    this.hostEl.style.height = typeof height === "number" ? `${height}px` : String(height);
    this.el.appendChild(this.hostEl);

    this.rendered = true;
    this.mountView();
  }

  destroy(): void {
    if (!this.rendered) return;

    this.unmountView();
    if (this.hostEl) {
      this.hostEl.remove();
      this.hostEl = null;
    }
    this.rendered = false;
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
    if (IMMUTABLE_OPTIONS.has(name)) {
      console.warn(
        `[Odontogram] Option "${String(name)}" cannot be changed after initialization. Use changeView() for view changes.`,
      );
      return;
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
    this.requestRender();
  }

  changeView(view: ViewType, viewOptions?: ViewOptions): void {
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

    this.options.viewOptions = mergedViewOptions;

    if (this.state.view === view) {
      this.requestRender();
      return;
    }
    this.setState({ view }, { source: "internal" });
  }

  getState(): OdontogramState {
    return deepClone(this.state);
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

    // 3. Atomically apply the validated state
    const previousState = this.state;
    const changedProperties: Array<keyof OdontogramState> = [];

    if (candidateState.view !== previousState.view) changedProperties.push("view");
    if (!isDeepEqual(candidateState.marks, previousState.marks)) changedProperties.push("marks");
    if (!isDeepEqual(candidateState.selection, previousState.selection))
      changedProperties.push("selection");
    if (!isDeepEqual(candidateState.teeth, previousState.teeth)) changedProperties.push("teeth");

    this.state = candidateState;

    if (options?.revision !== undefined) {
      this.revision = options.revision;
    } else if (this.batchDepth === 0) {
      this.revision += 1;
    }

    const source: StateChangeSource =
      options?.source ?? (this.batchDepth > 0 ? "batch" : "internal");

    // Callback notifications (deferred if batched)
    if (!options?.silent) {
      if (this.batchDepth === 0) {
        if (changedProperties.includes("marks")) {
          this.getOption("marksSet")?.({ marks: deepClone(this.state.marks) });
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
                toothCallback({ toothId, state: deepClone(curr), previousState: deepClone(prev) });
              }
            }
          }
        }

        const validationCallback = this.getOption("validationDidChange");
        if (validationCallback) {
          const finalResult = activeValidationResult ?? this.validate();
          validationCallback({ result: finalResult });
        }

        const stateCallback = this.getOption("stateDidChange");
        if (stateCallback) {
          stateCallback({
            state: deepClone(this.state),
            previousState: deepClone(previousState),
            revision: this.revision,
            source,
            changedProperties,
          });
        }
      }
    }

    if (changedProperties.includes("view") && this.rendered) {
      this.unmountView();
      this.mountView();
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
    this.setState({ marks: this.state.marks.filter((m) => m.id !== id) }, { source: "internal" });
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
      this.setState({ marks: remaining }, { source: "internal" });
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
      this.setState({ marks: remaining }, { source: "internal" });
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
      | { teeth?: ToothId[]; surfaces?: Array<{ tooth: ToothId; surface: SurfaceId }> },
  ): void {
    this.assertMutable("set selection");
    this.setState(
      {
        selection: {
          teeth: selection.teeth ? [...selection.teeth] : [],
          surfaces: selection.surfaces ? [...selection.surfaces] : [],
        },
      },
      { source: "interaction" },
    );
  }

  /** Programmatically select a tooth. */
  selectTooth(tooth: ToothId, mode: "replace" | "toggle" | "add" = "replace"): void {
    this.assertMutable("select tooth");
    if (!this.getOption("selectable")) return;

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
    if (!this.getOption("selectable")) return;

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

  /** Clear all tooth and surface selection. */
  clearSelection(): void {
    this.assertMutable("clear selection");
    if (this.state.selection.teeth.length > 0 || this.state.selection.surfaces.length > 0) {
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
          this.revision += 1;

          const changedProperties: Array<keyof OdontogramState> = [];
          if (this.state.view !== preState.view) changedProperties.push("view");
          if (!isDeepEqual(this.state.marks, preState.marks)) changedProperties.push("marks");
          if (!isDeepEqual(this.state.selection, preState.selection))
            changedProperties.push("selection");
          if (!isDeepEqual(this.state.teeth, preState.teeth)) changedProperties.push("teeth");

          if (changedProperties.includes("marks")) {
            this.getOption("marksSet")?.({ marks: deepClone(this.state.marks) });
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
                  toothCallback({
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
            validationCallback({ result: this.validate() });
          }

          const stateCallback = this.getOption("stateDidChange");
          if (stateCallback) {
            stateCallback({
              state: deepClone(this.state),
              previousState: deepClone(preState),
              revision: this.revision,
              source: "batch",
              changedProperties,
            });
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
    for (const plugin of plugins) {
      for (const view of plugin.pluginDef.views ?? []) {
        this.viewMap.set(view.type, view);
      }
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

    if (!this.hostEl) return;

    this.activeView = viewDef;
    this.viewContext = this.createViewContext();
    viewDef.render(this.viewContext);

    const viewDidMount = this.getOption("viewDidMount");
    if (viewDidMount && this.hostEl.firstElementChild) {
      viewDidMount({ view: this.state.view, el: this.hostEl.firstElementChild });
    }
  }

  private unmountView(): void {
    if (!this.activeView || !this.viewContext) return;

    const viewWillUnmount = this.getOption("viewWillUnmount");
    if (viewWillUnmount && this.hostEl?.firstElementChild) {
      viewWillUnmount({ view: this.state.view, el: this.hostEl.firstElementChild });
    }

    this.activeView.destroy?.(this.viewContext);

    if (this.hostEl) {
      this.hostEl.innerHTML = "";
    }

    this.activeView = null;
    this.viewContext = null;
  }

  private createViewContext(): ViewRenderContext {
    const el = this.hostEl!;
    const controlled = this.getMode() === "controlled";
    return {
      el,
      options: this.options,
      state: deepClone(this.state),
      viewOptions: deepClone(this.options.viewOptions),
      requestRender: () => this.requestRender(),
      selectTooth: controlled
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (tooth) => this.selectTooth(tooth, "replace"),
      selectSurface: controlled
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (tooth, surface) => this.selectSurface(tooth, surface, "replace"),
      toggleSurfaceSelection: controlled
        ? () => {
            /* selection is host-driven in controlled mode */
          }
        : (tooth, surface) => this.selectSurface(tooth, surface, "toggle"),
      emitToothClick: (tooth, jsEvent) => this.emitToothClick(tooth, jsEvent),
      emitSurfaceClick: (tooth, surface, jsEvent) => this.emitSurfaceClick(tooth, surface, jsEvent),
    };
  }

  private assertMutable(operation: string): void {
    if (this.getMode() === "controlled") {
      throw new OdontogramError(
        `Cannot ${operation} while mode is "controlled". Apply updates with setState() or reset() from the host.`,
        VALIDATION_CODES.ERR_CONTROLLED_MUTATION,
      );
    }
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
    if (!this.activeView || !this.viewContext || !this.hostEl) return;

    this.viewContext.state = deepClone(this.state);
    this.viewContext.options = this.options;

    if (typeof this.activeView.update === "function") {
      this.activeView.update(this.viewContext);
    } else {
      this.activeView.destroy?.(this.viewContext);
      this.hostEl.innerHTML = "";
      this.activeView.render(this.viewContext);
    }
  }

  private emitToothClick(tooth: ToothId, jsEvent: MouseEvent): void {
    this.getOption("toothClick")?.({ tooth, jsEvent });
  }

  private emitSurfaceClick(tooth: ToothId, surface: SurfaceId, jsEvent: MouseEvent): void {
    this.getOption("surfaceClick")?.({ tooth, surface, jsEvent });
  }

  private emitSelectionChange(): void {
    const selection: SelectionState = {
      teeth: [...this.state.selection.teeth],
      surfaces: [...this.state.selection.surfaces],
    };
    this.getOption("selectionDidChange")?.({ selection });
  }
}
