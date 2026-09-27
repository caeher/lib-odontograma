import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Odontogram } from "@odontogram/core";
import { svgPlugin } from "./index.js";
import { printOdontogram } from "./export.js";

describe("Stage 07 · Interoperability: Standalone SVG, PNG & Print Export", () => {
  let container: HTMLElement;
  let odontogram: Odontogram;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    odontogram = new Odontogram(container, {
      plugins: [svgPlugin],
      initialView: "permanent",
      notation: "fdi",
    });
    odontogram.render();
  });

  afterEach(() => {
    odontogram.destroy();
    container.remove();
  });

  describe("Standalone SVG Export (`exportSvg`)", () => {
    it("generates a valid standalone SVG with namespace, viewBox, and inlined styles", () => {
      const svgString = odontogram.exportSvg();

      expect(svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svgString).toContain('viewBox="');
      expect(svgString).toContain("<style>");
      expect(svgString).toContain("</style>");
      expect(svgString).toContain("font-family: system-ui");
      expect(svgString).toContain('role="img"');
    });

    it("strictly excludes edit toolbars, interactive buttons, scripts, and screen-reader live regions", () => {
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      odontogram.selectTooth("16");

      const svgString = odontogram.exportSvg();

      // No HTML edit controls
      expect(svgString).not.toContain("odontogram-toolbar");
      expect(svgString).not.toContain("<button");
      expect(svgString).not.toContain("<select");
      expect(svgString).not.toContain("<script");
      expect(svgString).not.toContain("odontogram-sr-only");
      expect(svgString).not.toContain("aria-live");

      // Transient selection excluded by default
      expect(svgString).not.toContain('aria-selected="true"');
    });

    it("includes transient visual selection when explicitly requested via includeSelection: true", () => {
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      odontogram.selectTooth("16");

      const svgString = odontogram.exportSvg({ includeSelection: true });
      expect(svgString).toContain('data-tooth="16"');
      // Selection color #90caf9 is applied to the outline
      expect(svgString).toContain("#90caf9");
    });

    it("renders consumer-supplied chart title at the top of the exported SVG", () => {
      const svgString = odontogram.exportSvg({ title: "Maxillary & Mandibular Chart" });

      expect(svgString).toContain("Maxillary &amp; Mandibular Chart");
      expect(svgString).toContain('class="odontogram-export-title"');
    });

    it("renders vector legend swatches when legend option is enabled", () => {
      odontogram.addMarks([
        { id: "m1", tooth: "16", surfaces: ["O"], type: "caries", status: "existing" },
        { id: "m2", tooth: "26", surfaces: ["M", "O"], type: "restoration", status: "completed" },
      ]);

      const svgString = odontogram.exportSvg({ legend: true });

      expect(svgString).toContain('class="odontogram-export-legend"');
      expect(svgString).toContain("caries");
      expect(svgString).toContain("restoration");
    });
  });

  describe("Tooth Notations & Anatomical Orientation", () => {
    it("renders FDI tooth numbers by default and supports Universal and Palmer notation overrides", () => {
      // FDI
      const fdiSvg = odontogram.exportSvg({ notation: "fdi" });
      expect(fdiSvg).toContain(">16<");
      expect(fdiSvg).toContain(">26<");

      // Universal
      const univSvg = odontogram.exportSvg({ notation: "universal" });
      expect(univSvg).toContain(">3<"); // FDI 16 -> Universal 3
      expect(univSvg).toContain(">14<"); // FDI 26 -> Universal 14

      // Palmer
      const palmerSvg = odontogram.exportSvg({ notation: "palmer" });
      expect(palmerSvg).toContain("6┘"); // FDI 16 -> Palmer 6┘ (UR6)
      expect(palmerSvg).toContain("└6"); // FDI 26 -> Palmer └6 (UL6)
    });

    it("renders patient orientation badges (R on left, L on right) and anatomical midline divider", () => {
      const svgString = odontogram.exportSvg();

      expect(svgString).toContain("R (Patient Right)");
      expect(svgString).toContain("L (Patient Left)");
      expect(svgString).toContain('class="odontogram-midline-line"');
      expect(svgString).toContain("Midline");
    });
  });

  describe("Clinical Mark Fidelity & Multi-Tooth Annotations", () => {
    it("renders multiple marks on a single tooth with correct clinical fills", () => {
      odontogram.addMarks([
        { id: "m1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m2", tooth: "16", surfaces: ["M"], type: "restoration" },
      ]);

      const svgString = odontogram.exportSvg();
      expect(svgString).toContain('data-tooth="16"');
      expect(svgString).toContain("#ef5350"); // caries red
      expect(svgString).toContain("odontogram-surface-path");
    });

    it("renders missing tooth presence with diagonal cross indicators and omits surface paths", () => {
      odontogram.setToothState("16", "missing");

      const svgString = odontogram.exportSvg();
      expect(svgString).toContain('data-tooth="16" data-presence="missing"');
      expect(svgString).toContain('class="odontogram-missing-indicator"');
    });

    it("renders multi-tooth annotations (e.g. 3-unit bridge) across targeted teeth", () => {
      odontogram.addMark({
        id: "bridge-1",
        type: "bridge",
        status: "planned",
        target: {
          teeth: ["14", "15", "16"],
          targets: [
            { tooth: "14", role: "support" },
            { tooth: "15", role: "pontic" },
            { tooth: "16", role: "support" },
          ],
        },
      });

      const svgString = odontogram.exportSvg();
      expect(svgString).toContain('class="odontogram-layer-annotations"');
      expect(svgString).toContain("odontogram-annotation-bridge");
    });
  });

  describe("Themes & Color Tokens (Light, Dark, Print)", () => {
    it("supports Light theme with transparent or custom white background", () => {
      const lightSvg = odontogram.exportSvg({ theme: "light", background: "#ffffff" });
      expect(lightSvg).toContain('fill="#ffffff"');
      expect(lightSvg).toContain("theme-light");
    });

    it("supports Dark theme with dark background and high-contrast text", () => {
      const darkSvg = odontogram.exportSvg({ theme: "dark" });
      expect(darkSvg).toContain('fill="#1e1e1e"');
      expect(darkSvg).toContain("theme-dark");
      expect(darkSvg).toContain("#e2e8f0"); // light text
    });

    it("supports Print theme with pure white background and black line accents", () => {
      const printSvg = odontogram.exportSvg({ theme: "print" });
      expect(printSvg).toContain('fill="#ffffff"');
      expect(printSvg).toContain("theme-print");
      expect(printSvg).toContain("print-color-adjust: exact;");
    });
  });

  describe("Scope Handling (`scope?: 'current' | 'full' | ViewType`)", () => {
    it("exports current view by default and allows exporting a different scope without mutating instance state", () => {
      expect(odontogram.getState().view).toBe("permanent");

      // Export upper arch specifically
      const upperSvg = odontogram.exportSvg({ scope: "upper" });
      expect(upperSvg).toContain('data-tooth="11"');
      expect(upperSvg).toContain('data-tooth="21"');
      expect(upperSvg).not.toContain('data-tooth="41"'); // lower tooth omitted in upper view

      // Instance state remains permanently on active view
      expect(odontogram.getState().view).toBe("permanent");
    });

    it("exports quadrant and single-tooth detail views with specialized layouts and surface letterings", () => {
      // Quadrant 1
      const q1Svg = odontogram.exportSvg({ scope: "quadrant-1" });
      expect(q1Svg).toContain('data-tooth="11"');
      expect(q1Svg).toContain('data-tooth="18"');
      expect(q1Svg).not.toContain('data-tooth="21"');

      // Tooth detail
      const detailSvg = odontogram.exportSvg({ scope: "tooth-16" });
      expect(detailSvg).toContain('data-tooth="16"');
      expect(detailSvg).toContain("odontogram-surface-label");
    });
  });

  describe("Raster PNG Export (`exportPng`)", () => {
    it("exports PNG with configurable scale multiplier and returns a Blob or data URL", async () => {
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });

      const pngDataUrl = await odontogram.exportPng({ scale: 2, format: "data-url" });
      expect(typeof pngDataUrl).toBe("string");
      expect(typeof pngDataUrl === "string" && pngDataUrl.startsWith("data:image/")).toBe(true);
    });

    it("supports opaque and transparent backgrounds for PNG exports", async () => {
      const opaquePng = await odontogram.exportPng({ background: "#ffffff", format: "data-url" });
      expect(typeof opaquePng).toBe("string");
    });
  });

  describe("Print Layout & Browser PDF Printing (`print` and `getPrintMarkup`)", () => {
    it("generates print markup with consumer title, subtitle, SVG chart, and legend", () => {
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });

      const markup = odontogram.getPrintMarkup({
        title: "Clinical Dental Examination",
        subtitle: "Maxillary & Mandibular Overview",
        margins: "15mm",
      });

      expect(markup).toContain("Clinical Dental Examination");
      expect(markup).toContain("Maxillary &amp; Mandibular Overview");
      expect(markup).toContain('class="odontogram-print-container"');
      expect(markup).toContain('style="padding: 15mm;"');
      expect(markup).toContain("<svg");
    });

    it("executes printOdontogram and cleans up after printing", () => {
      const result = printOdontogram(odontogram, {
        title: "Patient Odontogram",
        autoPrint: false, // Don't trigger actual window.print() in vitest
      });

      expect(result.container).toBeDefined();
      expect(result.svgElement).toBeDefined();
      expect(document.body.contains(result.container)).toBe(true);

      result.cleanup();
      expect(document.body.contains(result.container)).toBe(false);
    });
  });
});
