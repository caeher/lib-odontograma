import type {
  OdontographicMark,
  SurfaceId,
  ToothId,
  ToothPresence,
  ViewOptions,
  ViewRenderContext,
  MultiToothTargetEntry,
} from "@odontogram/core";
import {
  getMarkTargetSurfaces,
  getMarkTargetTeeth,
  getMarksForSurface,
  getMarksForTooth,
  getToothPresence,
  isMultiToothMark,
  isWholeToothMark,
} from "@odontogram/core";
import {
  getApplicableSurfaces,
  getArch,
  getQuadrant,
  getTooth,
  getTeethForView,
  mapSurfaceToFace,
  toAccessibleNotation,
  toNotation,
  type GraphicFace,
  type Notation,
} from "@odontogram/dentition";
import {
  REQUIRED_ANCHOR_IDS,
  SVG_CONTRACT_VERSION,
  parseSvgMarkup,
  prefixElementIds,
  validateToothSvg,
} from "./contract/index.js";

export const TOOTH_WIDTH = 44;
export const TOOTH_HEIGHT = 52;
export const TOOTH_GAP = 4;
export const ARCH_GAP = 60;
export const SURFACE_INSET = 6;

let globalInstanceSeq = 0;

export interface ToothLayout {
  tooth: ToothId;
  x: number;
  y: number;
  width?: number;
  height?: number;
  quadrant: number;
  arch: "upper" | "lower";
  label: string;
  isDetail?: boolean;
}

/**
 * Returns teeth in standard anatomical dental order for a single arch.
 */
export function getArchTeeth(view: string, layoutArch: "upper" | "lower"): ToothId[] {
  const normView = view === "primary" ? "deciduous" : view;
  const all = getTeethForView(normView as "permanent" | "deciduous" | "mixed");
  const filtered = all.filter((t) => getArch(t) === layoutArch);

  if (layoutArch === "upper") {
    const right = filtered
      .filter((t) => {
        const q = parseInt(t.charAt(0), 10);
        return q === 1 || q === 5;
      })
      .reverse();
    const left = filtered.filter((t) => {
      const q = parseInt(t.charAt(0), 10);
      return q === 2 || q === 6;
    });
    return [...right, ...left];
  }

  const right = filtered.filter((t) => {
    const q = parseInt(t.charAt(0), 10);
    return q === 4 || q === 8;
  });
  const left = filtered
    .filter((t) => {
      const q = parseInt(t.charAt(0), 10);
      return q === 3 || q === 7;
    })
    .reverse();
  return [...right, ...left];
}

/**
 * Layouts an array of teeth horizontally with center alignment.
 */
export function layoutArch(
  teeth: ToothId[],
  y: number,
  notation: Notation,
  arch: "upper" | "lower",
  customStartX?: number,
): ToothLayout[] {
  const totalWidth = teeth.length * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
  const startX = customStartX !== undefined ? customStartX : -totalWidth / 2;

  return teeth.map((tooth, i) => ({
    tooth,
    x: startX + i * (TOOTH_WIDTH + TOOTH_GAP),
    y,
    quadrant: getQuadrant(tooth),
    arch,
    label: toNotation(tooth, notation),
  }));
}

/**
 * Computes explicit 4-row mixed dentition layout with anatomical successor alignment and zero overlaps.
 */
export function computeMixedLayout(notation: Notation): ToothLayout[] {
  const totalWidth = 16 * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
  const startX = -totalWidth / 2;
  const step = TOOTH_WIDTH + TOOTH_GAP;

  const result: ToothLayout[] = [];

  // Row 1: Maxillary Permanent (y = 0)
  const q1Teeth = ["18", "17", "16", "15", "14", "13", "12", "11"];
  const q2Teeth = ["21", "22", "23", "24", "25", "26", "27", "28"];
  q1Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + i * step,
      y: 0,
      quadrant: 1,
      arch: "upper",
      label: toNotation(tooth, notation),
    });
  });
  q2Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + (8 + i) * step,
      y: 0,
      quadrant: 2,
      arch: "upper",
      label: toNotation(tooth, notation),
    });
  });

  // Row 2: Maxillary Primary (y = TOOTH_HEIGHT + 14)
  // Aligned directly under successors (15..11 and 21..25)
  const row2Y = TOOTH_HEIGHT + 14;
  const q5Teeth = ["55", "54", "53", "52", "51"]; // columns 3..7
  const q6Teeth = ["61", "62", "63", "64", "65"]; // columns 8..12
  q5Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + (3 + i) * step,
      y: row2Y,
      quadrant: 5,
      arch: "upper",
      label: toNotation(tooth, notation),
    });
  });
  q6Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + (8 + i) * step,
      y: row2Y,
      quadrant: 6,
      arch: "upper",
      label: toNotation(tooth, notation),
    });
  });

  // Row 3: Mandibular Primary (y = row2Y + TOOTH_HEIGHT + ARCH_GAP)
  // Aligned directly above successors (45..41 and 31..35)
  const row3Y = row2Y + TOOTH_HEIGHT + ARCH_GAP;
  const q8Teeth = ["85", "84", "83", "82", "81"]; // columns 3..7
  const q7Teeth = ["71", "72", "73", "74", "75"]; // columns 8..12
  q8Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + (3 + i) * step,
      y: row3Y,
      quadrant: 8,
      arch: "lower",
      label: toNotation(tooth, notation),
    });
  });
  q7Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + (8 + i) * step,
      y: row3Y,
      quadrant: 7,
      arch: "lower",
      label: toNotation(tooth, notation),
    });
  });

  // Row 4: Mandibular Permanent (y = row3Y + TOOTH_HEIGHT + 14)
  const row4Y = row3Y + TOOTH_HEIGHT + 14;
  const q4Teeth = ["48", "47", "46", "45", "44", "43", "42", "41"];
  const q3Teeth = ["31", "32", "33", "34", "35", "36", "37", "38"];
  q4Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + i * step,
      y: row4Y,
      quadrant: 4,
      arch: "lower",
      label: toNotation(tooth, notation),
    });
  });
  q3Teeth.forEach((tooth, i) => {
    result.push({
      tooth,
      x: startX + (8 + i) * step,
      y: row4Y,
      quadrant: 3,
      arch: "lower",
      label: toNotation(tooth, notation),
    });
  });

  return result;
}

/**
 * Computes layout for all supported views (full, arch, quadrant, tooth detail).
 */
export function computeViewLayout(
  view: string,
  viewOptions: ViewOptions = {},
  notation: Notation = "fdi",
): ToothLayout[] {
  // 1. Single tooth detail view
  if (view === "tooth" || view === "tooth-detail" || view.startsWith("tooth-")) {
    const targetTooth =
      (view.startsWith("tooth-") ? view.slice("tooth-".length) : undefined) ??
      viewOptions.tooth ??
      "16";
    const q = getQuadrant(targetTooth);
    const arch = getArch(targetTooth);
    const detailWidth = 120;
    const detailHeight = 140;
    return [
      {
        tooth: targetTooth,
        x: -detailWidth / 2,
        y: 10,
        width: detailWidth,
        height: detailHeight,
        quadrant: q,
        arch,
        label: toNotation(targetTooth, notation),
        isDetail: true,
      },
    ];
  }

  // 2. Quadrant views
  if (view === "quadrant" || view.startsWith("quadrant-")) {
    const qNum =
      (view.startsWith("quadrant-") ? parseInt(view.slice("quadrant-".length), 10) : undefined) ??
      viewOptions.quadrant ??
      1;

    const teethMap: Record<number, ToothId[]> = {
      1: ["18", "17", "16", "15", "14", "13", "12", "11"],
      2: ["21", "22", "23", "24", "25", "26", "27", "28"],
      3: ["31", "32", "33", "34", "35", "36", "37", "38"],
      4: ["48", "47", "46", "45", "44", "43", "42", "41"],
      5: ["55", "54", "53", "52", "51"],
      6: ["61", "62", "63", "64", "65"],
      7: ["71", "72", "73", "74", "75"],
      8: ["85", "84", "83", "82", "81"],
    };

    const teeth = teethMap[qNum] ?? teethMap[1] ?? [];
    const arch = qNum === 1 || qNum === 2 || qNum === 5 || qNum === 6 ? "upper" : "lower";
    const totalWidth = teeth.length * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
    const startX = -totalWidth / 2;

    return teeth.map((tooth, i) => ({
      tooth,
      x: startX + i * (TOOTH_WIDTH + TOOTH_GAP),
      y: 10,
      quadrant: qNum,
      arch,
      label: toNotation(tooth, notation),
    }));
  }

  // 3. Arch views
  if (
    view === "arch" ||
    view === "upper" ||
    view === "lower" ||
    view === "maxillary" ||
    view === "mandibular"
  ) {
    const targetArch: "upper" | "lower" =
      (view === "lower" || view === "mandibular"
        ? "lower"
        : view === "upper" || view === "maxillary"
          ? "upper"
          : undefined) ??
      (viewOptions.arch === "lower" || viewOptions.arch === "mandibular" ? "lower" : "upper");

    const dentition = viewOptions.dentition ?? "permanent";
    if (dentition === "mixed") {
      const allMixed = computeMixedLayout(notation);
      const filtered = allMixed.filter((l) => l.arch === targetArch);
      const minY = Math.min(...filtered.map((l) => l.y));
      return filtered.map((l) => ({ ...l, y: l.y - minY + 10 }));
    }
    const teeth = getArchTeeth(dentition, targetArch);
    return layoutArch(teeth, 10, notation, targetArch);
  }

  // 4. Mixed full view
  if (view === "mixed") {
    return computeMixedLayout(notation);
  }

  // 5. Deciduous / Primary full view
  if (view === "deciduous" || view === "primary") {
    const upperTeeth = getArchTeeth("deciduous", "upper");
    const lowerTeeth = getArchTeeth("deciduous", "lower");
    const upperLayout = layoutArch(upperTeeth, 0, notation, "upper");
    const lowerLayout = layoutArch(lowerTeeth, TOOTH_HEIGHT + ARCH_GAP, notation, "lower");
    return [...upperLayout, ...lowerLayout];
  }

  // 6. Default: Permanent full view
  const upperTeeth = getArchTeeth("permanent", "upper");
  const lowerTeeth = getArchTeeth("permanent", "lower");
  const upperLayout = layoutArch(upperTeeth, 0, notation, "upper");
  const lowerLayout = layoutArch(lowerTeeth, TOOTH_HEIGHT + ARCH_GAP, notation, "lower");
  return [...upperLayout, ...lowerLayout];
}

