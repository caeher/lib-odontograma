import type {
  DentalRendererDefinition,
  ExportPngOptions,
  ExportScope,
  ExportSvgOptions,
  ExportTheme,
  LegendOptions,
  MarkCatalogEntry,
  MultiToothTargetEntry,
  Notation,
  Odontogram,
  OdontogramNotationDefinition,
  OdontogramState,
  OdontogramSymbolDefinition,
  OdontogramVisualSettings,
  PrintLayoutResult,
  PrintOptions,
  ToothId,
  ToothPresence,
  ViewOptions,
  ViewRenderContext,
  ViewType,
} from "@odontogram/core";
import {
  getMarkTargetTeeth,
  getMarksForSurface,
  getToothPresence,
  isMultiToothMark,
} from "@odontogram/core";
import { getApplicableSurfaces, mapSurfaceToFace, toNotation } from "@odontogram/dentition";
import {
  SURFACE_INSET,
  TOOTH_HEIGHT,
  TOOTH_WIDTH,
  computeViewLayout,
  createFacePath,
  resolveMarkFill,
  type ToothLayout,
} from "./incremental-renderer.js";

function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface StandaloneSvgExtra {
  getDentalRenderers?: () => DentalRendererDefinition[];
  getSymbol?: (type: string) => OdontogramSymbolDefinition | undefined;
  getNotation?: (notation: string) => OdontogramNotationDefinition | undefined;
  toothResources?: Record<ToothId, string>;
  toothResourceFallback?: "schematic" | "error";
  markCatalog?: MarkCatalogEntry[];
}

/**
 * Generate standard inlined CSS rules for standalone SVG exports.
 */
export function generateStandaloneStyles(
  theme: ExportTheme = "light",
  customStyles?: string,
): string {
  const isDark = theme === "dark";
  const isPrint = theme === "print";

  const textColor = isDark ? "#e2e8f0" : isPrint ? "#000000" : "#111827";
  const mutedColor = isDark ? "#a0aec0" : isPrint ? "#4b5563" : "#6b7280";
  const midlineColor = isDark ? "#718096" : isPrint ? "#9ca3af" : "#bdbdbd";
  const outlineStroke = isDark ? "#718096" : isPrint ? "#111827" : "#999999";
  const surfaceStroke = isDark ? "#718096" : isPrint ? "#374151" : "#bbbbbb";

  return `
    .odontogram-svg {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-rendering: optimizeLegibility;
      shape-rendering: geometricPrecision;
      user-select: none;
      -webkit-user-select: none;
      ${isPrint ? "print-color-adjust: exact; -webkit-print-color-adjust: exact;" : ""}
    }
    .odontogram-tooth-outline {
      stroke: ${outlineStroke};
    }
    .odontogram-surface-path {
      stroke: ${surfaceStroke};
      vector-effect: non-scaling-stroke;
    }
    .odontogram-tooth-label {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: 600;
      fill: ${textColor};
    }
    .odontogram-surface-label {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: 700;
      fill: ${mutedColor};
    }
    .odontogram-orientation-label {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: 600;
      fill: ${mutedColor};
    }
    .odontogram-midline-line {
      stroke: ${midlineColor};
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }
    .odontogram-midline-label {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      fill: ${mutedColor};
    }
    .odontogram-export-title {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 16px;
      font-weight: 700;
      fill: ${textColor};
    }
    .odontogram-export-legend-title {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      font-weight: 700;
      fill: ${textColor};
    }
    .odontogram-export-legend-item text {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      font-weight: 500;
      fill: ${mutedColor};
    }
    .odontogram-missing-indicator line {
      stroke: #e53935;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .odontogram-annotation path {
      fill: none;
      stroke-linecap: round;
    }
    ${customStyles ?? ""}
  `.trim();
}

/**
 * Resolve target view based on requested scope or explicit view.
 */
