import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import { OdontogramError } from "./errors.js";

describe("Stage 07 · Interoperability: Core Export APIs", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("throws error when attempting exportSvg on an instance without a registered view implementation", () => {
    const odontogram = new Odontogram(container); // No plugins registered
    expect(() => odontogram.exportSvg()).toThrowError(OdontogramError);
    expect(() => odontogram.exportSvg()).toThrow(/No view implementation registered/);
  });

  it("delegates exportSvg to registered plugin view definition", () => {
    const mockViewPlugin = createPlugin({
      id: "@test/mock-view",
      version: "1.0.0",
      apiCompatibility: "^1.0.0",
      views: [
        {
          type: "permanent",
          render: () => {},
          exportSvg: (_ctx, options) => {
            return `<svg xmlns="http://www.w3.org/2000/svg"><title>${options?.title ?? "Mock"}</title></svg>`;
          },
        },
      ],
    });

    const odontogram = new Odontogram(container, {
      plugins: [mockViewPlugin],
    });

    const svg = odontogram.exportSvg({ title: "Custom Title" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("<title>Custom Title</title>");
  });

  it("generates print markup using getPrintMarkup", () => {
    const mockViewPlugin = createPlugin({
      id: "@test/mock-view",
      version: "1.0.0",
      apiCompatibility: "^1.0.0",
      views: [
        {
          type: "permanent",
          render: () => {},
          exportSvg: () => `<svg xmlns="http://www.w3.org/2000/svg"><g id="chart"></g></svg>`,
        },
      ],
    });

    const odontogram = new Odontogram(container, {
      plugins: [mockViewPlugin],
    });

    const markup = odontogram.getPrintMarkup({
      title: "Dental Print Document",
      subtitle: "Chart Examination",
    });

    expect(markup).toContain("Dental Print Document");
    expect(markup).toContain("Chart Examination");
    expect(markup).toContain('<div class="odontogram-print-container"');
    expect(markup).toContain("<svg");
  });

  it("executes print() and creates print container overlay", () => {
    const mockViewPlugin = createPlugin({
      id: "@test/mock-view",
      version: "1.0.0",
      apiCompatibility: "^1.0.0",
      views: [
        {
          type: "permanent",
          render: () => {},
          exportSvg: () => `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
        },
      ],
    });

    const odontogram = new Odontogram(container, {
      plugins: [mockViewPlugin],
    });

    // Run print with autoPrint: false to prevent window.print dialog in test
    odontogram.print({ title: "Print Title", autoPrint: false });

    const overlay = document.querySelector(".odontogram-print-overlay");
    expect(overlay).toBeDefined();
    expect(overlay?.textContent).toContain("Print Title");
    overlay?.remove();
  });
});