export function createFacePath(
  face: GraphicFace,
  x: number,
  y: number,
  w = TOOTH_WIDTH,
  h = TOOTH_HEIGHT,
  inset = SURFACE_INSET,
): string {
  switch (face) {
    case "center":
      return `M ${x + inset} ${y + inset} L ${x + w - inset} ${y + inset} L ${x + w - inset} ${y + h - inset} L ${x + inset} ${y + h - inset} Z`;
    case "left":
      return `M ${x} ${y + inset} L ${x + inset} ${y + inset} L ${x + inset} ${y + h - inset} L ${x} ${y + h - inset} Z`;
    case "right":
      return `M ${x + w - inset} ${y + inset} L ${x + w} ${y + inset} L ${x + w} ${y + h - inset} L ${x + w - inset} ${y + h - inset} Z`;
    case "top":
      return `M ${x + inset} ${y} L ${x + w - inset} ${y} L ${x + w - inset} ${y + inset} L ${x + inset} ${y + inset} Z`;
    case "bottom":
      return `M ${x + inset} ${y + h - inset} L ${x + w - inset} ${y + h - inset} L ${x + w - inset} ${y + h} L ${x + inset} ${y + h} Z`;
    default: {
      const _exhaustive: never = face;
      return _exhaustive;
    }
  }
}

function normalizeClassNames(input: string | string[] | undefined): string {
  if (!input) return "";
  return Array.isArray(input) ? input.join(" ") : input;
}

/** Resolve fill color for a mark considering styles, type colors, and status colors */
export function resolveMarkFill(
  mark: OdontographicMark,
  markColors: Record<string, string>,
  statusColors: Record<string, string>,
  fallback = "#ef5350",
): string {
  if (mark.style?.fill) return mark.style.fill;
  const byType = markColors[mark.type];
  if (byType) return byType;
  const byStatus = mark.status ? statusColors[mark.status] : undefined;
  if (byStatus) return byStatus;
  return fallback;
}

/**
 * State and element registry for a mounted incremental SVG view.
 */
export class IncrementalSvgRenderer {
  readonly instanceId: string;
  private rootSvg: SVGSVGElement | null = null;
  private annotationsLayer: SVGGElement | null = null;
  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private activeView: string = "";
  private layoutMap: Map<ToothId, ToothLayout> = new Map();
  private toothElements: Map<ToothId, SVGGElement> = new Map();
  private surfaceElements: Map<string, SVGGElement> = new Map(); // key: toothId:surface
  private missingIndicators: Map<ToothId, SVGGElement> = new Map();
  private resourceOutlines: Map<ToothId, SVGElement> = new Map();
  private multiToothMarks: Map<string, SVGGElement> = new Map(); // key: mark.id

  // Cached state for fine-grained diffing
  private renderedMarks: Map<string, OdontographicMark> = new Map();
  private renderedPresence: Map<ToothId, ToothPresence> = new Map();
  private renderedSelectedTeeth: Set<ToothId> = new Set();
  private renderedSelectedSurfaces: Set<string> = new Set(); // key: toothId:surface
  private renderedNotation: Notation = "fdi";
  private latestContext: ViewRenderContext | null = null;
  private hookCleanups = new Map<string, () => void>();
  private renderedResourceSignature = "";

  constructor(instancePrefix?: string) {
    if (instancePrefix && instancePrefix.trim() !== "") {
      this.instanceId = instancePrefix.endsWith("-")
        ? instancePrefix.trim()
        : `${instancePrefix.trim()}-`;
    } else {
      this.instanceId = `od-inst-${++globalInstanceSeq}-`;
    }
  }

  render(ctx: ViewRenderContext): void {
    this.destroy(ctx);

    const win = ctx.el?.ownerDocument?.defaultView;
    const AC = win?.AbortController || globalThis.AbortController;
    this.abortController = AC ? new AC() : null;

    const { el, options, state, viewOptions } = ctx;
    const notation = (options.notation ?? "fdi") as Notation;
    const view = state.view;
    this.latestContext = ctx;
    const effectiveViewOptions = { ...(options.viewOptions ?? {}), ...(viewOptions ?? {}) };
    this.renderedResourceSignature = JSON.stringify([
      options.toothResources ?? {},
      options.toothResourceFallback ?? "schematic",
    ]);
    this.activeView = view;
    this.renderedNotation = notation;

    const allLayout = computeViewLayout(view, effectiveViewOptions, notation);

    this.layoutMap.clear();
    for (const item of allLayout) {
      this.layoutMap.set(item.tooth, item);
    }

    // Filter visible teeth if specified
    const visibleFilter = options.visibleTeeth ?? effectiveViewOptions.visibleTeeth;
    const visibleSet =
      visibleFilter && Array.isArray(visibleFilter) ? new Set(visibleFilter) : null;
    const renderedLayout = visibleSet
      ? allLayout.filter((item) => visibleSet.has(item.tooth))
      : allLayout;

    // Calculate bounding box across layout
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    if (allLayout.length > 0) {
      minX = Math.min(...allLayout.map((l) => l.x));
      maxX = Math.max(...allLayout.map((l) => l.x + (l.width ?? TOOTH_WIDTH)));
      minY = Math.min(...allLayout.map((l) => l.y));
      maxY = Math.max(...allLayout.map((l) => l.y + (l.height ?? TOOTH_HEIGHT)));
    }

    const isDetailView = allLayout.length === 1 && Boolean(allLayout[0]?.isDetail);
    const showOrientationLabels =
      options.showOrientationLabels ?? effectiveViewOptions.showOrientationLabels ?? true;
    const showMidline = options.showMidline ?? effectiveViewOptions.showMidline ?? true;

    const padX = isDetailView ? 30 : 20;
    const padTop = showOrientationLabels || showMidline ? 35 : 15;
    const padBottom = 30;

    const totalW = Math.max(maxX - minX + padX * 2, 200);
    const totalH = Math.max(maxY - minY + padTop + padBottom, 120);
    const viewBoxX = minX - padX;
    const viewBoxY = minY - padTop;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "odontogram-svg");
    svg.setAttribute("id", `${this.instanceId}root`);
    svg.setAttribute("data-instance-id", this.instanceId);
    svg.setAttribute("data-view", view);
    svg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${totalW} ${totalH}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Dental Chart Odontogram");
    svg.style.display = "block";
    this.rootSvg = svg;

    // 1. Isolated Defs
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.setAttribute("id", `${this.instanceId}defs`);
    this.buildIsolatedDefs(defs);
    svg.appendChild(defs);

    // 2. Orientation & Midline Layers
    const orientationLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    orientationLayer.setAttribute("class", "odontogram-layer-orientation");
    orientationLayer.setAttribute("id", `${this.instanceId}layer-orientation`);
    this.buildOrientationLabels(
      orientationLayer,
      view,
      effectiveViewOptions,
      allLayout,
      minX,
      maxX,
      minY,
      showOrientationLabels,
    );
    svg.appendChild(orientationLayer);

    const midlineLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    midlineLayer.setAttribute("class", "odontogram-layer-midline");
    midlineLayer.setAttribute("id", `${this.instanceId}layer-midline`);
    if (showMidline && minX < -10 && maxX > 10 && !isDetailView) {
      this.buildMidline(midlineLayer, minY, maxY);
    }
    svg.appendChild(midlineLayer);

    // 3. Multi-tooth Annotation Layer (bridges, archwires, splints)
    const annotationsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    annotationsLayer.setAttribute("class", "odontogram-layer-annotations");
    annotationsLayer.setAttribute("id", `${this.instanceId}layer-annotations`);
    annotationsLayer.setAttribute("data-layer", "annotations");
    svg.appendChild(annotationsLayer);
    this.annotationsLayer = annotationsLayer;

