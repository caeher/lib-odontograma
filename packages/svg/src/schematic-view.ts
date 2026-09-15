import type {
  ViewRenderContext,
  SurfaceId,
  ToothId,
  OdontographicMark,
  ToothPresence,
} from "@odontogram/core";
import { getToothPresence } from "@odontogram/core";
import {
  getApplicableSurfaces,
  getArch,
  getTeethForView,
  mapSurfaceToFace,
  toNotation,
  type GraphicFace,
  type Notation,
} from "@odontogram/dentition";

const TOOTH_WIDTH = 44;
const TOOTH_HEIGHT = 52;
const TOOTH_GAP = 4;
const ARCH_GAP = 60;
const SURFACE_INSET = 6;

interface ToothLayout {
  tooth: ToothId;
  x: number;
  y: number;
  label: string;
}

function getArchTeeth(view: string, layoutArch: "upper" | "lower"): ToothId[] {
  const all = getTeethForView(view as "permanent" | "deciduous" | "mixed");
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

function layoutArch(teeth: ToothId[], y: number, notation: Notation): ToothLayout[] {
  const totalWidth = teeth.length * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
  const startX = -totalWidth / 2;

  return teeth.map((tooth, i) => ({
    tooth,
    x: startX + i * (TOOTH_WIDTH + TOOTH_GAP),
    y,
    label: toNotation(tooth, notation),
  }));
}

function isSurfaceSelected(ctx: ViewRenderContext, tooth: ToothId, surface: SurfaceId): boolean {
  const { selection } = ctx.state;
  if (selection.teeth.includes(tooth)) return true;
  return selection.surfaces.some((s) => s.tooth === tooth && s.surface === surface);
}

function getMarkForSurface(
  marks: OdontographicMark[],
  tooth: ToothId,
  surface: SurfaceId,
): OdontographicMark | undefined {
  return marks.find((m) => m.tooth === tooth && m.surfaces.includes(surface));
}

function normalizeClassNames(input: string | string[] | undefined): string {
  if (!input) return "";
  return Array.isArray(input) ? input.join(" ") : input;
}

/** Create SVG path for a graphic face region within a tooth box. */
export function createFacePath(face: GraphicFace, x: number, y: number): string {
  const w = TOOTH_WIDTH;
  const h = TOOTH_HEIGHT;
  const inset = SURFACE_INSET;

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

function renderMissingIndicator(
  toothGroup: SVGGElement,
  x: number,
  y: number,
): void {
  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", String(x + 8));
  line1.setAttribute("y1", String(y + 8));
  line1.setAttribute("x2", String(x + TOOTH_WIDTH - 8));
  line1.setAttribute("y2", String(y + TOOTH_HEIGHT - 8));
  line1.setAttribute("stroke", "#757575");
  line1.setAttribute("stroke-width", "2");
  toothGroup.appendChild(line1);

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", String(x + TOOTH_WIDTH - 8));
  line2.setAttribute("y1", String(y + 8));
  line2.setAttribute("x2", String(x + 8));
  line2.setAttribute("y2", String(y + TOOTH_HEIGHT - 8));
  line2.setAttribute("stroke", "#757575");
  line2.setAttribute("stroke-width", "2");
  toothGroup.appendChild(line2);
}

function applyPresenceStyle(
  element: SVGElement,
  presence: ToothPresence,
): void {
  if (presence === "missing") {
    element.setAttribute("opacity", "0.35");
  } else if (presence === "unerupted") {
    element.setAttribute("stroke-dasharray", "4 3");
    element.setAttribute("opacity", "0.7");
  }
}

export function renderSchematicView(ctx: ViewRenderContext): void {
  const { el, options, state } = ctx;
  const notation = (options.notation ?? "fdi") as Notation;
  const view = state.view as "permanent" | "deciduous" | "mixed";

  const upperTeeth = getArchTeeth(view, "upper");
  const lowerTeeth = getArchTeeth(view, "lower");
  const upperLayout = layoutArch(upperTeeth, 0, notation);
  const lowerLayout = layoutArch(lowerTeeth, TOOTH_HEIGHT + ARCH_GAP, notation);
  const allLayout = [...upperLayout, ...lowerLayout];
  const maxTeeth = Math.max(upperTeeth.length, lowerTeeth.length);
  const svgWidth = maxTeeth * (TOOTH_WIDTH + TOOTH_GAP);
  const svgHeight = TOOTH_HEIGHT * 2 + ARCH_GAP + 30;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "odontogram-svg");
  svg.setAttribute("viewBox", `${-svgWidth / 2} -10 ${svgWidth} ${svgHeight}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.display = "block";

  const toothColor = options.toothColor ?? "#f5f5f5";
  const surfaceColor = options.surfaceColor ?? "#e0e0e0";
  const selectionColor = options.selectionColor ?? "#90caf9";
  const markColors = options.markColors ?? {};

  for (const layout of allLayout) {
    const { tooth, x, y, label } = layout;
    const presence = getToothPresence(state.teeth, tooth);
    const toothGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    toothGroup.setAttribute("class", "odontogram-tooth");
    toothGroup.setAttribute("data-tooth", tooth);
    toothGroup.setAttribute("data-presence", presence);

    const isToothSelected = state.selection.teeth.includes(tooth);
    const toothClassNames = normalizeClassNames(
      options.toothClassNames?.({ tooth, isSelected: isToothSelected }),
    );
    if (toothClassNames) {
      toothGroup.setAttribute("class", `odontogram-tooth ${toothClassNames}`);
    }

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", String(x));
    bg.setAttribute("y", String(y));
    bg.setAttribute("width", String(TOOTH_WIDTH));
    bg.setAttribute("height", String(TOOTH_HEIGHT));
    bg.setAttribute("rx", "4");
    bg.setAttribute("fill", isToothSelected ? selectionColor : toothColor);
    bg.setAttribute("stroke", "#999");
    bg.setAttribute("stroke-width", "1");
    bg.style.cursor = "pointer";
    applyPresenceStyle(bg, presence);
    bg.addEventListener("click", (e) => {
      ctx.selectTooth(tooth);
      ctx.emitToothClick(tooth, e);
    });
    toothGroup.appendChild(bg);

    if (presence === "missing") {
      renderMissingIndicator(toothGroup, x, y);
    } else {
      const applicableSurfaces = getApplicableSurfaces(tooth);
      for (const surface of applicableSurfaces) {
        const face = mapSurfaceToFace(tooth, surface);
        const surfaceGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        surfaceGroup.setAttribute("class", `odontogram-surface odontogram-surface-${surface}`);
        surfaceGroup.setAttribute("data-tooth", tooth);
        surfaceGroup.setAttribute("data-surface", surface);
        surfaceGroup.setAttribute("data-face", face);

        const selected = isSurfaceSelected(ctx, tooth, surface);
        const mark = getMarkForSurface(state.marks, tooth, surface);

        let fill = surfaceColor;
        if (mark) {
          fill = mark.style?.fill ?? markColors[mark.type] ?? "#ef5350";
        }
        if (selected) {
          fill = selectionColor;
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", createFacePath(face, x, y));
        path.setAttribute("fill", fill);
        path.setAttribute("stroke", mark?.style?.stroke ?? "#bbb");
        path.setAttribute("stroke-width", String(mark?.style?.strokeWidth ?? 0.5));
        if (mark?.style?.opacity !== undefined) {
          path.setAttribute("opacity", String(mark.style.opacity));
        }
        applyPresenceStyle(path, presence);
        path.style.cursor = "pointer";
        path.addEventListener("click", (e) => {
          ctx.toggleSurfaceSelection(tooth, surface);
          ctx.emitSurfaceClick(tooth, surface, e);
        });
        surfaceGroup.appendChild(path);

        if (mark) {
          const markClassNames = normalizeClassNames(options.markClassNames?.({ mark }));
          if (markClassNames) {
            surfaceGroup.setAttribute(
              "class",
              `odontogram-surface odontogram-surface-${surface} ${markClassNames}`,
            );
          }
          options.markDidMount?.({ mark, el: surfaceGroup });
        }

        toothGroup.appendChild(surfaceGroup);
      }
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(x + TOOTH_WIDTH / 2));
    text.setAttribute("y", String(y + TOOTH_HEIGHT + 14));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "10");
    text.setAttribute("fill", "#333");
    text.textContent = label;
    toothGroup.appendChild(text);

    options.toothDidMount?.({ tooth, el: toothGroup });
    svg.appendChild(toothGroup);
  }

  el.appendChild(svg);
}

export function destroySchematicView(ctx: ViewRenderContext): void {
  const { options, state } = ctx;
  const view = state.view as "permanent" | "deciduous" | "mixed";
  const upperTeeth = getArchTeeth(view, "upper");
  const lowerTeeth = getArchTeeth(view, "lower");
  const allTeeth = [...upperTeeth, ...lowerTeeth];

  for (const tooth of allTeeth) {
    const toothEl = ctx.el.querySelector(`[data-tooth="${tooth}"]`);
    if (toothEl) {
      options.toothWillUnmount?.({ tooth, el: toothEl });
    }
  }

  for (const mark of state.marks) {
    for (const surface of mark.surfaces) {
      const markEl = ctx.el.querySelector(
        `[data-tooth="${mark.tooth}"][data-surface="${surface}"]`,
      );
      if (markEl) {
        options.markWillUnmount?.({ mark, el: markEl });
      }
    }
  }
}