export function resolveExportView(
  currentView: ViewType,
  scope?: ExportScope,
  explicitView?: ViewType,
  stateTeeth?: Record<ToothId, { presence: ToothPresence }>,
): ViewType {
  if (explicitView && explicitView.trim() !== "") {
    return explicitView;
  }
  if (!scope || scope === "current") {
    return currentView;
  }
  if (scope === "full") {
    if (currentView === "deciduous" || currentView === "primary") {
      return "deciduous";
    }
    if (currentView === "mixed") {
      return "mixed";
    }
    if (stateTeeth) {
      const hasPrimary = Object.keys(stateTeeth).some((id) => {
        const q = parseInt(id.charAt(0), 10);
        return q >= 5 && q <= 8;
      });
      if (hasPrimary) return "mixed";
    }
    return "permanent";
  }
  return scope;
}

/**
 * Generate a standalone, self-contained SVG string from an Odontogram state and options.
 */
export function generateStandaloneSvg(
  state: OdontogramState,
  options: ExportSvgOptions = {},
  visualSettings: OdontogramVisualSettings = {},
  extra: StandaloneSvgExtra = {},
): string {
  const targetView = resolveExportView(state.view, options.scope, options.view, state.teeth);
  const theme: ExportTheme = options.theme ?? "light";
  const isDark = theme === "dark";
  const isPrint = theme === "print";

  const notation = (options.notation ?? visualSettings.notation ?? "fdi") as Notation;

  const effectiveViewOptions: ViewOptions = {
    ...((visualSettings.viewOptions as ViewOptions) ?? {}),
    showOrientationLabels: visualSettings.showOrientationLabels ?? true,
    showMidline: visualSettings.showMidline ?? true,
  };

  if (targetView.startsWith("quadrant-")) {
    const qNum = parseInt(targetView.slice("quadrant-".length), 10);
    if (!isNaN(qNum)) effectiveViewOptions.quadrant = qNum;
  } else if (targetView.startsWith("tooth-")) {
    effectiveViewOptions.tooth = targetView.slice("tooth-".length);
  } else if (targetView === "upper" || targetView === "maxillary") {
    effectiveViewOptions.arch = "upper";
  } else if (targetView === "lower" || targetView === "mandibular") {
    effectiveViewOptions.arch = "lower";
  }

  const allLayout = computeViewLayout(targetView, effectiveViewOptions, notation);

  // Apply custom notation formatting if available
  for (const item of allLayout) {
    const custom = extra.getNotation?.(notation);
    item.label = custom ? custom.format(item.tooth) : toNotation(item.tooth, notation);
  }

  // Filter visible teeth if specified
  const visibleFilter = visualSettings.visibleTeeth;
  const visibleSet = visibleFilter && Array.isArray(visibleFilter) ? new Set(visibleFilter) : null;
  const renderedLayout = visibleSet
    ? allLayout.filter((item) => visibleSet.has(item.tooth))
    : allLayout;

  const layoutMap = new Map<ToothId, ToothLayout>();
  for (const item of renderedLayout) {
    layoutMap.set(item.tooth, item);
  }

  // Calculate bounding box
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  if (renderedLayout.length > 0) {
    minX = Math.min(...renderedLayout.map((l) => l.x));
    maxX = Math.max(...renderedLayout.map((l) => l.x + (l.width ?? TOOTH_WIDTH)));
    minY = Math.min(...renderedLayout.map((l) => l.y));
    maxY = Math.max(...renderedLayout.map((l) => l.y + (l.height ?? TOOTH_HEIGHT)));
  }

  const isDetailView = renderedLayout.length === 1 && Boolean(renderedLayout[0]?.isDetail);
  const showOrientationLabels =
    effectiveViewOptions.showOrientationLabels ?? visualSettings.showOrientationLabels ?? true;
  const showMidline = effectiveViewOptions.showMidline ?? visualSettings.showMidline ?? true;

  const hasTitle = Boolean(options.title && options.title.trim() !== "");
  const titleHeight = hasTitle ? 32 : 0;

  const padX = isDetailView ? 30 : 24;
  const padTop = (showOrientationLabels || showMidline ? 36 : 16) + titleHeight;

  // Check if legend is requested
  const hasLegend = Boolean(options.legend);
  const legendHeight = hasLegend ? 48 : 0;
  const padBottom = 28 + legendHeight;

  const totalW = Math.max(maxX - minX + padX * 2, 240);
  const totalH = Math.max(maxY - minY + padTop + padBottom, 140);
  const viewBoxX = minX - padX;
  const viewBoxY = minY - padTop;

  // Background resolution
  let bgFill = options.background;
  if (!bgFill) {
    if (isDark) bgFill = "#1e1e1e";
    else if (isPrint) bgFill = "#ffffff";
    else bgFill = "transparent";
  }

  const toothColor = isDark
    ? "#2d3748"
    : isPrint
      ? "#ffffff"
      : ((visualSettings.toothColor as string) ?? "#f5f5f5");
  const surfaceColor = isDark
    ? "#4a5568"
    : isPrint
      ? "#f3f4f6"
      : ((visualSettings.surfaceColor as string) ?? "#e0e0e0");
  const selectionColor = (visualSettings.selectionColor as string) ?? "#90caf9";
  const markColors = (visualSettings.markColors as Record<string, string>) ?? {};
  const statusColors = (visualSettings.statusColors as Record<string, string>) ?? {};

  const widthAttr = options.width ? `width="${escapeXml(String(options.width))}"` : 'width="100%"';
  const heightAttr = options.height
    ? `height="${escapeXml(String(options.height))}"`
    : 'height="100%"';

  const styles = generateStandaloneStyles(theme, options.customStyles);

  let xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${totalW} ${totalH}" ${widthAttr} ${heightAttr} role="img" class="odontogram-svg theme-${theme}">\n`;
  xml += `<title>${escapeXml(options.title || `Odontogram (${targetView})`)}</title>\n`;
  xml += `<style>\n${styles}\n</style>\n`;

  // Background rect
  if (bgFill && bgFill !== "transparent") {
    xml += `<rect x="${viewBoxX}" y="${viewBoxY}" width="${totalW}" height="${totalH}" fill="${escapeXml(bgFill)}" />\n`;
  }

  // Consumer Title
  if (hasTitle) {
    const titleY = minY - padTop + 22;
    const titleX = viewBoxX + totalW / 2;
    xml += `<text class="odontogram-export-title" x="${titleX}" y="${titleY}" text-anchor="middle">${escapeXml(options.title!)}</text>\n`;
  }

  // Orientation labels
  if (showOrientationLabels) {
    const orientationY = minY - 12;
    if (isDetailView && renderedLayout[0]) {
      const label = renderedLayout[0].label;
      xml += `<text class="odontogram-orientation-label" x="0" y="${orientationY}" text-anchor="middle">Tooth ${escapeXml(label)}</text>\n`;
    } else if (targetView.startsWith("quadrant-") || targetView === "quadrant") {
      const qNum = effectiveViewOptions.quadrant ?? 1;
      const isRight = [1, 4, 5, 8].includes(qNum);
      const textX = isRight ? minX + 8 : maxX - 8;
      const anchor = isRight ? "start" : "end";
      const qText = isRight
        ? `Patient Right · Quadrant ${qNum}`
        : `Patient Left · Quadrant ${qNum}`;
      xml += `<text class="odontogram-orientation-label" x="${textX}" y="${orientationY}" text-anchor="${anchor}">${escapeXml(qText)}</text>\n`;
    } else {
      xml += `<text class="odontogram-orientation-label odontogram-orientation-right" x="${minX + 8}" y="${orientationY}" text-anchor="start">R (Patient Right)</text>\n`;
      xml += `<text class="odontogram-orientation-label odontogram-orientation-left" x="${maxX - 8}" y="${orientationY}" text-anchor="end">L (Patient Left)</text>\n`;
    }
  }

  // Midline divider
  if (showMidline && minX < -10 && maxX > 10 && !isDetailView) {
    xml += `<g class="odontogram-layer-midline">\n`;
    xml += `  <line class="odontogram-midline-line" x1="0" y1="${minY - 6}" x2="0" y2="${maxY + 20}" />\n`;
    xml += `  <text class="odontogram-midline-label" x="0" y="${minY - 12}" text-anchor="middle" font-size="10">Midline</text>\n`;
    xml += `</g>\n`;
  }

  // Multi-tooth annotations (bridge, splint)
  const anchorCoordinates = new Map<string, { x: number; y: number }>();
  for (const layout of renderedLayout) {
    const w = layout.width ?? TOOTH_WIDTH;
    const h = layout.height ?? TOOTH_HEIGHT;
    const q = layout.quadrant;
    const mesialTowardRight = [1, 4, 5, 8].includes(q);
    anchorCoordinates.set(`${layout.tooth}:anchor-center`, {
      x: layout.x + w / 2,
      y: layout.y + h / 2,
    });
    anchorCoordinates.set(`${layout.tooth}:anchor-mesial`, {
      x: layout.x + w * (mesialTowardRight ? 0.72 : 0.28),
      y: layout.y + h / 2,
    });
    anchorCoordinates.set(`${layout.tooth}:anchor-distal`, {
      x: layout.x + w * (mesialTowardRight ? 0.28 : 0.72),
      y: layout.y + h / 2,
    });
  }

  xml += `<g class="odontogram-layer-annotations">\n`;
  for (const mark of state.marks) {
    if (isMultiToothMark(mark)) {
      const targetTeeth = getMarkTargetTeeth(mark);
      const targetEntries: MultiToothTargetEntry[] =
        mark.target && "targets" in mark.target && mark.target.targets?.length
          ? mark.target.targets
          : targetTeeth.map((t) => ({ tooth: t }));

      const coords: Array<{ tooth: ToothId; index: number; role?: string; x: number; y: number }> =
        targetEntries.flatMap((entry, index) => {
          const t = entry.tooth;
          const anchorId = entry.anchor ?? "anchor-center";
          const pt = anchorCoordinates.get(`${t}:${anchorId}`);
          if (!pt) return [];
          return [{ tooth: t, index, role: entry.role, x: pt.x, y: pt.y }];
        });

      if (coords.length > 0) {
        const isSelected =
          options.includeSelection && state.selection.annotations?.includes(mark.id);
        const strokeColor = resolveMarkFill(mark, markColors, statusColors, "#1976d2");

        xml += `  <g class="odontogram-annotation odontogram-annotation-${escapeXml(mark.type)}">\n`;

        // Check if custom symbol definition exists
        const customSymbol = extra.getSymbol?.(mark.type);
        if (customSymbol && typeof document !== "undefined") {
          try {
            const tempG = document.createElementNS("http://www.w3.org/2000/svg", "g");
            customSymbol.render({
              mark,
              element: tempG,
              targets: coords,
              selected: Boolean(isSelected),
              color: strokeColor,
            });
            xml += `    ${tempG.innerHTML}\n`;
          } catch {
            // Fall back to default multi-tooth render
          }
        } else {
          // Default connection line
          const segments: Array<[(typeof coords)[number], (typeof coords)[number]]> = [];
          for (let i = 1; i < coords.length; i++) {
            const prev = coords[i - 1]!;
            const curr = coords[i]!;
            if (curr.index === prev.index + 1) {
              segments.push([prev, curr]);
            }
          }
          if (segments.length > 0) {
            const pathD = segments
              .map(([from, to]) => `M ${from.x} ${from.y} L ${to.x} ${to.y}`)
              .join(" ");
            const sw = (mark.style?.strokeWidth ?? 3) + (isSelected ? 1 : 0);
            xml += `    <path d="${pathD}" stroke="${escapeXml(strokeColor)}" stroke-width="${sw}" stroke-linecap="round" fill="none" />\n`;
          }

          // Node circles
          for (const c of coords) {
            const r = isSelected ? 5 : 4;
            xml += `    <circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${escapeXml(strokeColor)}" stroke="#ffffff" stroke-width="1.5" />\n`;
          }
        }
        xml += `  </g>\n`;
      }
    }
  }
  xml += `</g>\n`;

  // Render teeth
  for (const layout of renderedLayout) {
    const { tooth, x, y, label, isDetail } = layout;
    const w = layout.width ?? TOOTH_WIDTH;
    const h = layout.height ?? TOOTH_HEIGHT;
    const inset = isDetail ? 20 : SURFACE_INSET;
    const presence = getToothPresence(state.teeth, tooth);
    const isToothSelected = options.includeSelection && state.selection.teeth.includes(tooth);

    xml += `<g class="odontogram-tooth" data-tooth="${escapeXml(tooth)}" data-presence="${presence}">\n`;

    // Anatomy layer
    const outlineFill = isToothSelected ? selectionColor : toothColor;
    xml += `  <g class="odontogram-layer-anatomy">\n`;
    xml += `    <rect class="odontogram-tooth-outline" x="${x}" y="${y}" width="${w}" height="${h}" rx="${isDetail ? 8 : 4}" fill="${escapeXml(outlineFill)}" stroke-width="${isDetail ? 1.5 : 1}" />\n`;

    // Missing indicator
    if (presence === "missing") {
      xml += `    <g class="odontogram-missing-indicator">\n`;
      xml += `      <line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" />\n`;
      xml += `      <line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y}" />\n`;
      xml += `    </g>\n`;
    }
    xml += `  </g>\n`;

    // Surfaces interaction layer (if not missing)
    if (presence !== "missing") {
      xml += `  <g class="odontogram-layer-interaction">\n`;
      const applicable = getApplicableSurfaces(tooth);
      for (const surf of applicable) {
        const face = mapSurfaceToFace(tooth, surf);
        const surfaceMarks = getMarksForSurface(state.marks, tooth, surf);
        const topMark = surfaceMarks.length > 0 ? surfaceMarks[surfaceMarks.length - 1] : undefined;
        const isSurfSelected =
          options.includeSelection &&
          (isToothSelected ||
            state.selection.surfaces.some((s) => s.tooth === tooth && s.surface === surf));

        let fill = surfaceColor;
        if (topMark) {
          fill = resolveMarkFill(topMark, markColors, statusColors, "#ef5350");
        }
        if (isSurfSelected) {
          fill = selectionColor;
        }

        const pathD = createFacePath(face, x, y, w, h, inset);
        xml += `    <path class="odontogram-surface-path" d="${pathD}" fill="${escapeXml(fill)}" stroke-width="0.5" />\n`;

        if (isDetail) {
          let cx = x + w / 2;
          let cy = y + h / 2;
          if (face === "left") cx = x + inset / 2;
          else if (face === "right") cx = x + w - inset / 2;
          else if (face === "top") cy = y + inset / 2;
          else if (face === "bottom") cy = y + h - inset / 2;

          xml += `    <text class="odontogram-surface-label" x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11">${surf}</text>\n`;
        }
      }
      xml += `  </g>\n`;
    }

    // Tooth Notation Label
    const labelY = y + h + (isDetail ? 18 : 14);
    xml += `  <g class="odontogram-layer-labels">\n`;
    xml += `    <text class="odontogram-tooth-label" x="${x + w / 2}" y="${labelY}" text-anchor="middle" font-size="${isDetail ? 14 : 10}">${escapeXml(label)}</text>\n`;
    xml += `  </g>\n`;

    xml += `</g>\n`;
  }

  // Legend at bottom
  if (hasLegend) {
    const legendY = maxY + 32;
    xml += `<g class="odontogram-export-legend" transform="translate(${viewBoxX + padX}, ${legendY})">\n`;

    const legendOpts: LegendOptions = typeof options.legend === "object" ? options.legend : {};
    const heading = legendOpts.label ?? "Legend";
    xml += `  <text class="odontogram-export-legend-title" x="0" y="0">${escapeXml(heading)}</text>\n`;

    // Compute entries
    let items: Array<{ type: string; status?: string; label: string; color: string }> = [];
    if (legendOpts.items && legendOpts.items.length > 0) {
      items = legendOpts.items.map((it) => ({
        type: it.type,
        status: it.status,
        label: it.label ?? (it.status ? `${it.type} (${it.status})` : it.type),
        color:
          it.color ??
          markColors[it.type] ??
          (it.status ? statusColors[it.status] : undefined) ??
          "#ef5350",
      }));
    } else {
      const seen = new Set<string>();
      for (const m of state.marks) {
        const key = `${m.type}:${m.status ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          const color = resolveMarkFill(m, markColors, statusColors, "#ef5350");
          items.push({
            type: m.type,
            status: m.status,
            label: m.status ? `${m.type} (${m.status})` : m.type,
            color,
          });
        }
      }
    }

    let itemX = 0;
    const itemY = 16;
    for (const item of items) {
      xml += `  <g class="odontogram-export-legend-item" transform="translate(${itemX}, ${itemY})">\n`;
      xml += `    <rect x="0" y="-8" width="10" height="10" rx="2" fill="${escapeXml(item.color)}" stroke="#777" stroke-width="0.5" />\n`;
      xml += `    <text x="14" y="0">${escapeXml(item.label)}</text>\n`;
      xml += `  </g>\n`;
      itemX += Math.max(item.label.length * 7 + 30, 80);
    }

    xml += `</g>\n`;
  }

  xml += `</svg>`;
  return xml;
}

/**
 * High-level exportSvg method that accepts an Odontogram instance or ViewRenderContext.
 */
export function exportSvg(
  target:
    Odontogram | ViewRenderContext | { state: OdontogramState; options?: OdontogramVisualSettings },
  options: ExportSvgOptions = {},
): string {
  let state: OdontogramState;
  let visualSettings: OdontogramVisualSettings = {};
  let extra: StandaloneSvgExtra = {};

  if (
    target &&
    typeof target === "object" &&
    "getState" in target &&
    typeof (target as any).getState === "function"
  ) {
    const o = target as Odontogram;
    state = o.getState();
    visualSettings = {
      notation: o.getOption("notation"),
      locale: o.getOption("locale"),
      toothColor: o.getOption("toothColor"),
      surfaceColor: o.getOption("surfaceColor"),
      selectionColor: o.getOption("selectionColor"),
      markColors: o.getOption("markColors"),
      statusColors: o.getOption("statusColors"),
      showOrientationLabels: o.getOption("showOrientationLabels"),
      showMidline: o.getOption("showMidline"),
      visibleTeeth: o.getOption("visibleTeeth"),
      viewOptions: o.getOption("viewOptions"),
    };
    extra = {
      getDentalRenderers: () => o.getDentalRenderers(),
      getSymbol: (type) => o.getSymbol(type),
      getNotation: (not) => o.getNotation(not),
      toothResources: o.getOption("toothResources"),
      toothResourceFallback: o.getOption("toothResourceFallback"),
      markCatalog: o.getOption("markCatalog"),
    };
  } else if (target && typeof target === "object" && "state" in target) {
    const ctx = target as { state: OdontogramState; options?: OdontogramVisualSettings };
    state = ctx.state;
    if (ctx.options) {
      visualSettings = ctx.options;
    }
    if ("getDentalRenderers" in target) {
      extra = {
        getDentalRenderers: (target as any).getDentalRenderers,
        getSymbol: (target as any).getSymbol,
        getNotation: (target as any).getNotation,
        toothResources: (target as any).options?.toothResources,
        toothResourceFallback: (target as any).options?.toothResourceFallback,
        markCatalog: (target as any).options?.markCatalog,
      };
    }
  } else {
    throw new Error("Invalid target provided to exportSvg.");
  }

  return generateStandaloneSvg(state, options, visualSettings, extra);
}

/**
 * Export chart as a raster PNG image (Blob or base64 Data URL).
 */
export async function exportPng(
  target: Odontogram | ViewRenderContext | string,
  options: ExportPngOptions = {},
): Promise<Blob | string> {
  const svgMarkup = typeof target === "string" ? target : exportSvg(target as any, options);

  // Parse width & height from viewBox
  const viewBoxMatch = svgMarkup.match(/viewBox=["']([^"']+)["']/);
  let vbWidth = 800;
  let vbHeight = 400;
  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].trim().split(/[ ,]+/).map(Number);
    if (parts.length === 4 && parts[2] && parts[3]) {
      vbWidth = parts[2];
      vbHeight = parts[3];
    }
  }

  const scale = options.scale ?? 2;
  const targetWidth = Math.round(vbWidth * scale);
  const targetHeight = Math.round(vbHeight * scale);

  // Check for browser DOM environment
  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        if (options.format === "data-url") {
          resolve(
            `data:image/svg+xml;base64,${typeof Buffer !== "undefined" ? Buffer.from(svgMarkup).toString("base64") : btoa(svgMarkup)}`,
          );
        } else {
          resolve(new Blob([svgMarkup], { type: "image/svg+xml" }));
        }
        return;
      }

      // Background fill
      if (options.background && options.background !== "transparent") {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (options.theme === "dark") {
        ctx.fillStyle = "#1e1e1e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const URL = window.URL || window.webkitURL || globalThis.URL;
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          URL.revokeObjectURL(url);

          if (options.format === "data-url") {
            resolve(canvas.toDataURL("image/png"));
          } else {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else resolve(canvas.toDataURL("image/png"));
            }, "image/png");
          }
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG into raster Image: ${String(err)}`));
      };

      img.src = url;
    });
  }

  // Fallback / headless mock support
  if (options.format === "data-url") {
    return `data:image/svg+xml;base64,${typeof Buffer !== "undefined" ? Buffer.from(svgMarkup).toString("base64") : btoa(svgMarkup)}`;
  }
  return new Blob([svgMarkup], { type: "image/svg+xml" });
}

