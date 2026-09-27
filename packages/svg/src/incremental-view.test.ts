import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Odontogram } from "@odontogram/core";
import { svgPlugin } from "./index.js";
import notationsFixture from "../../dentition/fixtures/notations.json";
import orientationFixture from "../../dentition/fixtures/orientation.json";

describe("Stage 03 · Incremental SVG View & Representation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "odontogram-test-container";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  describe("consumer customization hooks and resources", () => {
    it("updates custom surface content and disposes mounted custom content", () => {
      const surfaceDidMount = vi.fn(() => vi.fn());
      const surfaceWillUnmount = vi.fn();
      const ownedNode = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        surfaceClassNames: ({ surface }) => `custom-${surface}`,
        surfaceContent: ({ isSelected }) => (isSelected ? "selected" : "idle"),
        toothLabelClassNames: () => "app-tooth-label",
        toothLabelContent: ({ label }) => `${label}!`,
        surfaceDidMount,
        surfaceWillUnmount,
        toothContent: () => ownedNode,
      });
      odontogram.render();

      const surface = container.querySelector<SVGGElement>(
        '.odontogram-surface[data-tooth="16"][data-surface="O"]',
      )!;
      expect(surface.classList.contains("custom-O")).toBe(true);
      expect(surface.textContent).toContain("idle");
      expect(ownedNode.parentNode).toBeNull();
      const label = container.querySelector<SVGTextElement>(
        '.odontogram-tooth[data-tooth="16"] [data-role="label"]',
      )!;
      expect(label.textContent).toBe("16!");
      expect(label.classList.contains("app-tooth-label")).toBe(true);
      odontogram.setOption("notation", "universal");
      expect(label.textContent).toBe("3!");
      surface.querySelector("path")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(surface.textContent).toContain("selected");
      expect(surfaceDidMount).toHaveBeenCalled();

      odontogram.destroy();
      expect(surfaceWillUnmount).toHaveBeenCalledWith(
        expect.objectContaining({ tooth: "16", surface: "O" }),
      );
      expect(
        surfaceDidMount.mock.results.some((result) => result.value.mock.calls.length > 0),
      ).toBe(true);
    });

    it("renders contract SVG anatomy while preserving native selection surface identity", () => {
      const svgResource = readFileSync(
        resolve(process.cwd(), "packages/svg/fixtures/contract/valid-molar-occlusal.svg"),
        "utf8",
      );
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        toothResources: { "16": svgResource },
        instanceId: "custom-resource",
      });
      odontogram.render();

      const originalSurface = container.querySelector<SVGGElement>(
        "#custom-resource-tooth-16-surface-O",
      )!;
      expect(
        container.querySelector(
          ".odontogram-tooth-resource #custom-resource-tooth-16-resource-tooth-outline",
        ),
      ).toBeTruthy();
      originalSurface
        .querySelector("path")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(odontogram.getSelection().surfaces).toContainEqual({ tooth: "16", surface: "O" });
      expect(container.querySelector("#custom-resource-tooth-16-surface-O")).toBe(originalSurface);
      odontogram.destroy();
    });

    it("mounts and unmounts custom annotation content with cleanup", () => {
      const cleanup = vi.fn();
      const annotationDidMount = vi.fn(() => cleanup);
      const annotationWillUnmount = vi.fn();
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        annotationClassNames: () => "app-annotation",
        annotationContent: () => "Consumer note",
        annotationDidMount,
        annotationWillUnmount,
      });
      odontogram.render();
      odontogram.addMark({
        id: "custom-bridge",
        type: "bridge",
        target: { kind: "teeth", teeth: ["14", "15"] },
      });
      const annotation = container.querySelector<SVGGElement>('[data-mark-id="custom-bridge"]')!;
      expect(annotation.classList.contains("app-annotation")).toBe(true);
      expect(annotation.textContent).toContain("Consumer note");
      expect(annotationDidMount).toHaveBeenCalledOnce();

      odontogram.addMark({
        id: "custom-filling",
        type: "restoration",
        target: { tooth: "16", surfaces: ["O"] },
      });
      const fillingSurface = container.querySelector<SVGGElement>(
        '.odontogram-surface[data-tooth="16"][data-surface="O"]',
      )!;
      expect(fillingSurface.textContent).toContain("Consumer note");
      expect(annotationDidMount).toHaveBeenCalledTimes(2);

      odontogram.removeMark("custom-bridge");
      expect(cleanup).toHaveBeenCalledOnce();
      expect(annotationWillUnmount).toHaveBeenCalledOnce();
      odontogram.removeMark("custom-filling");
      expect(cleanup).toHaveBeenCalledTimes(2);
      expect(annotationWillUnmount).toHaveBeenCalledTimes(2);
      odontogram.destroy();
    });

    it("falls back explicitly for incomplete resources and can reject them", () => {
      const incomplete = '<svg viewBox="0 0 44 52"><g id="layer-anatomy"/></svg>';
      const fallback = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        toothResources: { "16": incomplete },
      });
      fallback.render();
      expect(container.querySelector('.odontogram-tooth[data-tooth="16"]')).toBeTruthy();
      expect(container.querySelector(".odontogram-tooth-resource")).toBeNull();
      fallback.destroy();

      const strict = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        toothResources: { "16": incomplete },
        toothResourceFallback: "error",
      });
      expect(() => strict.render()).toThrow(/Invalid SVG resource for tooth 16/);
    });
  });

  // ==========================================================================
  // 1. Arches, Quadrants, Teeth, Surfaces, Labels & Annotation Layers
  // ==========================================================================
  describe("DOM Hierarchy, Contract Layers & Stable Identity", () => {
    it("renders arches, quadrants, and contract layers with stable identity", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        instanceId: "test-chart-1",
      });
      odontogram.render();

      const svg = container.querySelector("svg.odontogram-svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("data-instance-id")).toBe("test-chart-1-");
      expect(svg?.getAttribute("role")).toBe("group");

      // Defs
      const defs = svg?.querySelector("defs#test-chart-1-defs");
      expect(defs).toBeTruthy();
      expect(defs?.querySelector("#test-chart-1-pattern-hatch")).toBeTruthy();

      // Multi-tooth Annotation Layer
      const annotationsLayer = svg?.querySelector(".odontogram-layer-annotations");
      expect(annotationsLayer).toBeTruthy();
      expect(annotationsLayer?.getAttribute("id")).toBe("test-chart-1-layer-annotations");

      // Arches
      const upperArch = svg?.querySelector(".odontogram-arch-upper");
      const lowerArch = svg?.querySelector(".odontogram-arch-lower");
      expect(upperArch).toBeTruthy();
      expect(lowerArch).toBeTruthy();
      expect(upperArch?.getAttribute("data-arch")).toBe("upper");
      expect(lowerArch?.getAttribute("data-arch")).toBe("lower");

      // Quadrants
      expect(svg?.querySelector(".odontogram-quadrant-1")).toBeTruthy();
      expect(svg?.querySelector(".odontogram-quadrant-2")).toBeTruthy();
      expect(svg?.querySelector(".odontogram-quadrant-3")).toBeTruthy();
      expect(svg?.querySelector(".odontogram-quadrant-4")).toBeTruthy();

      // Tooth contract layers for FDI 16
      const tooth16 = svg?.querySelector('.odontogram-tooth[data-tooth="16"]');
      expect(tooth16).toBeTruthy();
      expect(tooth16?.getAttribute("id")).toBe("test-chart-1-tooth-16");
      expect(tooth16?.getAttribute("data-quadrant")).toBe("1");
      expect(tooth16?.getAttribute("data-arch")).toBe("upper");
      expect(tooth16?.getAttribute("tabindex")).toBe("-1");
      expect(
        svg?.querySelector('.odontogram-tooth[data-tooth="11"]')?.getAttribute("tabindex"),
      ).toBe("0");

      expect(tooth16?.querySelector(".odontogram-layer-anatomy")).toBeTruthy();
      expect(tooth16?.querySelector(".odontogram-layer-interaction")).toBeTruthy();
      expect(tooth16?.querySelector(".odontogram-layer-focus")).toBeTruthy();
      expect(tooth16?.querySelector(".odontogram-layer-marks")).toBeTruthy();
      expect(tooth16?.querySelector(".odontogram-layer-labels")).toBeTruthy();

      // Surface element
      const occlusal16 = tooth16?.querySelector('.odontogram-surface[data-surface="O"]');
      expect(occlusal16).toBeTruthy();
      expect(occlusal16?.getAttribute("id")).toBe("test-chart-1-tooth-16-surface-O");
      expect(occlusal16?.getAttribute("data-face")).toBe("center");
      expect(occlusal16?.getAttribute("role")).toBe("button");

      odontogram.destroy();
    });

    it("renders multi-tooth annotations (e.g. bridge) in annotation layer", () => {
      const markDidMount = vi.fn();
      const markWillUnmount = vi.fn();

      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        instanceId: "inst-bridge",
        markDidMount,
        markWillUnmount,
      });
      odontogram.render();

      odontogram.addMark({
        id: "bridge-14-16",
        type: "bridge",
        status: "planned",
        target: { teeth: ["14", "15", "16"] },
        style: { stroke: "#1e88e5", strokeWidth: 4 },
      });

      const bridgeEl = container.querySelector(
        ".odontogram-layer-annotations .odontogram-annotation-bridge",
      );
      expect(bridgeEl).toBeTruthy();
      expect(bridgeEl?.getAttribute("data-mark-id")).toBe("bridge-14-16");
      expect(bridgeEl?.getAttribute("data-target-teeth")).toBe("14 15 16");
      expect(bridgeEl?.querySelector("path")).toBeTruthy();
      expect(bridgeEl?.querySelectorAll("circle").length).toBe(3);
      expect(markDidMount).toHaveBeenCalledWith(
        expect.objectContaining({ mark: expect.objectContaining({ id: "bridge-14-16" }) }),
      );

      // Remove bridge mark
      odontogram.removeMark("bridge-14-16");
      expect(container.querySelector(".odontogram-annotation-bridge")).toBeNull();
      expect(markWillUnmount).toHaveBeenCalledWith(
        expect.objectContaining({ mark: expect.objectContaining({ id: "bridge-14-16" }) }),
      );

      odontogram.destroy();
    });

    it("uses ordered support and pontic anchors and selects, edits, and removes one annotation", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        instanceId: "span-chart",
      });
      odontogram.render();
      odontogram.addMark({
        id: "span-14-16",
        type: "bridge",
        text: "Planned three-unit span",
        target: {
          kind: "teeth",
          teeth: ["14", "15", "16"],
          targets: [
            { tooth: "14", role: "support", anchor: "anchor-distal" },
            { tooth: "15", role: "pontic", anchor: "anchor-center" },
            { tooth: "16", role: "support", anchor: "anchor-mesial" },
          ],
        },
      });

      const annotation = container.querySelector<SVGGElement>('[data-mark-id="span-14-16"]')!;
      expect(annotation.getAttribute("data-target-teeth")).toBe("14 15 16");
      expect(annotation.getAttribute("aria-label")).toBe("Planned three-unit span");
      expect(annotation.querySelectorAll('[data-role="support"]').length).toBe(2);
      expect(annotation.querySelector('[data-role="pontic"]')?.getAttribute("data-tooth")).toBe(
        "15",
      );
      const anchorCoords = [
        ["14", "anchor-distal"],
        ["15", "anchor-center"],
        ["16", "anchor-mesial"],
      ].map(([tooth, anchor]) => {
        const point = container.querySelector<SVGCircleElement>(
          `.odontogram-tooth[data-tooth="${tooth}"] [data-contract-anchor="${anchor}"]`,
        )!;
        return [point.getAttribute("cx"), point.getAttribute("cy")].join(" ");
      });
      expect(annotation.querySelector("path")?.getAttribute("d")).toBe(
        `M ${anchorCoords[0]} L ${anchorCoords[1]} M ${anchorCoords[1]} L ${anchorCoords[2]}`,
      );

      annotation.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(odontogram.isAnnotationSelected("span-14-16")).toBe(true);
      expect(annotation.getAttribute("aria-pressed")).toBe("true");

      odontogram.updateMark("span-14-16", { text: "Updated span" });
      expect(annotation.getAttribute("aria-label")).toBe("Updated span");
      const permanentPath = annotation.querySelector("path")?.getAttribute("d");
      odontogram.changeView("quadrant-1");
      const quadrantPath = container
        .querySelector('[data-mark-id="span-14-16"] path')
        ?.getAttribute("d");
      expect(quadrantPath).not.toBe(permanentPath);
      odontogram.removeMark("span-14-16");
      expect(container.querySelector('[data-mark-id="span-14-16"]')).toBeNull();
      expect(odontogram.isAnnotationSelected("span-14-16")).toBe(false);
      odontogram.destroy();
    });

    it("keeps ordered target identity when targets are hidden or unavailable", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        visibleTeeth: ["14", "16"],
      });
      odontogram.render();
      odontogram.addMark({
        id: "partially-visible-span",
        type: "bridge",
        target: {
          teeth: ["14", "15", "16"],
          targets: [
            { tooth: "14", role: "support", anchor: "anchor-distal" },
            { tooth: "15", role: "pontic" },
            { tooth: "16", role: "support" },
          ],
        },
      });
      const annotation = container.querySelector<SVGGElement>(
        '[data-mark-id="partially-visible-span"]',
      )!;
      expect(annotation.getAttribute("data-target-teeth")).toBe("14 15 16");
      expect(annotation.getAttribute("data-visible-target-teeth")).toBe("14 16");
      expect(annotation.querySelectorAll("circle")).toHaveLength(2);
      expect(annotation.querySelector("path")).toBeNull();

      odontogram.changeView("tooth-detail", { tooth: "31" });
      const unavailable = container.querySelector<SVGGElement>(
        '[data-mark-id="partially-visible-span"]',
      )!;
      expect(unavailable.getAttribute("data-visible-target-teeth")).toBe("");
      expect(unavailable.getAttribute("aria-label")).toContain("bridge annotation");
      expect(unavailable.querySelector("path")).toBeNull();

      odontogram.removeMarksForTooth("15");
      expect(container.querySelector('[data-mark-id="partially-visible-span"]')).toBeNull();
      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 2. Incremental Updates & Preservation of Focus and Selection
  // ==========================================================================
  describe("Incremental DOM Updates & Focus Preservation", () => {
    it("updates only affected elements in place without destroying DOM nodes", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        instanceId: "inst-incr",
      });
      odontogram.render();

      const tooth16Before = container.querySelector('.odontogram-tooth[data-tooth="16"]');
      const tooth26Before = container.querySelector('.odontogram-tooth[data-tooth="26"]');
      const surface16OBefore = container.querySelector(
        '.odontogram-surface[data-tooth="16"][data-surface="O"]',
      );

      expect(tooth16Before).toBeTruthy();
      expect(tooth26Before).toBeTruthy();

      // 1. Mutate tooth 16 state by adding a mark on 16/O
      odontogram.addMark({
        id: "m-16-o",
        tooth: "16",
        surfaces: ["O"],
        type: "caries",
        style: { fill: "#f44336" },
      });

      const tooth16After = container.querySelector('.odontogram-tooth[data-tooth="16"]');
      const tooth26After = container.querySelector('.odontogram-tooth[data-tooth="26"]');
      const surface16OAfter = container.querySelector(
        '.odontogram-surface[data-tooth="16"][data-surface="O"]',
      );

      // Unaffected elements maintain strict reference equality
      expect(tooth16After).toBe(tooth16Before);
      expect(tooth26After).toBe(tooth26Before);
      expect(surface16OAfter).toBe(surface16OBefore);

      // Verify visual style update in place
      const path = surface16OAfter?.querySelector("path");
      expect(path?.getAttribute("fill")).toBe("#f44336");
      expect(surface16OAfter?.getAttribute("data-mark-ids")).toBe("m-16-o");

      // 2. Programmatically select tooth 26
      odontogram.selectTooth("26");

      expect(tooth26After?.getAttribute("aria-pressed")).toBe("true");
      expect(tooth16After?.getAttribute("aria-pressed")).toBe("false");
      expect(container.querySelector('.odontogram-tooth[data-tooth="26"]')).toBe(tooth26Before);

      odontogram.destroy();
    });

    it("preserves active DOM focus during state mutations", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        instanceId: "inst-focus",
      });
      odontogram.render();

      const tooth16 = container.querySelector<SVGGElement>('.odontogram-tooth[data-tooth="16"]')!;
      tooth16.focus();
      expect(document.activeElement).toBe(tooth16);

      // Add mark on another tooth
      odontogram.addMark({
        id: "m-26",
        tooth: "26",
        surfaces: ["O"],
        type: "restoration",
      });

      // Focus on tooth 16 must not be lost!
      expect(document.activeElement).toBe(tooth16);

      // Update tooth presence on tooth 36
      odontogram.setToothState("36", "unerupted");
      expect(document.activeElement).toBe(tooth16);

      // Update notation
      odontogram.setOption("notation", "universal");
      expect(document.activeElement).toBe(tooth16);

      odontogram.destroy();
    });

    it("triggers markDidMount and markWillUnmount ONLY for affected marks", () => {
      const markDidMount = vi.fn();
      const markWillUnmount = vi.fn();

      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        markDidMount,
        markWillUnmount,
      });
      odontogram.render();

      // Add Mark 1
      const mark1 = odontogram.addMark({
        id: "m1",
        tooth: "16",
        surfaces: ["O"],
        type: "caries",
      });

      expect(markDidMount).toHaveBeenCalledTimes(1);
      expect(markDidMount).toHaveBeenCalledWith(
        expect.objectContaining({ mark: expect.objectContaining({ id: "m1" }) }),
      );
      expect(markWillUnmount).not.toHaveBeenCalled();

      markDidMount.mockClear();

      // Add Mark 2 on another tooth
      odontogram.addMark({
        id: "m2",
        tooth: "26",
        surfaces: ["M"],
        type: "restoration",
      });

      expect(markDidMount).toHaveBeenCalledTimes(1);
      expect(markDidMount).toHaveBeenCalledWith(
        expect.objectContaining({ mark: expect.objectContaining({ id: "m2" }) }),
      );
      expect(markWillUnmount).not.toHaveBeenCalled();

      // Remove Mark 1
      odontogram.removeMark(mark1.id);
      expect(markWillUnmount).toHaveBeenCalledTimes(1);
      expect(markWillUnmount).toHaveBeenCalledWith(
        expect.objectContaining({ mark: expect.objectContaining({ id: "m1" }) }),
      );

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 3. Multi-Instance Isolation & Cleanup
  // ==========================================================================
  describe("Multi-Instance Isolation & Resource Teardown", () => {
    it("isolates defs, clips, patterns, and element IDs across concurrent instances", () => {
      const container1 = document.createElement("div");
      const container2 = document.createElement("div");
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      const inst1 = new Odontogram(container1, {
        plugins: [svgPlugin],
        instanceId: "chart-alpha",
        toothColor: "#e3f2fd",
      });
      const inst2 = new Odontogram(container2, {
        plugins: [svgPlugin],
        instanceId: "chart-beta",
        toothColor: "#fff3e0",
      });

      inst1.render();
      inst2.render();

      const svg1 = container1.querySelector("svg.odontogram-svg");
      const svg2 = container2.querySelector("svg.odontogram-svg");

      expect(svg1?.getAttribute("data-instance-id")).toBe("chart-alpha-");
      expect(svg2?.getAttribute("data-instance-id")).toBe("chart-beta-");

      expect(svg1?.querySelector("#chart-alpha-defs")).toBeTruthy();
      expect(svg2?.querySelector("#chart-beta-defs")).toBeTruthy();

      expect(svg1?.querySelector("#chart-alpha-tooth-16")).toBeTruthy();
      expect(svg2?.querySelector("#chart-beta-tooth-16")).toBeTruthy();

      // Destroy instance 1 only
      inst1.destroy();
      expect(container1.querySelector("svg")).toBeNull();

      // Instance 2 remains healthy and interactive
      expect(container2.querySelector("svg")).toBeTruthy();
      inst2.selectTooth("16");
      expect(svg2?.querySelector("#chart-beta-tooth-16")?.getAttribute("aria-pressed")).toBe(
        "true",
      );

      inst2.destroy();
      expect(container2.querySelector("svg")).toBeNull();
    });

    it("completely removes event listeners, observers, and DOM nodes on destroy", () => {
      const toothWillUnmount = vi.fn();
      const markWillUnmount = vi.fn();

      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        toothWillUnmount,
        markWillUnmount,
      });
      odontogram.render();

      odontogram.addMark({
        id: "m-test",
        tooth: "16",
        surfaces: ["O"],
        type: "caries",
      });

      odontogram.destroy();

      expect(toothWillUnmount).toHaveBeenCalled();
      expect(markWillUnmount).toHaveBeenCalledWith(
        expect.objectContaining({ mark: expect.objectContaining({ id: "m-test" }) }),
      );
      expect(container.querySelector(".odontogram-host")).toBeNull();
      expect(container.innerHTML).toBe("");
    });
  });

  // ==========================================================================
  // 4. Hidden Containers, Resizing & Repeated Mount/Unmount Cycles
  // ==========================================================================
  describe("Container Lifecycle & Resizing Resilience", () => {
    it("renders properly when mounted inside initially hidden (display: none) containers", () => {
      container.style.display = "none";

      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
      });
      odontogram.render();

      const svg = container.querySelector("svg.odontogram-svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("viewBox")).toBeTruthy();

      // Reveal container
      container.style.display = "block";

      const tooth16 = container.querySelector('.odontogram-tooth[data-tooth="16"]');
      expect(tooth16).toBeTruthy();
      expect(tooth16?.getAttribute("data-notation-label")).toBe("16");

      odontogram.destroy();
    });

    it("survives 10 consecutive mount and unmount cycles without state corruption", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
      });

      for (let i = 0; i < 10; i++) {
        odontogram.render();
        expect(container.querySelector("svg.odontogram-svg")).toBeTruthy();
        odontogram.addMark({
          id: `mark-${i}`,
          tooth: "16",
          surfaces: ["O"],
          type: "caries",
        });
        odontogram.destroy();
        expect(container.innerHTML).toBe("");
      }

      // Re-mount cleanly after 10 cycles
      odontogram.render();
      expect(container.querySelector("svg.odontogram-svg")).toBeTruthy();
      expect(odontogram.getMarks().length).toBe(10);
      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 5. Model-to-DOM Correspondence, Fixtures & Unique IDs
  // ==========================================================================
  describe("Dental Model Alignment & Fixture Verification", () => {
    it("renders exactly 32 teeth in permanent view, 20 in deciduous, and 52 in mixed", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
      });
      odontogram.render();
      expect(container.querySelectorAll(".odontogram-tooth").length).toBe(32);

      odontogram.changeView("deciduous");
      expect(container.querySelectorAll(".odontogram-tooth").length).toBe(20);

      odontogram.changeView("mixed");
      expect(container.querySelectorAll(".odontogram-tooth").length).toBe(52);

      odontogram.destroy();
    });

    it("guarantees unique IDs for all elements in the SVG DOM tree", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "mixed",
      });
      odontogram.render();

      odontogram.addMarks([
        { id: "m1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m2", type: "bridge", target: { teeth: ["14", "15", "16"] } },
      ]);

      const allElementsWithId = Array.from(container.querySelectorAll("[id]"));
      const ids = allElementsWithId.map((el) => el.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.length).toBeGreaterThan(50);

      odontogram.destroy();
    });

    it("matches all 52 tooth records in notations.json fixture", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "mixed",
      });
      odontogram.render();

      for (const entry of notationsFixture) {
        const toothEl = container.querySelector(`.odontogram-tooth[data-tooth="${entry.fdi}"]`);
        expect(toothEl).toBeTruthy();
        expect(toothEl?.getAttribute("data-quadrant")).toBe(String(entry.quadrant));
        expect(toothEl?.getAttribute("data-arch")).toBe(
          entry.arch === "maxillary" ? "upper" : "lower",
        );
        expect(toothEl?.getAttribute("data-notation-label")).toBe(entry.fdi);
        expect(toothEl?.getAttribute("aria-label")).toBe(`FDI ${entry.fdi}, present; no marks`);
      }

      // Test Universal notation
      odontogram.setOption("notation", "universal");
      for (const entry of notationsFixture) {
        const toothEl = container.querySelector(`.odontogram-tooth[data-tooth="${entry.fdi}"]`);
        expect(toothEl?.getAttribute("data-notation-label")).toBe(entry.universal);
        expect(toothEl?.getAttribute("aria-label")).toBe(
          `Universal ${entry.universal}, present; no marks`,
        );
      }

      // Test Palmer notation
      odontogram.setOption("notation", "palmer");
      for (const entry of notationsFixture) {
        const toothEl = container.querySelector(`.odontogram-tooth[data-tooth="${entry.fdi}"]`);
        expect(toothEl?.getAttribute("data-notation-label")).toBe(entry.palmerSymbol);
        expect(toothEl?.getAttribute("aria-label")).toBe(
          `${entry.palmerAccessible}, present; no marks`,
        );
      }

      odontogram.destroy();
    });

    it("matches surface-to-face orientation from orientation.json fixture", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
      });
      odontogram.render();

      for (const sample of orientationFixture.samples) {
        const surfEl = container.querySelector(
          `.odontogram-surface[data-tooth="${sample.tooth}"][data-surface="${sample.surface}"]`,
        );
        expect(surfEl).toBeTruthy();
        expect(surfEl?.getAttribute("data-face")).toBe(sample.face);
      }

      odontogram.destroy();
    });
  });
});
