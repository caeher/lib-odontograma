import type { ViewRenderContext } from "@odontogram/core";
import {
  IncrementalSvgRenderer,
  TOOTH_WIDTH,
  TOOTH_HEIGHT,
  TOOTH_GAP,
  ARCH_GAP,
  SURFACE_INSET,
  createFacePath,
  getArchTeeth,
  layoutArch,
  computeMixedLayout,
  computeViewLayout,
  resolveMarkFill,
  type ToothLayout,
} from "./incremental-renderer.js";

export {
  TOOTH_WIDTH,
  TOOTH_HEIGHT,
  TOOTH_GAP,
  ARCH_GAP,
  SURFACE_INSET,
  createFacePath,
  getArchTeeth,
  layoutArch,
  computeMixedLayout,
  computeViewLayout,
  resolveMarkFill,
  type ToothLayout,
};

const rendererRegistry = new WeakMap<HTMLElement, IncrementalSvgRenderer>();

export function renderSchematicView(ctx: ViewRenderContext): void {
  let renderer = rendererRegistry.get(ctx.el);
  if (!renderer) {
    renderer = new IncrementalSvgRenderer(ctx.options.instanceId);
    rendererRegistry.set(ctx.el, renderer);
  }
  renderer.render(ctx);
}

export function updateSchematicView(ctx: ViewRenderContext): void {
  const renderer = rendererRegistry.get(ctx.el);
  if (renderer) {
    renderer.update(ctx);
  } else {
    renderSchematicView(ctx);
  }
}

export function destroySchematicView(ctx: ViewRenderContext): void {
  const renderer = rendererRegistry.get(ctx.el);
  if (renderer) {
    renderer.destroy(ctx);
    rendererRegistry.delete(ctx.el);
  }
}