/**
 * Generate print-ready HTML / SVG markup.
 */
export function getPrintMarkup(
  target: Odontogram | ViewRenderContext,
  options: PrintOptions = {},
): string {
  const svgTheme = options.theme ?? "print";
  const svgMarkup = exportSvg(target as any, {
    scope: options.scope,
    view: options.view,
    theme: svgTheme,
    legend: options.legend ?? true,
    includeSelection: false,
  });

  let titleHtml = "";
  if (options.title) {
    titleHtml += `<h1 class="odontogram-print-title">${escapeXml(options.title)}</h1>`;
  }
  if (options.subtitle) {
    titleHtml += `<p class="odontogram-print-subtitle">${escapeXml(options.subtitle)}</p>`;
  }

  const marginStyle = options.margins ? `padding: ${escapeXml(options.margins)};` : "";

  return `
    <div class="odontogram-print-container" style="${marginStyle}">
      ${titleHtml}
      ${svgMarkup}
    </div>
  `.trim();
}

/**
 * Prepare and execute browser print.
 */
export function printOdontogram(target: Odontogram, options: PrintOptions = {}): PrintLayoutResult {
  if (typeof document === "undefined") {
    throw new Error("printOdontogram requires a DOM document environment.");
  }

  const markup = getPrintMarkup(target, options);
  const container = document.createElement("div");
  container.className = "odontogram-print-overlay";
  container.innerHTML = markup;

  document.body.appendChild(container);

  const svgElement = container.querySelector("svg") as SVGSVGElement;

  const cleanup = () => {
    container.remove();
  };

  if (
    options.autoPrint !== false &&
    typeof window !== "undefined" &&
    typeof window.print === "function"
  ) {
    const onAfterPrint = () => {
      cleanup();
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("afterprint", onAfterPrint);
    setTimeout(() => {
      window.print();
    }, 50);
  }

  return {
    container,
    svgElement,
    cleanup,
  };
}
