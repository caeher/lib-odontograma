import { createPlugin } from "@odontogram/core";
import {
  destroySchematicView,
  renderSchematicView,
  updateSchematicView,
} from "./schematic-view.js";

export const svgPlugin = createPlugin({
  name: "odontogram-svg",
  views: [
    {
      type: "permanent",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "deciduous",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "primary",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "mixed",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "arch",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "upper",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "lower",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "maxillary",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "mandibular",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-1",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-2",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-3",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-4",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-5",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-6",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-7",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "quadrant-8",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "tooth",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "tooth-detail",
      render: renderSchematicView,
      update: updateSchematicView,
      destroy: destroySchematicView,
    },
  ],
});

export {
  renderSchematicView,
  updateSchematicView,
  destroySchematicView,
  createFacePath,
  getArchTeeth,
  layoutArch,
  computeMixedLayout,
  computeViewLayout,
  resolveMarkFill,
  type ToothLayout,
} from "./schematic-view.js";

export { IncrementalSvgRenderer } from "./incremental-renderer.js";
