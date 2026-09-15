import { createPlugin } from "@odontogram/core";
import { destroySchematicView, renderSchematicView } from "./schematic-view.js";

export const svgPlugin = createPlugin({
  name: "odontogram-svg",
  views: [
    {
      type: "permanent",
      render: renderSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "deciduous",
      render: renderSchematicView,
      destroy: destroySchematicView,
    },
    {
      type: "mixed",
      render: renderSchematicView,
      destroy: destroySchematicView,
    },
  ],
});

export { renderSchematicView, destroySchematicView } from "./schematic-view.js";