    // 4. Arches and Quadrants
    const upperArchGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    upperArchGroup.setAttribute("class", "odontogram-arch odontogram-arch-upper");
    upperArchGroup.setAttribute("id", `${this.instanceId}arch-upper`);
    upperArchGroup.setAttribute("data-arch", "upper");

    const lowerArchGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    lowerArchGroup.setAttribute("class", "odontogram-arch odontogram-arch-lower");
    lowerArchGroup.setAttribute("id", `${this.instanceId}arch-lower`);
    lowerArchGroup.setAttribute("data-arch", "lower");

    const quadrantGroups: Map<number, SVGGElement> = new Map();
    const getOrCreateQuadrant = (q: number, parentArch: SVGGElement): SVGGElement => {
      let qg = quadrantGroups.get(q);
      if (!qg) {
        qg = document.createElementNS("http://www.w3.org/2000/svg", "g");
        qg.setAttribute("class", `odontogram-quadrant odontogram-quadrant-${q}`);
        qg.setAttribute("id", `${this.instanceId}quadrant-${q}`);
        qg.setAttribute("data-quadrant", String(q));
        parentArch.appendChild(qg);
        quadrantGroups.set(q, qg);
      }
      return qg;
    };

    // Render teeth into respective quadrants
    for (const layout of renderedLayout) {
      const parentArch = layout.arch === "upper" ? upperArchGroup : lowerArchGroup;
      const qGroup = getOrCreateQuadrant(layout.quadrant, parentArch);
      const toothGroup = this.createToothElement(ctx, layout);
      qGroup.appendChild(toothGroup);
      this.toothElements.set(layout.tooth, toothGroup);
    }

    if (upperArchGroup.children.length > 0) {
      svg.appendChild(upperArchGroup);
    }
    if (lowerArchGroup.children.length > 0) {
      svg.appendChild(lowerArchGroup);
    }
    // Keep connected overlays above teeth so their annotation unit remains pointer-selectable.
    svg.appendChild(annotationsLayer);

    // Initial state caches & mark overlays
    this.syncSelectionCaches(ctx);
    this.syncPresenceCaches(ctx);
    this.syncMarks(ctx, true);

    // Mount to container
    el.appendChild(svg);

