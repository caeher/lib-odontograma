import { createDefaultState, DEFAULT_OPTIONS } from "./defaults.js";
import { normalizeMarks } from "./marks.js";
import { validateOdontogramState } from "./validation.js";
import type {
  OdontogramOptions,
  OdontogramPlugin,
  OdontogramState,
  SelectionState,
  SurfaceId,
  ToothId,
  ValidationResult,
  ValidatorConfig,
  ViewDefinition,
  ViewRenderContext,
  ViewType,
} from "./types.js";

const IMMUTABLE_OPTIONS = new Set<keyof OdontogramOptions>(["plugins", "initialView"]);

export class Odontogram {
  private readonly el: HTMLElement;
  private options: OdontogramOptions;
  private state: OdontogramState;
  private viewMap: Map<ViewType, ViewDefinition> = new Map();
  private activeView: ViewDefinition | null = null;
  private viewContext: ViewRenderContext | null = null;
  private rendered = false;
  private batchDepth = 0;
  private renderQueued = false;
  private hostEl: HTMLElement | null = null;

  constructor(el: HTMLElement, options: OdontogramOptions = {}) {
    this.el = el;
    this.options = { ...options };
    this.state = createDefaultState(options.initialView ?? DEFAULT_OPTIONS.initialView);
    this.registerPlugins(options.plugins ?? []);
  }

  render(): void {
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
    this.options = { ...this.options, [name]: value };
    this.requestRender();
  }

  changeView(view: ViewType): void {
    if (this.state.view === view) return;
    this.state = { ...this.state, view };
    if (this.rendered) {
      this.unmountView();
      this.mountView();
    }
  }

  getState(): OdontogramState {
    return {
      view: this.state.view,
      marks: this.state.marks.map((m) => ({
        ...m,
        target: { ...m.target },
        ...(m.surfaces ? { surfaces: [...m.surfaces] } : {}),
        ...(m.metadata ? { metadata: { ...m.metadata } } : {}),
        ...(m.style ? { style: { ...m.style } } : {}),
      })),
      selection: {
        teeth: [...this.state.selection.teeth],
        surfaces: [...this.state.selection.surfaces],
      },
      teeth: { ...this.state.teeth },
    };
  }

  setState(state: OdontogramState | Partial<OdontogramState>): void {
    const nextView = state.view ?? this.state.view;
    const nextMarks = state.marks !== undefined ? normalizeMarks(state.marks) : this.state.marks;
    const nextSelection = state.selection ?? this.state.selection;
    const nextTeeth = state.teeth ?? this.state.teeth;

    const viewChanged = nextView !== this.state.view;
    this.state = {
      view: nextView,
      marks: [...nextMarks],
      selection: {
        teeth: [...nextSelection.teeth],
        surfaces: [...nextSelection.surfaces],
      },
      teeth: { ...nextTeeth },
    };

    this.getOption("marksSet")?.({ marks: this.state.marks });

    const validatorOpt = this.getOption("validator");
    const validationCallback = this.getOption("validationDidChange");
    if (validatorOpt || validationCallback) {
      const result = this.validate();
      validationCallback?.({ result });
    }

    if (viewChanged && this.rendered) {
      this.unmountView();
      this.mountView();
    } else {
      this.requestRender();
    }
  }

  /** Run validation against the current state. */
  validate(config?: ValidatorConfig): ValidationResult {
    const validatorOpt = this.getOption("validator");
    if (typeof validatorOpt === "function") {
      return validatorOpt(this.getState());
    }
    const baseConfig = typeof validatorOpt === "object" ? validatorOpt : {};
    const mergedConfig = config ? { ...baseConfig, ...config } : baseConfig;
    return validateOdontogramState(this.getState(), mergedConfig);
  }

  batchRendering(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.renderQueued) {
        this.renderQueued = false;
        this.performRender();
      }
    }
  }

  private registerPlugins(plugins: OdontogramPlugin[]): void {
    for (const plugin of plugins) {
      for (const view of plugin.pluginDef.views ?? []) {
        this.viewMap.set(view.type, view);
      }
    }
  }

  private mountView(): void {
    const viewDef = this.viewMap.get(this.state.view);
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
    return {
      el,
      options: this.options,
      state: this.state,
      requestRender: () => this.requestRender(),
      selectTooth: (tooth) => this.selectTooth(tooth),
      selectSurface: (tooth, surface) => this.selectSurface(tooth, surface),
      toggleSurfaceSelection: (tooth, surface) => this.toggleSurfaceSelection(tooth, surface),
      emitToothClick: (tooth, jsEvent) => this.emitToothClick(tooth, jsEvent),
      emitSurfaceClick: (tooth, surface, jsEvent) => this.emitSurfaceClick(tooth, surface, jsEvent),
    };
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

    this.viewContext.state = this.state;
    this.viewContext.options = this.options;
    this.activeView.destroy?.(this.viewContext);
    this.hostEl.innerHTML = "";
    this.activeView.render(this.viewContext);
  }

  private selectTooth(tooth: ToothId): void {
    if (!this.getOption("selectable")) return;

    this.state = {
      ...this.state,
      selection: { teeth: [tooth], surfaces: [] },
    };
    this.emitSelectionChange();
    this.requestRender();
  }

  private selectSurface(tooth: ToothId, surface: SurfaceId): void {
    if (!this.getOption("selectable")) return;

    this.state = {
      ...this.state,
      selection: {
        teeth: [],
        surfaces: [{ tooth, surface }],
      },
    };
    this.emitSelectionChange();
    this.requestRender();
  }

  private toggleSurfaceSelection(tooth: ToothId, surface: SurfaceId): void {
    if (!this.getOption("selectable")) return;

    const surfaces = [...this.state.selection.surfaces];
    const idx = surfaces.findIndex((s) => s.tooth === tooth && s.surface === surface);
    if (idx >= 0) {
      surfaces.splice(idx, 1);
    } else {
      surfaces.push({ tooth, surface });
    }

    this.state = {
      ...this.state,
      selection: { teeth: [], surfaces },
    };
    this.emitSelectionChange();
    this.requestRender();
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
