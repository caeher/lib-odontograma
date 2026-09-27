import { createPlugin } from "@odontogram/core";

/**
 * Optional example extension. Applications can dynamically import this module
 * only on screens that need bridge annotation support.
 */
export const customBridgePlugin = createPlugin({
  id: "@example/odontogram-bridge",
  version: "1.0.0",
  apiCompatibility: "^1.0.0",
  dependencies: [{ id: "@odontogram/svg", version: "^0.1.0" }],
  dentalRenderers: [
    {
      id: "example-molar-fissure",
      matches: (tooth) => tooth === "16" || tooth === "26" || tooth === "36" || tooth === "46",
      render: ({ element, bounds }) => {
        const fissure = document.createElementNS("http://www.w3.org/2000/svg", "path");
        fissure.setAttribute(
          "d",
          `M ${bounds.x + bounds.width * 0.5} ${bounds.y + bounds.height * 0.28} v ${bounds.height * 0.44}`,
        );
        fissure.setAttribute("stroke", "#795548");
        fissure.setAttribute("stroke-width", "1.5");
        fissure.setAttribute("class", "example-molar-fissure");
        element.append(fissure);
      },
    },
  ],
  symbols: [
    {
      id: "example-bridge-symbol",
      markTypes: ["bridge"],
      render: ({ element, targets, color, selected }) => {
        if (targets.length < 2) return;
        const connector = document.createElementNS("http://www.w3.org/2000/svg", "path");
        connector.setAttribute(
          "d",
          targets.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" "),
        );
        connector.setAttribute("stroke", color);
        connector.setAttribute("stroke-width", selected ? "5" : "3");
        connector.setAttribute("stroke-linecap", "round");
        connector.setAttribute("fill", "none");
        connector.setAttribute("class", "example-bridge-symbol");
        element.append(connector);
      },
    },
  ],
  tools: [
    {
      id: "example-apply-bridge",
      label: "Apply bridge",
      disabled: ({ state, disabled, readOnly }) =>
        disabled || readOnly || state.selection.teeth.length < 2,
      onActivate: ({ executeCommand }) => {
        executeCommand({
          type: "apply-mark",
          mark: { type: "bridge", status: "planned" },
        });
      },
    },
  ],
});