    // Setup optional ResizeObserver
    const RO = el.ownerDocument.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
    if (typeof RO !== "undefined") {
      try {
        this.resizeObserver = new RO(() => {
          if (this.latestContext) this.syncMarks(this.latestContext);
        });
        this.resizeObserver.observe(el);
      } catch {
        // Safe fallback in unsupported environments
      }
    }
  }

  update(ctx: ViewRenderContext): void {
    this.latestContext = ctx;
    if (!this.rootSvg || this.activeView !== ctx.state.view) {
      this.render(ctx);
      return;
    }

    const { options, state } = ctx;
    const resourceSignature = JSON.stringify([
      options.toothResources ?? {},
      options.toothResourceFallback ?? "schematic",
    ]);
    if (resourceSignature !== this.renderedResourceSignature) {
      this.render(ctx);
      return;
    }
    this.syncCustomContents(ctx);
    for (const tooth of this.toothElements.keys()) {
      this.updateToothSelection(ctx, tooth, state.selection.teeth.includes(tooth));
    }
    for (const [key, surfaceEl] of this.surfaceElements) {
      const [tooth, surface] = key.split(":") as [ToothId, SurfaceId];
      const selected =
        state.selection.teeth.includes(tooth) ||
        state.selection.surfaces.some((item) => item.tooth === tooth && item.surface === surface);
      this.updateSurfaceVisuals(ctx, tooth, surface, surfaceEl, selected);
    }
    const notation = (options.notation ?? "fdi") as Notation;

    // 1. Notation update
    if (notation !== this.renderedNotation) {
      this.renderedNotation = notation;
      for (const [toothId, layout] of this.layoutMap.entries()) {
        const nextLabel = toNotation(toothId, notation);
        const nextAccessible = toAccessibleNotation(toothId, notation);
        layout.label = nextLabel;
        const toothGroup = this.toothElements.get(toothId);
        if (toothGroup) {
          toothGroup.setAttribute("data-notation-label", nextLabel);
          toothGroup.setAttribute("aria-label", nextAccessible);
          const labelEl = toothGroup.querySelector<SVGTextElement>(`[data-role="label"]`);
          if (labelEl) {
            labelEl.textContent = nextLabel;
          }
        }
      }
    }
    for (const [toothId, layout] of this.layoutMap) {
      this.syncToothLabel(ctx, toothId, layout.label);
    }

    // 2. Presence diffing
    for (const [toothId] of this.layoutMap.entries()) {
      const prevPresence = this.renderedPresence.get(toothId) ?? "present";
      const currPresence = getToothPresence(state.teeth, toothId);
      if (prevPresence !== currPresence) {
        this.updateToothPresence(ctx, toothId, currPresence);
        this.renderedPresence.set(toothId, currPresence);
      }
    }

    // 3. Selection diffing
    const nextSelectedTeeth = new Set(state.selection.teeth);
    const nextSelectedSurfaces = new Set(
      state.selection.surfaces.map((s) => `${s.tooth}:${s.surface}`),
    );

    // Teeth selection changes
    for (const [toothId] of this.layoutMap.entries()) {
      const wasSelected = this.renderedSelectedTeeth.has(toothId);
      const isSelected = nextSelectedTeeth.has(toothId);
      if (wasSelected !== isSelected) {
        this.updateToothSelection(ctx, toothId, isSelected);
      }
    }

    // Surfaces selection changes
    for (const [key, surfaceGroup] of this.surfaceElements.entries()) {
      const [toothId, surfaceId] = key.split(":") as [ToothId, SurfaceId];
      const wasSelected = this.renderedSelectedSurfaces.has(key);
      const isSelected = nextSelectedSurfaces.has(key) || nextSelectedTeeth.has(toothId);
      if (wasSelected !== isSelected) {
        this.updateSurfaceVisuals(ctx, toothId, surfaceId, surfaceGroup, isSelected);
      }
    }

    this.renderedSelectedTeeth = nextSelectedTeeth;
    this.renderedSelectedSurfaces = nextSelectedSurfaces;

    // 4. Marks diffing
    this.syncMarks(ctx, false);
  }

  destroy(ctx: ViewRenderContext): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // ignore
      }
      this.abortController = null;
    }

    // Call toothWillUnmount for mounted teeth
    for (const [tooth, toothEl] of this.toothElements.entries()) {
      ctx.options.toothWillUnmount?.({ tooth, el: toothEl });
    }
    for (const cleanup of this.hookCleanups.values()) cleanup();
    this.hookCleanups.clear();

    // Call markWillUnmount for active marks
    for (const mark of this.renderedMarks.values()) {
      if (isMultiToothMark(mark)) {
        const annotationEl = this.multiToothMarks.get(mark.id);
        if (annotationEl) ctx.options.markWillUnmount?.({ mark, el: annotationEl });
        continue;
      }
      const targetTeeth = getMarkTargetTeeth(mark);
      for (const tooth of targetTeeth) {
        const surfaces = getMarkTargetSurfaces(mark, tooth);
        if (surfaces.length > 0) {
          for (const surface of surfaces) {
            const surfEl = this.surfaceElements.get(`${tooth}:${surface}`);
            if (surfEl) {
              ctx.options.annotationWillUnmount?.({
                mark,
                isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
                view: ctx.state.view,
                el: surfEl,
              });
              ctx.options.markWillUnmount?.({ mark, el: surfEl });
            }
          }
        } else {
          const toothEl = this.toothElements.get(tooth);
          if (toothEl) {
            ctx.options.annotationWillUnmount?.({
              mark,
              isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
              view: ctx.state.view,
              el: toothEl,
            });
            ctx.options.markWillUnmount?.({ mark, el: toothEl });
          }
        }
      }
    }
    for (const [tooth, surfaceEl] of this.surfaceElements) {
      const [toothId, surface] = tooth.split(":") as [ToothId, SurfaceId];
      ctx.options.surfaceWillUnmount?.({
        tooth: toothId,
        surface,
        isSelected: false,
        presence: getToothPresence(ctx.state.teeth, toothId),
        view: ctx.state.view,
        el: surfaceEl,
      });
    }
    for (const [id, annotationEl] of this.multiToothMarks) {
      const mark = this.renderedMarks.get(id);
      if (mark)
        ctx.options.annotationWillUnmount?.({
          mark,
          isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
          view: ctx.state.view,
          el: annotationEl,
        });
    }

    if (this.rootSvg && this.rootSvg.parentElement) {
      this.rootSvg.remove();
    }

    this.rootSvg = null;
    this.annotationsLayer = null;
    this.toothElements.clear();
    this.surfaceElements.clear();
    this.missingIndicators.clear();
    this.resourceOutlines.clear();
    this.multiToothMarks.clear();
    this.renderedMarks.clear();
    this.renderedPresence.clear();
    this.renderedSelectedTeeth.clear();
    this.renderedSelectedSurfaces.clear();
    this.layoutMap.clear();
    this.latestContext = null;
  }

  // ==========================================================================
  // Private DOM Construction & Diff Helpers
  // ==========================================================================

  private buildIsolatedDefs(defs: SVGDefsElement): void {
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", `${this.instanceId}pattern-hatch`);
    pattern.setAttribute("width", "6");
    pattern.setAttribute("height", "6");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("patternTransform", "rotate(45)");

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "0");
    line.setAttribute("y2", "6");
    line.setAttribute("stroke", "#ff5722");
    line.setAttribute("stroke-width", "1.5");
    pattern.appendChild(line);
    defs.appendChild(pattern);
  }

  private buildOrientationLabels(
    group: SVGGElement,
    view: string,
    viewOptions: ViewOptions,
    layout: ToothLayout[],
    minX: number,
    maxX: number,
    minY: number,
    showOrientationLabels: boolean,
  ): void {
    if (!showOrientationLabels) return;

    const labelY = minY - 12;
    const firstLayout = layout[0];
    if (layout.length === 1 && firstLayout?.isDetail) {
      const tooth = firstLayout.tooth;
      const notation = toNotation(tooth, this.renderedNotation);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "odontogram-orientation-label");
      text.setAttribute("x", "0");
      text.setAttribute("y", String(labelY));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "12");
      text.setAttribute("font-weight", "600");
      text.setAttribute("fill", "#555");
      text.textContent = `Tooth ${notation} (${toAccessibleNotation(tooth, this.renderedNotation)})`;
      group.appendChild(text);
      return;
    }

    if (view === "quadrant" || view.startsWith("quadrant-")) {
      const qNum =
        (view.startsWith("quadrant-") ? parseInt(view.slice("quadrant-".length), 10) : undefined) ??
        viewOptions.quadrant ??
        1;
      const isRight = qNum === 1 || qNum === 4 || qNum === 5 || qNum === 8;
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "odontogram-orientation-label");
      text.setAttribute("x", isRight ? String(minX + 8) : String(maxX - 8));
      text.setAttribute("y", String(labelY));
      text.setAttribute("text-anchor", isRight ? "start" : "end");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-weight", "600");
      text.setAttribute("fill", "#757575");
      text.textContent = isRight
        ? `Patient Right · Quadrant ${qNum}`
        : `Patient Left · Quadrant ${qNum}`;
      group.appendChild(text);
      return;
    }

    // Standard arch / full views: Patient Right on screen left, Patient Left on screen right
    const rightText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    rightText.setAttribute("class", "odontogram-orientation-label odontogram-orientation-right");
    rightText.setAttribute("x", String(minX + 8));
    rightText.setAttribute("y", String(labelY));
    rightText.setAttribute("text-anchor", "start");
    rightText.setAttribute("font-size", "11");
    rightText.setAttribute("font-weight", "600");
    rightText.setAttribute("fill", "#757575");
    rightText.textContent = "R (Patient Right)";
    group.appendChild(rightText);

    const leftText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    leftText.setAttribute("class", "odontogram-orientation-label odontogram-orientation-left");
    leftText.setAttribute("x", String(maxX - 8));
    leftText.setAttribute("y", String(labelY));
    leftText.setAttribute("text-anchor", "end");
    leftText.setAttribute("font-size", "11");
    leftText.setAttribute("font-weight", "600");
    leftText.setAttribute("fill", "#757575");
    leftText.textContent = "L (Patient Left)";
    group.appendChild(leftText);
  }

  private buildMidline(group: SVGGElement, minY: number, maxY: number): void {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "odontogram-midline-line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", String(minY - 6));
    line.setAttribute("x2", "0");
    line.setAttribute("y2", String(maxY + 20));
    line.setAttribute("stroke", "#bdbdbd");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-dasharray", "4 4");
    group.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "odontogram-midline-label");
    label.setAttribute("x", "0");
    label.setAttribute("y", String(minY - 12));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "#9e9e9e");
    label.textContent = "Midline";
    group.appendChild(label);
  }

  private createToothElement(ctx: ViewRenderContext, layout: ToothLayout): SVGGElement {
    const { tooth, x, y, label, quadrant, arch, isDetail } = layout;
    const width = layout.width ?? TOOTH_WIDTH;
    const height = layout.height ?? TOOTH_HEIGHT;
    const { options, state } = ctx;
    const notation = (options.notation ?? "fdi") as Notation;
    const presence = getToothPresence(state.teeth, tooth);
    const accessibleLabel = toAccessibleNotation(tooth, notation);
    const isToothSelected = state.selection.teeth.includes(tooth);

    const toothGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    toothGroup.setAttribute("class", "odontogram-tooth");
    toothGroup.setAttribute("id", `${this.instanceId}tooth-${tooth}`);
    toothGroup.setAttribute("data-tooth", tooth);
    toothGroup.setAttribute("data-quadrant", String(quadrant));
    toothGroup.setAttribute("data-arch", arch);
    toothGroup.setAttribute("data-presence", presence);
    toothGroup.setAttribute("data-notation-label", label);
    toothGroup.setAttribute("aria-label", accessibleLabel);
    toothGroup.setAttribute("role", "group");
    toothGroup.setAttribute("tabindex", "0");
    toothGroup.setAttribute("aria-selected", String(isToothSelected));

    const toothClassNames = normalizeClassNames(
      options.toothClassNames?.({ tooth, isSelected: isToothSelected }),
    );
    if (toothClassNames) {
      toothGroup.setAttribute("class", `odontogram-tooth ${toothClassNames}`);
    }

    // 1. #layer-anatomy: Tooth background & missing indicators
    const anatomyLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    anatomyLayer.setAttribute("class", "odontogram-layer-anatomy");
    anatomyLayer.setAttribute("id", `${this.instanceId}tooth-${tooth}-layer-anatomy`);

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("class", "odontogram-tooth-outline");
    bg.setAttribute("id", `${this.instanceId}tooth-${tooth}-outline`);
    bg.setAttribute("x", String(x));
    bg.setAttribute("y", String(y));
    bg.setAttribute("width", String(width));
    bg.setAttribute("height", String(height));
    bg.setAttribute("rx", isDetail ? "8" : "4");
    bg.setAttribute(
      "fill",
      isToothSelected ? (options.selectionColor ?? "#90caf9") : (options.toothColor ?? "#f5f5f5"),
    );
    bg.setAttribute("stroke", "#999");
    bg.setAttribute("stroke-width", isDetail ? "1.5" : "1");
    bg.style.cursor = "pointer";
    this.applyPresenceStyle(bg, presence);

    const signal = this.abortController?.signal;
    const listenerOptions = signal ? { signal } : undefined;

    bg.addEventListener(
      "click",
      (e) => {
        const mode = e.shiftKey || e.ctrlKey || e.metaKey
          ? (e.ctrlKey || e.metaKey ? "toggle" : "add")
          : (ctx.state.selection.teeth.includes(tooth) ? "toggle" : "replace");
        ctx.selectTooth(tooth, mode);
        ctx.emitToothClick(tooth, e);
      },
      listenerOptions,
    );
    toothGroup.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const mode = e.shiftKey ? "add" : (ctx.state.selection.teeth.includes(tooth) ? "toggle" : "replace");
      ctx.selectTooth(tooth, mode);
      ctx.emitToothClick(tooth, e);
    }, listenerOptions);

    anatomyLayer.appendChild(bg);

    // Stable points in the tooth SVG coordinate space used by annotation geometry.
    const center = { x: x + width / 2, y: y + height / 2 };
    const mesialTowardRight = [1, 4, 5, 8].includes(quadrant);
    const anchorPoints = {
      "anchor-center": center,
      "anchor-mesial": {
        x: x + width * (mesialTowardRight ? 0.72 : 0.28),
        y: center.y,
      },
      "anchor-distal": {
        x: x + width * (mesialTowardRight ? 0.28 : 0.72),
        y: center.y,
      },
    } as const;
    for (const anchor of REQUIRED_ANCHOR_IDS) {
      const point = anchorPoints[anchor];
      const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      marker.setAttribute("id", `${this.instanceId}tooth-${tooth}-${anchor}`);
      marker.setAttribute("data-contract-anchor", anchor);
      marker.setAttribute("cx", String(point.x));
      marker.setAttribute("cy", String(point.y));
      marker.setAttribute("r", "0");
      marker.setAttribute("aria-hidden", "true");
      marker.style.pointerEvents = "none";
      anatomyLayer.appendChild(marker);
    }

    // Missing indicator lines container
    const missingGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    missingGroup.setAttribute("class", "odontogram-missing-indicator");
    missingGroup.setAttribute("id", `${this.instanceId}tooth-${tooth}-missing-indicator`);
    missingGroup.style.display = presence === "missing" ? "block" : "none";
    this.buildMissingLines(missingGroup, x, y, width, height);
    anatomyLayer.appendChild(missingGroup);
    this.missingIndicators.set(tooth, missingGroup);

    toothGroup.appendChild(anatomyLayer);

    // 2. #layer-interaction: Interactive clinical surfaces
    const interactionLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    interactionLayer.setAttribute("class", "odontogram-layer-interaction");
    interactionLayer.setAttribute("id", `${this.instanceId}tooth-${tooth}-layer-interaction`);

    if (presence !== "missing") {
      this.buildSurfaceElements(ctx, tooth, interactionLayer, layout);
    }

    toothGroup.appendChild(interactionLayer);

    // 3. #layer-focus: Focus ring
    const focusLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    focusLayer.setAttribute("class", "odontogram-layer-focus");
    focusLayer.setAttribute("id", `${this.instanceId}tooth-${tooth}-layer-focus`);
    const focusRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    focusRect.setAttribute("class", "odontogram-focus-ring");
    focusRect.setAttribute("id", `${this.instanceId}tooth-${tooth}-focus-ring`);
    focusRect.setAttribute("x", String(x - 2));
    focusRect.setAttribute("y", String(y - 2));
    focusRect.setAttribute("width", String(width + 4));
    focusRect.setAttribute("height", String(height + 4));
    focusRect.setAttribute("rx", isDetail ? "10" : "6");
    focusRect.setAttribute("fill", "none");
    focusRect.setAttribute("stroke", "#1976d2");
    focusRect.setAttribute("stroke-width", "2");
    focusRect.setAttribute("stroke-dasharray", "3 2");
    focusRect.style.display = "none";
    focusLayer.appendChild(focusRect);
    toothGroup.appendChild(focusLayer);

    // 4. #layer-marks: Whole-tooth marks / symbols
    const marksLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    marksLayer.setAttribute("class", "odontogram-layer-marks");
    marksLayer.setAttribute("id", `${this.instanceId}tooth-${tooth}-layer-marks`);
    toothGroup.appendChild(marksLayer);

    // 5. #layer-labels: Notation labels
    const labelsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelsLayer.setAttribute("class", "odontogram-layer-labels");
    labelsLayer.setAttribute("id", `${this.instanceId}tooth-${tooth}-layer-labels`);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const labelContext = {
      tooth,
      label,
      accessibleLabel,
      isSelected: isToothSelected,
      presence,
      view: state.view,
    };
    const labelClasses = normalizeClassNames(options.toothLabelClassNames?.(labelContext));
    text.setAttribute("class", ["odontogram-tooth-label", labelClasses].filter(Boolean).join(" "));
    text.setAttribute("id", `${this.instanceId}tooth-${tooth}-label`);
    text.setAttribute("data-role", "label");
    text.setAttribute("x", String(x + width / 2));
    text.setAttribute("y", String(y + height + (isDetail ? 18 : 14)));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", isDetail ? "14" : "10");
    text.setAttribute("font-weight", isDetail ? "bold" : "normal");
    text.setAttribute("fill", "#333");
    text.textContent = options.toothLabelContent?.(labelContext) ?? label;
    labelsLayer.appendChild(text);
    toothGroup.appendChild(labelsLayer);

    // Keyboard focus listeners
    toothGroup.addEventListener(
      "focus",
      () => {
        focusRect.style.display = "block";
      },
      listenerOptions,
    );
    toothGroup.addEventListener(
      "blur",
      () => {
        focusRect.style.display = "none";
      },
      listenerOptions,
    );

    const resourceMarkup = options.toothResources?.[tooth];
    if (resourceMarkup) {
      const validation = validateToothSvg(resourceMarkup, {
        metadata: {
          contractVersion: SVG_CONTRACT_VERSION,
          resourceId: `consumer-${tooth}`,
          title: `Consumer tooth ${tooth}`,
          toothClass: getTooth(tooth)?.toothClass ?? "molar",
          projection: "occlusal",
          referenceToothId: tooth,
          viewBox: { width: 44, height: 52 },
        },
      });
      if (!validation.valid) {
        if ((options.toothResourceFallback ?? "schematic") === "error") {
          throw new Error(
            `Invalid SVG resource for tooth ${tooth}: ${validation.issues.map((issue) => issue.ruleId).join(", ")}`,
          );
        }
      } else {
        const prefixedMarkup = prefixElementIds(resourceMarkup, {
          prefix: `${this.instanceId}tooth-${tooth}-resource-`,
        });
        const resourcePrefix = `${this.instanceId}tooth-${tooth}-resource-`;
        const resource = parseSvgMarkup(prefixedMarkup);
        const resourceAnatomy = resource.querySelector(`#${resourcePrefix}layer-anatomy`);
        if (resourceAnatomy) {
          const resourceSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          resourceSvg.setAttribute("class", "odontogram-tooth-resource");
          resourceSvg.setAttribute("x", String(x));
          resourceSvg.setAttribute("y", String(y));
          resourceSvg.setAttribute("width", String(width));
          resourceSvg.setAttribute("height", String(height));
          resourceSvg.setAttribute("viewBox", resource.getAttribute("viewBox") ?? "0 0 44 52");
          resourceSvg.setAttribute("aria-hidden", "true");
          for (const child of [...resourceAnatomy.children]) {
            resourceSvg.appendChild(document.importNode(child, true));
          }
          const resourceOutline = resourceSvg.querySelector<SVGElement>("[id$='tooth-outline']");
          if (resourceOutline) {
            resourceOutline.setAttribute(
              "data-base-fill",
              resourceOutline.getAttribute("fill") ?? options.toothColor ?? "#f5f5f5",
            );
            this.resourceOutlines.set(tooth, resourceOutline);
          }
          anatomyLayer.appendChild(resourceSvg);
          const missingIndicator = this.missingIndicators.get(tooth);
          if (missingIndicator) anatomyLayer.appendChild(missingIndicator);
        }
      }
    }
    const toothHook = {
      tooth,
      isSelected: isToothSelected,
      presence,
      view: state.view,
      el: toothGroup,
    };
    this.appendCustomContent(toothGroup, options.toothContent?.(toothHook));
    const toothCleanup = options.toothDidMount?.(toothHook);
    if (typeof toothCleanup === "function") this.hookCleanups.set(`tooth:${tooth}`, toothCleanup);
    return toothGroup;
  }

  private appendCustomContent(
    parent: Element,
    content: import("@odontogram/core").CustomContent,
  ): void {
    const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
    wrapper.setAttribute("class", "odontogram-custom-content");
    wrapper.setAttribute("data-odontogram-custom-content", "true");
    parent.appendChild(wrapper);
    if (content == null) return;
    const values = Array.isArray(content) ? content : [content];
    for (const value of values) {
      if (typeof value === "string") wrapper.appendChild(document.createTextNode(value));
      else if (value && typeof value === "object" && "nodeType" in value) {
        wrapper.appendChild(document.importNode(value, true));
      }
    }
  }

  private syncAnnotationContent(
    ctx: ViewRenderContext,
    mark: OdontographicMark,
    element: Element,
    isSelected: boolean,
  ): void {
    element.querySelectorAll(":scope > [data-annotation-content-for]").forEach((node) => {
      if (node.getAttribute("data-annotation-content-for") === mark.id) node.remove();
    });
    this.appendCustomContent(
      element,
      ctx.options.annotationContent?.({
        mark,
        isSelected,
        view: ctx.state.view,
        el: element,
      }),
    );
    const wrapper = element.querySelector<SVGGElement>(
      ":scope > [data-odontogram-custom-content]:last-child",
    );
    wrapper?.setAttribute("data-annotation-content-for", mark.id);
  }

  private cleanupHookPrefix(prefix: string): void {
    for (const [key, cleanup] of this.hookCleanups) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        cleanup();
        this.hookCleanups.delete(key);
      }
    }
  }

  private syncToothLabel(ctx: ViewRenderContext, tooth: ToothId, label: string): void {
    const toothEl = this.toothElements.get(tooth);
    const labelEl = toothEl?.querySelector<SVGTextElement>('[data-role="label"]');
    if (!labelEl) return;
    const context = {
      tooth,
      label,
      accessibleLabel: toAccessibleNotation(tooth, (ctx.options.notation ?? "fdi") as Notation),
      isSelected: ctx.state.selection.teeth.includes(tooth),
      presence: getToothPresence(ctx.state.teeth, tooth),
      view: ctx.state.view,
    };
    labelEl.textContent = ctx.options.toothLabelContent?.(context) ?? label;
    const classes = normalizeClassNames(ctx.options.toothLabelClassNames?.(context));
    labelEl.setAttribute("class", ["odontogram-tooth-label", classes].filter(Boolean).join(" "));
  }

  private syncCustomContents(ctx: ViewRenderContext): void {
    const { options, state } = ctx;
    for (const [tooth, element] of this.toothElements) {
      element
        .querySelectorAll(":scope > [data-odontogram-custom-content]")
        .forEach((node) => node.remove());
      this.appendCustomContent(
        element,
        options.toothContent?.({
          tooth,
          isSelected: state.selection.teeth.includes(tooth),
          presence: getToothPresence(state.teeth, tooth),
          view: state.view,
          el: element,
        }),
      );
    }
    for (const [key, element] of this.surfaceElements) {
      const [tooth, surface] = key.split(":") as [ToothId, SurfaceId];
      element
        .querySelectorAll(":scope > [data-odontogram-custom-content]")
        .forEach((node) => node.remove());
      const isSelected =
        state.selection.teeth.includes(tooth) ||
        state.selection.surfaces.some((item) => item.tooth === tooth && item.surface === surface);
      this.appendCustomContent(
        element,
        options.surfaceContent?.({
          tooth,
          surface,
          isSelected,
          presence: getToothPresence(state.teeth, tooth),
          view: state.view,
          el: element,
        }),
      );
    }
  }

  private buildSurfaceElements(
    ctx: ViewRenderContext,
    tooth: ToothId,
    parentLayer: SVGGElement,
    layout: ToothLayout,
  ): void {
    const { x, y, isDetail } = layout;
    const width = layout.width ?? TOOTH_WIDTH;
    const height = layout.height ?? TOOTH_HEIGHT;
    const inset = isDetail ? 20 : SURFACE_INSET;
    const { options, state } = ctx;
    const presence = getToothPresence(state.teeth, tooth);
    const applicableSurfaces = getApplicableSurfaces(tooth);
    const signal = this.abortController?.signal;
    const listenerOptions = signal ? { signal } : undefined;

    for (const surface of applicableSurfaces) {
      const face = mapSurfaceToFace(tooth, surface);
      const surfaceGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      surfaceGroup.setAttribute("class", `odontogram-surface odontogram-surface-${surface}`);
      surfaceGroup.setAttribute("id", `${this.instanceId}tooth-${tooth}-surface-${surface}`);
      surfaceGroup.setAttribute("data-tooth", tooth);
      surfaceGroup.setAttribute("data-surface", surface);
      surfaceGroup.setAttribute("data-face", face);
      surfaceGroup.setAttribute("role", "button");
      surfaceGroup.setAttribute("tabindex", "0");
      surfaceGroup.setAttribute("aria-label", `${surface} surface`);
      const isSelected =
        state.selection.teeth.includes(tooth) ||
        state.selection.surfaces.some((item) => item.tooth === tooth && item.surface === surface);
      surfaceGroup.setAttribute("aria-pressed", String(isSelected));
      const classNames = normalizeClassNames(
        options.surfaceClassNames?.({
          tooth,
          surface,
          isSelected,
          presence,
          view: state.view,
          el: surfaceGroup,
        }),
      );
      if (classNames)
        surfaceGroup.setAttribute(
          "class",
          `odontogram-surface odontogram-surface-${surface} ${classNames}`,
        );

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "odontogram-surface-path");
      path.setAttribute("d", createFacePath(face, x, y, width, height, inset));
      path.setAttribute("fill", options.surfaceColor ?? "#e0e0e0");
      path.setAttribute("stroke", "#bbb");
      path.setAttribute("stroke-width", "0.5");
      path.style.cursor = "pointer";
      this.applyPresenceStyle(path, presence);

      path.addEventListener(
        "click",
        (e) => {
          const selected = ctx.state.selection.surfaces.some((item) => item.tooth === tooth && item.surface === surface);
          const mode = e.shiftKey ? "add" : (e.ctrlKey || e.metaKey || selected ? "toggle" : "replace");
          ctx.toggleSurfaceSelection(tooth, surface, mode);
          ctx.emitSurfaceClick(tooth, surface, e);
        },
        listenerOptions,
      );
      surfaceGroup.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        const selected = ctx.state.selection.surfaces.some((item) => item.tooth === tooth && item.surface === surface);
        const mode = e.shiftKey ? "add" : (selected ? "toggle" : "replace");
        ctx.toggleSurfaceSelection(tooth, surface, mode);
        ctx.emitSurfaceClick(tooth, surface, e);
      }, listenerOptions);

      surfaceGroup.appendChild(path);

      // In detail view, render surface code letter in center of surface path
      if (isDetail) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "odontogram-surface-label");
        let cx = x + width / 2;
        let cy = y + height / 2;
        if (face === "left") cx = x + inset / 2;
        else if (face === "right") cx = x + width - inset / 2;
        else if (face === "top") cy = y + inset / 2;
        else if (face === "bottom") cy = y + height - inset / 2;

        text.setAttribute("x", String(cx));
        text.setAttribute("y", String(cy + 4));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "600");
        text.setAttribute("fill", "#666");
        text.style.pointerEvents = "none";
        text.textContent = surface;
        surfaceGroup.appendChild(text);
      }

      parentLayer.appendChild(surfaceGroup);
      this.surfaceElements.set(`${tooth}:${surface}`, surfaceGroup);
      this.appendCustomContent(
        surfaceGroup,
        options.surfaceContent?.({
          tooth,
          surface,
          isSelected,
          presence,
          view: state.view,
          el: surfaceGroup,
        }),
      );
      const hookArg = { tooth, surface, isSelected, presence, view: state.view, el: surfaceGroup };
      const cleanup = options.surfaceDidMount?.(hookArg);
      if (typeof cleanup === "function")
        this.hookCleanups.set(`surface:${tooth}:${surface}`, cleanup);
    }
  }

  private buildMissingLines(
    group: SVGGElement,
    x: number,
    y: number,
    w = TOOTH_WIDTH,
    h = TOOTH_HEIGHT,
  ): void {
    const pad = 8;
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line1.setAttribute("x1", String(x + pad));
    line1.setAttribute("y1", String(y + pad));
    line1.setAttribute("x2", String(x + w - pad));
    line1.setAttribute("y2", String(y + h - pad));
    line1.setAttribute("stroke", "#757575");
    line1.setAttribute("stroke-width", "2");
    group.appendChild(line1);

    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line2.setAttribute("x1", String(x + w - pad));
    line2.setAttribute("y1", String(y + pad));
    line2.setAttribute("x2", String(x + pad));
    line2.setAttribute("y2", String(y + h - pad));
    line2.setAttribute("stroke", "#757575");
    line2.setAttribute("stroke-width", "2");
    group.appendChild(line2);
  }

  private applyPresenceStyle(element: SVGElement, presence: ToothPresence): void {
    if (presence === "missing") {
      element.setAttribute("opacity", "0.35");
      element.removeAttribute("stroke-dasharray");
    } else if (presence === "unerupted") {
      element.setAttribute("stroke-dasharray", "4 3");
      element.setAttribute("opacity", "0.7");
    } else {
      element.removeAttribute("opacity");
      element.removeAttribute("stroke-dasharray");
    }
  }

  private syncSelectionCaches(ctx: ViewRenderContext): void {
    this.renderedSelectedTeeth = new Set(ctx.state.selection.teeth);
    this.renderedSelectedSurfaces = new Set(
      ctx.state.selection.surfaces.map((s) => `${s.tooth}:${s.surface}`),
    );
  }

  private syncPresenceCaches(ctx: ViewRenderContext): void {
    this.renderedPresence.clear();
    for (const [toothId] of this.layoutMap.entries()) {
      this.renderedPresence.set(toothId, getToothPresence(ctx.state.teeth, toothId));
    }
  }

  private updateToothPresence(
    ctx: ViewRenderContext,
    toothId: ToothId,
    presence: ToothPresence,
  ): void {
    const toothGroup = this.toothElements.get(toothId);
    if (!toothGroup) return;

    toothGroup.setAttribute("data-presence", presence);

    const outline = toothGroup.querySelector<SVGRectElement>(
      `#${this.instanceId}tooth-${toothId}-outline`,
    );
    if (outline) {
      this.applyPresenceStyle(outline, presence);
    }
    const resourceOutline = this.resourceOutlines.get(toothId);
    if (resourceOutline) this.applyPresenceStyle(resourceOutline, presence);

    const missingInd = this.missingIndicators.get(toothId);
    if (missingInd) {
      missingInd.style.display = presence === "missing" ? "block" : "none";
    }

    const interactionLayer = toothGroup.querySelector<SVGGElement>(
      `#${this.instanceId}tooth-${toothId}-layer-interaction`,
    );
    if (interactionLayer) {
      if (presence === "missing") {
        for (const surface of getApplicableSurfaces(toothId)) {
          const key = `surface:${toothId}:${surface}`;
          this.hookCleanups.get(key)?.();
          this.hookCleanups.delete(key);
          const surfaceEl = this.surfaceElements.get(`${toothId}:${surface}`);
          if (surfaceEl)
            ctx.options.surfaceWillUnmount?.({
              tooth: toothId,
              surface,
              isSelected: false,
              presence,
              view: ctx.state.view,
              el: surfaceEl,
            });
        }
        interactionLayer.innerHTML = "";
        const applicableSurfaces = getApplicableSurfaces(toothId);
        for (const surface of applicableSurfaces) {
          this.surfaceElements.delete(`${toothId}:${surface}`);
        }
      } else if (interactionLayer.children.length === 0) {
        const layout = this.layoutMap.get(toothId);
        if (layout) {
          this.buildSurfaceElements(ctx, toothId, interactionLayer, layout);
        }
      }
    }

    const applicableSurfaces = getApplicableSurfaces(toothId);
    for (const surface of applicableSurfaces) {
      const surfaceGroup = this.surfaceElements.get(`${toothId}:${surface}`);
      const path = surfaceGroup?.querySelector<SVGPathElement>("path");
      if (path) {
        this.applyPresenceStyle(path, presence);
      }
    }
  }

  private updateToothSelection(
    ctx: ViewRenderContext,
    toothId: ToothId,
    isSelected: boolean,
  ): void {
    const toothGroup = this.toothElements.get(toothId);
    if (!toothGroup) return;

    toothGroup.setAttribute("aria-selected", String(isSelected));
    const { options, state } = ctx;
    const toothClassNames = normalizeClassNames(
      options.toothClassNames?.({ tooth: toothId, isSelected }),
    );
    const annotationClasses = getMarksForTooth(state.marks, toothId)
      .filter((mark) => isWholeToothMark(mark))
      .map((mark) =>
        normalizeClassNames(
          options.annotationClassNames?.({
            mark,
            isSelected: state.selection.annotations?.includes(mark.id) ?? false,
            view: state.view,
            el: toothGroup,
          }) ?? options.markClassNames?.({ mark }),
        ),
      )
      .filter(Boolean);
    toothGroup.setAttribute(
      "class",
      ["odontogram-tooth", toothClassNames, ...annotationClasses].filter(Boolean).join(" "),
    );

    if (isSelected) {
      toothGroup.setAttribute("aria-selected", "true");
    } else {
      toothGroup.removeAttribute("aria-selected");
    }

    const outline = toothGroup.querySelector<SVGRectElement>(
      `#${this.instanceId}tooth-${toothId}-outline`,
    );
    if (outline) {
      if (isSelected) {
        outline.setAttribute("fill", options.selectionColor ?? "#90caf9");
      } else {
        const toothMarks = getMarksForTooth(state.marks, toothId);
        const wholeToothMarks = toothMarks.filter((m) => isWholeToothMark(m));
        if (wholeToothMarks.length > 0) {
          const topMark = wholeToothMarks[wholeToothMarks.length - 1];
          outline.setAttribute(
            "fill",
            topMark
              ? resolveMarkFill(
                  topMark,
                  options.markColors ?? {},
                  options.statusColors ?? {},
                  options.toothColor ?? "#f5f5f5",
                )
              : (options.toothColor ?? "#f5f5f5"),
          );
        } else {
          outline.setAttribute("fill", options.toothColor ?? "#f5f5f5");
        }
      }
    }
    const resourceOutline = this.resourceOutlines.get(toothId);
    if (resourceOutline) {
      if (isSelected) resourceOutline.setAttribute("fill", options.selectionColor ?? "#90caf9");
      else
        resourceOutline.setAttribute(
          "fill",
          resourceOutline.getAttribute("data-base-fill") ?? options.toothColor ?? "#f5f5f5",
        );
    }

    // Update child surface visuals if selected via whole-tooth selection
    const applicableSurfaces = getApplicableSurfaces(toothId);
    for (const surface of applicableSurfaces) {
      const surfaceGroup = this.surfaceElements.get(`${toothId}:${surface}`);
      if (surfaceGroup) {
        const isSurfExplicitlySelected = state.selection.surfaces.some(
          (s) => s.tooth === toothId && s.surface === surface,
        );
        this.updateSurfaceVisuals(
          ctx,
          toothId,
          surface,
          surfaceGroup,
          isSelected || isSurfExplicitlySelected,
        );
      }
    }
  }

  private updateSurfaceVisuals(
    ctx: ViewRenderContext,
    toothId: ToothId,
    surface: SurfaceId,
    surfaceGroup: SVGGElement,
    isSelected: boolean,
  ): void {
    const { options, state } = ctx;
    const surfaceMarks = getMarksForSurface(state.marks, toothId, surface);
    const topMark = surfaceMarks.length > 0 ? surfaceMarks[surfaceMarks.length - 1] : undefined;

    let fill = options.surfaceColor ?? "#e0e0e0";
    if (topMark) {
      fill = resolveMarkFill(topMark, options.markColors ?? {}, options.statusColors ?? {});
    }
    if (isSelected) {
      fill = options.selectionColor ?? "#90caf9";
      surfaceGroup.setAttribute("aria-selected", "true");
    } else {
      surfaceGroup.removeAttribute("aria-selected");
    }
    surfaceGroup.setAttribute("aria-pressed", String(isSelected));

    const path = surfaceGroup.querySelector<SVGPathElement>("path");
    if (path) {
      path.setAttribute("fill", fill);
      path.setAttribute("stroke", topMark?.style?.stroke ?? "#bbb");
      path.setAttribute("stroke-width", String(topMark?.style?.strokeWidth ?? 0.5));
      if (topMark?.style?.opacity !== undefined) {
        path.setAttribute("opacity", String(topMark.style.opacity));
      }
    }

    if (surfaceMarks.length > 0) {
      surfaceGroup.setAttribute("data-mark-ids", surfaceMarks.map((m) => m.id).join(" "));
      surfaceGroup.setAttribute("data-mark-types", surfaceMarks.map((m) => m.type).join(" "));
      const statuses = surfaceMarks.map((m) => m.status).filter(Boolean);
      if (statuses.length > 0) {
        surfaceGroup.setAttribute("data-status", statuses.join(" "));
      } else {
        surfaceGroup.removeAttribute("data-status");
      }

      const markClasses = surfaceMarks
        .map((mark) =>
          normalizeClassNames(
            options.annotationClassNames?.({
              mark,
              isSelected: state.selection.annotations?.includes(mark.id) ?? false,
              view: state.view,
              el: surfaceGroup,
            }) ?? options.markClassNames?.({ mark }),
          ),
        )
        .filter(Boolean)
        .join(" ");

      const customClassNames = normalizeClassNames(
        options.surfaceClassNames?.({
          tooth: toothId,
          surface,
          isSelected,
          presence: getToothPresence(state.teeth, toothId),
          view: state.view,
          el: surfaceGroup,
        }),
      );
      surfaceGroup.setAttribute(
        "class",
        ["odontogram-surface", `odontogram-surface-${surface}`, customClassNames, markClasses]
          .filter(Boolean)
          .join(" "),
      );
    } else {
      surfaceGroup.removeAttribute("data-mark-ids");
      surfaceGroup.removeAttribute("data-mark-types");
      surfaceGroup.removeAttribute("data-status");
      const customClassNames = normalizeClassNames(
        options.surfaceClassNames?.({
          tooth: toothId,
          surface,
          isSelected,
          presence: getToothPresence(state.teeth, toothId),
          view: state.view,
          el: surfaceGroup,
        }),
      );
      surfaceGroup.setAttribute(
        "class",
        ["odontogram-surface", `odontogram-surface-${surface}`, customClassNames]
          .filter(Boolean)
          .join(" "),
      );
    }
  }

  private syncMarks(ctx: ViewRenderContext, initialMount = false): void {
    const { state } = ctx;
    const currentMarks = state.marks;
    const currentMarksMap = new Map(currentMarks.map((m) => [m.id, m]));

    // 1. Unmount removed marks
    for (const [id, oldMark] of this.renderedMarks.entries()) {
      if (!currentMarksMap.has(id)) {
        this.unmountSingleMark(ctx, oldMark);
      }
    }

    // 2. Add / update marks
    for (const mark of currentMarks) {
      const isNew = !this.renderedMarks.has(mark.id);
      this.applySingleMark(ctx, mark, isNew || initialMount);
    }

    this.renderedMarks = currentMarksMap;

    // Update tooth group `data-tooth-marks` attributes
    for (const [toothId, toothGroup] of this.toothElements.entries()) {
      const toothMarks = getMarksForTooth(currentMarks, toothId);
      if (toothMarks.length > 0) {
        toothGroup.setAttribute("data-tooth-marks", toothMarks.map((m) => m.id).join(" "));
      } else {
        toothGroup.removeAttribute("data-tooth-marks");
      }
    }
  }

  private applySingleMark(ctx: ViewRenderContext, mark: OdontographicMark, isMount: boolean): void {
    const { options } = ctx;

    if (isMultiToothMark(mark)) {
      this.renderMultiToothMark(ctx, mark, isMount);
      return;
    }

    const targetedTeeth = getMarkTargetTeeth(mark);
    for (const tooth of targetedTeeth) {
      const targetedSurfaces = getMarkTargetSurfaces(mark, tooth);
      if (targetedSurfaces.length > 0) {
        for (const surface of targetedSurfaces) {
          const surfaceGroup = this.surfaceElements.get(`${tooth}:${surface}`);
          if (surfaceGroup) {
            const isSelected =
              ctx.state.selection.teeth.includes(tooth) ||
              ctx.state.selection.surfaces.some((s) => s.tooth === tooth && s.surface === surface);
            this.updateSurfaceVisuals(ctx, tooth, surface, surfaceGroup, isSelected);
            this.syncAnnotationContent(
              ctx,
              mark,
              surfaceGroup,
              ctx.state.selection.annotations?.includes(mark.id) ?? false,
            );
            if (isMount) {
              const markCleanup = options.markDidMount?.({ mark, el: surfaceGroup });
              if (typeof markCleanup === "function")
                this.hookCleanups.set(`mark:${mark.id}:${tooth}:${surface}`, markCleanup);
              const cleanup = options.annotationDidMount?.({
                mark,
                isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
                view: ctx.state.view,
                el: surfaceGroup,
              });
              if (typeof cleanup === "function")
                this.hookCleanups.set(`annotation:${mark.id}:${tooth}:${surface}`, cleanup);
            }
          }
        }
      } else {
        // Whole tooth mark
        const toothGroup = this.toothElements.get(tooth);
        if (toothGroup) {
          const isSelected = ctx.state.selection.teeth.includes(tooth);
          this.updateToothSelection(ctx, tooth, isSelected);
          this.syncAnnotationContent(
            ctx,
            mark,
            toothGroup,
            ctx.state.selection.annotations?.includes(mark.id) ?? false,
          );
          if (isMount) {
            const markCleanup = options.markDidMount?.({ mark, el: toothGroup });
            if (typeof markCleanup === "function")
              this.hookCleanups.set(`mark:${mark.id}:${tooth}`, markCleanup);
            const cleanup = options.annotationDidMount?.({
              mark,
              isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
              view: ctx.state.view,
              el: toothGroup,
            });
            if (typeof cleanup === "function")
              this.hookCleanups.set(`annotation:${mark.id}:${tooth}`, cleanup);
          }
        }
      }
    }
  }

  private unmountSingleMark(ctx: ViewRenderContext, mark: OdontographicMark): void {
    const { options } = ctx;

    this.cleanupHookPrefix(`mark:${mark.id}`);
    this.cleanupHookPrefix(`annotation:${mark.id}`);

    if (isMultiToothMark(mark)) {
      this.cleanupHookPrefix(`mark:${mark.id}`);
      this.cleanupHookPrefix(`annotation:${mark.id}`);
      const existingEl = this.multiToothMarks.get(mark.id);
      if (existingEl) {
        options.annotationWillUnmount?.({
          mark,
          isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
          view: ctx.state.view,
          el: existingEl,
        });
        options.markWillUnmount?.({ mark, el: existingEl });
        existingEl.remove();
        this.multiToothMarks.delete(mark.id);
      }
      return;
    }

    const targetedTeeth = getMarkTargetTeeth(mark);
    for (const tooth of targetedTeeth) {
      const targetedSurfaces = getMarkTargetSurfaces(mark, tooth);
      if (targetedSurfaces.length > 0) {
        for (const surface of targetedSurfaces) {
          const surfaceGroup = this.surfaceElements.get(`${tooth}:${surface}`);
          if (surfaceGroup) {
            options.annotationWillUnmount?.({
              mark,
              isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
              view: ctx.state.view,
              el: surfaceGroup,
            });
            surfaceGroup
              .querySelectorAll(":scope > [data-annotation-content-for]")
              .forEach((node) => {
                if (node.getAttribute("data-annotation-content-for") === mark.id) node.remove();
              });
            options.markWillUnmount?.({ mark, el: surfaceGroup });
            const isSelected =
              ctx.state.selection.teeth.includes(tooth) ||
              ctx.state.selection.surfaces.some((s) => s.tooth === tooth && s.surface === surface);
            this.updateSurfaceVisuals(ctx, tooth, surface, surfaceGroup, isSelected);
          }
        }
      } else {
        const toothGroup = this.toothElements.get(tooth);
        if (toothGroup) {
          options.annotationWillUnmount?.({
            mark,
            isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
            view: ctx.state.view,
            el: toothGroup,
          });
          toothGroup.querySelectorAll(":scope > [data-annotation-content-for]").forEach((node) => {
            if (node.getAttribute("data-annotation-content-for") === mark.id) node.remove();
          });
          options.markWillUnmount?.({ mark, el: toothGroup });
          const isSelected = ctx.state.selection.teeth.includes(tooth);
          this.updateToothSelection(ctx, tooth, isSelected);
        }
      }
    }
  }

  private renderMultiToothMark(
    ctx: ViewRenderContext,
    mark: OdontographicMark,
    isMount: boolean,
  ): void {
    if (!this.annotationsLayer) return;

    const { options } = ctx;
    const targetTeeth = getMarkTargetTeeth(mark);
    if (targetTeeth.length === 0) return;
    const accessibleDescription =
      mark.text?.trim() || `${mark.type} annotation on teeth ${targetTeeth.join(", ")}`;

    let group = this.multiToothMarks.get(mark.id);
    if (!group) {
      group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", `odontogram-annotation odontogram-annotation-${mark.type}`);
      group.setAttribute("id", `${this.instanceId}mark-${mark.id}`);
      group.setAttribute("data-mark-id", mark.id);
      group.setAttribute("data-mark-type", mark.type);
      group.setAttribute("data-target-teeth", targetTeeth.join(" "));
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-label", accessibleDescription);
      group.addEventListener("click", () => ctx.selectAnnotation(mark.id), {
        signal: this.abortController?.signal,
      });
      group.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            ctx.selectAnnotation(mark.id);
          }
        },
        { signal: this.abortController?.signal },
      );
      this.annotationsLayer.appendChild(group);
      this.multiToothMarks.set(mark.id, group);
    } else {
      group.innerHTML = "";
    }
    const annotationClasses = normalizeClassNames(
      options.annotationClassNames?.({
        mark,
        isSelected: ctx.state.selection.annotations?.includes(mark.id) ?? false,
        view: ctx.state.view,
        el: group,
      }) ?? options.markClassNames?.({ mark }),
    );
    group.setAttribute(
      "class",
      ["odontogram-annotation", `odontogram-annotation-${mark.type}`, annotationClasses]
        .filter(Boolean)
        .join(" "),
    );
    group.setAttribute("data-target-teeth", targetTeeth.join(" "));
    group.setAttribute("aria-label", accessibleDescription);
    group.setAttribute("data-mark-type", mark.type);

    // Find layout coordinates for mounted/visible target teeth
    const targetEntries: MultiToothTargetEntry[] =
      mark.target && "targets" in mark.target && mark.target.targets?.length
        ? mark.target.targets
        : targetTeeth.map((tooth) => ({ tooth }));
    const coords: Array<{ tooth: ToothId; index: number; role?: string; x: number; y: number }> =
      targetEntries.flatMap((entry, index) => {
        const t = entry.tooth;
        const toothEl = this.toothElements.get(t);
        if (!toothEl) return [];
        const anchorId = entry.anchor ?? "anchor-center";
        if (!(REQUIRED_ANCHOR_IDS as readonly string[]).includes(anchorId)) return [];
        const anchor = toothEl.querySelector<SVGCircleElement>(
          `[data-contract-anchor="${anchorId}"]`,
        );
        if (!anchor) return [];
        return [
          {
            tooth: t,
            index,
            role: entry.role,
            x: Number(anchor.getAttribute("cx")),
            y: Number(anchor.getAttribute("cy")),
          },
        ];
      });

    group.setAttribute("data-visible-target-teeth", coords.map((c) => c.tooth).join(" "));
    const selected = ctx.state.selection.annotations?.includes(mark.id) ?? false;
    group.setAttribute("aria-pressed", String(selected));
    group.classList.toggle("is-selected", selected);
    if (coords.length === 0) return;

    const strokeColor = resolveMarkFill(
      mark,
      options.markColors ?? {},
      options.statusColors ?? {},
      "#1976d2",
    );

    const segments: Array<[(typeof coords)[number], (typeof coords)[number]]> = [];
    for (let i = 1; i < coords.length; i += 1) {
      const previous = coords[i - 1]!;
      const current = coords[i]!;
      if (current.index === previous.index + 1) segments.push([previous, current]);
    }
    if (segments.length > 0) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = segments.map(([from, to]) => `M ${from.x} ${from.y} L ${to.x} ${to.y}`).join(" ");
      path.setAttribute("d", d);
      path.setAttribute(
        "stroke",
        mark.style?.stroke ?? (selected ? options.selectionColor : strokeColor) ?? strokeColor,
      );
      path.setAttribute(
        "stroke-width",
        String((mark.style?.strokeWidth ?? 3) + (selected ? 1 : 0)),
      );
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("fill", "none");
      if (mark.style?.opacity !== undefined) {
        path.setAttribute("opacity", String(mark.style.opacity));
      }
      group.appendChild(path);
    }

    // Node circles on visible abutments/pontics
    for (const c of coords) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(c.x));
      circle.setAttribute("cy", String(c.y));
      circle.setAttribute("r", selected ? "5" : "4");
      circle.setAttribute("data-tooth", c.tooth);
      if (c.role) circle.setAttribute("data-role", c.role);
      circle.setAttribute("fill", strokeColor);
      circle.setAttribute("stroke", "#ffffff");
      circle.setAttribute("stroke-width", "1.5");
      group.appendChild(circle);
    }

    this.appendCustomContent(
      group,
      options.annotationContent?.({ mark, isSelected: selected, view: ctx.state.view, el: group }),
    );

    if (isMount) {
      const markCleanup = options.markDidMount?.({ mark, el: group });
      if (typeof markCleanup === "function") this.hookCleanups.set(`mark:${mark.id}`, markCleanup);
      const cleanup = options.annotationDidMount?.({
        mark,
        isSelected: selected,
        view: ctx.state.view,
        el: group,
      });
      if (typeof cleanup === "function") this.hookCleanups.set(`annotation:${mark.id}`, cleanup);
    }
  }
}
