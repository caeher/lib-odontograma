import type { ViewRenderContext, SurfaceId, ToothId, OdontographicMark } from "@odontogram/core";
import { getTeethForView, toNotation, type Notation } from "@odontogram/dentition";
import { SURFACE_CODES } from "@odontogram/dentition";

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

function getArchTeeth(view: string, arch: "upper" | "lower"): ToothId[] {
  const all = getTeethForView(view as "permanent" | "deciduous" | "mixed");
  const filtered = all.filter((t) => {
    const q = parseInt(t.charAt(0), 10);
    if (arch === "upper") return q <= 2 || q === 5 || q === 6;
    return q >= 3 && q !== 5 && q !== 6;
  });

  if (arch === "upper") {
    const right = filtered.filter((t) => {
      const q = parseInt(t.charAt(0), 10);
      return q === 1 || q === 5;
    }).reverse();
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
  const left = filtered.filter((t) => {
    const q = parseInt(t.charAt(0), 10);
    return q === 3 || q === 7;
  }).reverse();
  return [...right, ...left];
}

function layoutArch(
  teeth: ToothId[],
  y: number,
  notation: Notation,
): ToothLayout[] {
  const totalWidth = teeth.length * (TOOTH_WIDTH + TOOTH_GAP) - TOOTH_GAP;
  const startX = -totalWidth / 2;

  return teeth.map((tooth, i) => ({
    tooth,
    x: startX + i * (TOOTH_WIDTH + TOOTH_GAP),
    y,
    label: toNotation(tooth, notation),
  }));
}

function isSurfaceSelected(
  ctx: ViewRenderContext,
  tooth: ToothId,
  surface: SurfaceId,
): boolean {
  const { selection } = ctx.state;
  if (selection.teeth.includes(tooth)) return true;
  return selection.surfaces.some((s) => s.tooth === tooth && s.surface === surface);
}

function getMarkForSurface(
  marks: OdontographicMark[],
  tooth: ToothId,
  surface: SurfaceId,
): OdontographicMark | undefined {
  return marks.find(
    (m) => m.tooth === tooth && m.surfaces.includes(surface),
  );
}

function normalizeClassNames(input: string | string[] | undefined): string {
  if (!input) return "";
  return Array.isArray(input) ? input.join(" ") : input;
}

function createSurfacePath(
  surface: SurfaceId,
  x: number,
  y: number,
): string {
  const w = TOOTH_WIDTH;
  const h = TOOTH_HEIGHT;
  const inset = SURFACE_INSET;

  switch (surface) {
    case "O":
      return `M ${x + inset} ${y + inset} L ${x + w - inset} ${y + inset} L ${x + w - inset} ${y + h - inset} L ${x + inset} ${y + h - inset} Z`;
    case "M":
      return `M ${x} ${y + inset} L ${x + inset} ${y + inset} L ${x + inset} ${y + h - inset} L ${x} ${y + h - inset} Z`;
    case "D":
      return `M ${x + w - inset} ${y + inset} L ${x + w} ${y + inset} L ${x + w} ${y + h - inset} L ${x + w - inset} ${y + h - inset} Z`;
    case "B":
      return `M ${x + inset} ${y} L ${x + w - inset} ${y} L ${x + w - inset} ${y + inset} L ${x + inset} ${y + inset} Z`;
    case "L":
      return `M ${x + inset} ${y + h - inset} L ${x + w - inset} ${y + h - inset} L ${x + w - inset} ${y + h} L ${x + inset} ${y + h} Z`;
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
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
    const toothGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    toothGroup.setAttribute("class", "odontogram-tooth");
    toothGroup.setAttribute("data-tooth", tooth);

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
    bg.addEventListener("click", (e) => {
      ctx.selectTooth(tooth);
      ctx.emitToothClick(tooth, e);
    });
    toothGroup.appendChild(bg);

    for (const surface of SURFACE_CODES) {
      const surfaceGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      surfaceGroup.setAttribute("class", `odontogram-surface odontogram-surface-${surface}`);
      surfaceGroup.setAttribute("data-tooth", tooth);
      surfaceGroup.setAttribute("data-surface", surface);

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
      path.setAttribute("d", createSurfacePath(surface, x, y));
      path.setAttribute("fill", fill);
      path.setAttribute("stroke", mark?.style?.stroke ?? "#bbb");
      path.setAttribute("stroke-width", String(mark?.style?.strokeWidth ?? 0.5));
      if (mark?.style?.opacity !== undefined) {
        path.setAttribute("opacity", String(mark.style.opacity));
      }
      path.style.cursor = "pointer";
      path.addEventListener("click", (e) => {
        ctx.toggleSurfaceSelection(tooth, surface);
        ctx.emitSurfaceClick(tooth, surface, e);
      });
      surfaceGroup.appendChild(path);

      if (mark) {
        const markClassNames = normalizeClassNames(
          options.markClassNames?.({ mark }),
        );
        if (markClassNames) {
          surfaceGroup.setAttribute("class", `odontogram-surface odontogram-surface-${surface} ${markClassNames}`);
        }
        options.markDidMount?.({ mark, el: surfaceGroup });
      }

      toothGroup.appendChild(surfaceGroup);
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
