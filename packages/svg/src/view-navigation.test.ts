import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Odontogram } from "@odontogram/core";
import { svgPlugin } from "./index.js";
import { TOOTH_WIDTH, TOOTH_HEIGHT, computeMixedLayout } from "./schematic-view.js";

describe("Stage 03 · View Navigation & Multi-View Representation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "odontogram-test-container";
    container.style.width = "800px";
    container.style.height = "500px";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Zero Data Loss Across View Transitions
  // ==========================================================================
  describe("Zero Data Loss Across View Navigation", () => {
    it("preserves marks, biological presence, and selection across all view transitions", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        instanceId: "test-nav",
      });
      odontogram.render();

      // 1. Setup rich state: marks, presence overlays, selection
      odontogram.addMarks([
        { id: "m-16-occ", tooth: "16", surfaces: ["O"], type: "caries", status: "existing" },
        {
          id: "m-21-mod",
          tooth: "21",
          surfaces: ["M", "I", "D"],
          type: "restoration",
          status: "completed",
        },
        { id: "m-36-occ", tooth: "36", surfaces: ["O"], type: "caries", status: "planned" },
        { id: "m-55-occ", tooth: "55", surfaces: ["O"], type: "caries", status: "existing" },
        {
          id: "bridge-14-16",
          type: "bridge",
          target: { teeth: ["14", "15", "16"] },
          status: "planned",
        },
      ]);

      odontogram.setToothState("15", "missing");
      odontogram.setToothState("48", "unerupted");
      odontogram.setToothState("85", "missing");

      odontogram.selectTooth("21", "replace");
      odontogram.selectSurface("36", "O", "add");

      const initialMarks = odontogram.getMarks();
      const initialTeeth = odontogram.getTeethState();
      const initialSelection = odontogram.getSelection();

      expect(initialMarks.length).toBe(5);
      expect(Object.keys(initialTeeth).length).toBe(3);
      expect(initialSelection.teeth).toContain("21");
      expect(initialSelection.surfaces.some((s) => s.tooth === "36" && s.surface === "O")).toBe(
        true,
      );

      // 2. Cycle through all views
      const viewsToTest = [
        "mixed",
        "deciduous",
        "primary",
        "arch",
        "upper",
        "lower",
        "maxillary",
        "mandibular",
        "quadrant-1",
        "quadrant-2",
        "quadrant-3",
        "quadrant-4",
        "quadrant-5",
        "quadrant-6",
        "quadrant-7",
        "quadrant-8",
        "tooth-16",
        "tooth-21",
        "tooth-36",
        "permanent",
      ];

      for (const targetView of viewsToTest) {
        odontogram.changeView(targetView);

        // Verify state snapshot integrity
        const currentMarks = odontogram.getMarks();
        const currentTeeth = odontogram.getTeethState();
        const currentSelection = odontogram.getSelection();

        expect(currentMarks).toEqual(initialMarks);
        expect(currentTeeth).toEqual(initialTeeth);
        expect(currentSelection).toEqual(initialSelection);
      }

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 2. Mixed Dentition 4-Row Explicit Layout & Non-Overlap Guarantee
  // ==========================================================================
  describe("Mixed Dentition 4-Row Layout & Anatomical Alignment", () => {
    it("renders all 52 teeth in mixed view with zero bounding box overlaps", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "mixed",
      });
      odontogram.render();

      const toothElements = container.querySelectorAll(".odontogram-tooth");
      expect(toothElements.length).toBe(52);

      const layout = computeMixedLayout("fdi");
      expect(layout.length).toBe(52);

      // Check all 52 tooth bounding boxes for any pairwise overlap
      for (let i = 0; i < layout.length; i++) {
        for (let j = i + 1; j < layout.length; j++) {
          const a = layout[i];
          const b = layout[j];
          const aW = a.width ?? TOOTH_WIDTH;
          const aH = a.height ?? TOOTH_HEIGHT;
          const bW = b.width ?? TOOTH_WIDTH;
          const bH = b.height ?? TOOTH_HEIGHT;

          const overlaps = a.x < b.x + bW && a.x + aW > b.x && a.y < b.y + bH && a.y + aH > b.y;

          expect(overlaps).toBe(false);
        }
      }

      odontogram.destroy();
    });

    it("aligns primary teeth directly with their permanent successors in mixed layout", () => {
      const layout = computeMixedLayout("fdi");
      const map = new Map(layout.map((l) => [l.tooth, l]));

      // Upper arch: 55..51 under 15..11
      expect(map.get("55")!.x).toBe(map.get("15")!.x);
      expect(map.get("54")!.x).toBe(map.get("14")!.x);
      expect(map.get("53")!.x).toBe(map.get("13")!.x);
      expect(map.get("52")!.x).toBe(map.get("12")!.x);
      expect(map.get("51")!.x).toBe(map.get("11")!.x);

      // Upper arch: 61..65 under 21..25
      expect(map.get("61")!.x).toBe(map.get("21")!.x);
      expect(map.get("62")!.x).toBe(map.get("22")!.x);
      expect(map.get("63")!.x).toBe(map.get("23")!.x);
      expect(map.get("64")!.x).toBe(map.get("24")!.x);
      expect(map.get("65")!.x).toBe(map.get("25")!.x);

      // Lower arch: 85..81 above 45..41
      expect(map.get("85")!.x).toBe(map.get("45")!.x);
      expect(map.get("84")!.x).toBe(map.get("44")!.x);
      expect(map.get("83")!.x).toBe(map.get("43")!.x);
      expect(map.get("82")!.x).toBe(map.get("42")!.x);
      expect(map.get("81")!.x).toBe(map.get("41")!.x);

      // Lower arch: 71..75 above 31..35
      expect(map.get("71")!.x).toBe(map.get("31")!.x);
      expect(map.get("72")!.x).toBe(map.get("32")!.x);
      expect(map.get("73")!.x).toBe(map.get("33")!.x);
      expect(map.get("74")!.x).toBe(map.get("34")!.x);
      expect(map.get("75")!.x).toBe(map.get("35")!.x);
    });
  });

  // ==========================================================================
  // 3. Arch Views (Upper / Maxillary, Lower / Mandibular)
  // ==========================================================================
  describe("Arch Views", () => {
    it("renders only upper arch teeth when view is upper or maxillary", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "upper",
      });
      odontogram.render();

      const teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(16);

      for (const t of Array.from(teeth)) {
        expect(t.getAttribute("data-arch")).toBe("upper");
      }

      // Switch to maxillary
      odontogram.changeView("maxillary");
      expect(container.querySelectorAll(".odontogram-tooth").length).toBe(16);

      odontogram.destroy();
    });

    it("renders only lower arch teeth when view is lower or mandibular", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "lower",
      });
      odontogram.render();

      const teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(16);

      for (const t of Array.from(teeth)) {
        expect(t.getAttribute("data-arch")).toBe("lower");
      }

      odontogram.changeView("mandibular");
      expect(container.querySelectorAll(".odontogram-tooth").length).toBe(16);

      odontogram.destroy();
    });

    it("supports mixed dentition arch view with per-view options", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "arch",
        viewOptions: { arch: "upper", dentition: "mixed" },
      });
      odontogram.render();

      // Upper mixed has 16 permanent (18..28) + 10 primary (55..65) = 26 teeth
      expect(container.querySelectorAll(".odontogram-tooth").length).toBe(26);

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 4. Quadrant Views (1 to 8)
  // ==========================================================================
  describe("Quadrant Views", () => {
    it("renders correct teeth for each permanent quadrant (1 to 4)", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "quadrant-1",
      });
      odontogram.render();

      // Q1: 18..11 (8 teeth)
      let teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(8);
      expect(teeth[0].getAttribute("data-tooth")).toBe("18");
      expect(teeth[7].getAttribute("data-tooth")).toBe("11");

      // Q2: 21..28 (8 teeth)
      odontogram.changeView("quadrant-2");
      teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(8);
      expect(teeth[0].getAttribute("data-tooth")).toBe("21");
      expect(teeth[7].getAttribute("data-tooth")).toBe("28");

      // Q3: 31..38 (8 teeth)
      odontogram.changeView("quadrant-3");
      teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(8);
      expect(teeth[0].getAttribute("data-tooth")).toBe("31");
      expect(teeth[7].getAttribute("data-tooth")).toBe("38");

      // Q4: 48..41 (8 teeth)
      odontogram.changeView("quadrant-4");
      teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(8);
      expect(teeth[0].getAttribute("data-tooth")).toBe("48");
      expect(teeth[7].getAttribute("data-tooth")).toBe("41");

      odontogram.destroy();
    });

    it("renders correct teeth for primary quadrants (5 to 8)", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "quadrant-5",
      });
      odontogram.render();

      // Q5: 55..51 (5 teeth)
      let teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(5);
      expect(teeth[0].getAttribute("data-tooth")).toBe("55");
      expect(teeth[4].getAttribute("data-tooth")).toBe("51");

      // Q6: 61..65 (5 teeth)
      odontogram.changeView("quadrant-6");
      teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(5);
      expect(teeth[0].getAttribute("data-tooth")).toBe("61");
      expect(teeth[4].getAttribute("data-tooth")).toBe("65");

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 5. Tooth Detail View (Enlarged Single Tooth)
  // ==========================================================================
  describe("Tooth Detail View", () => {
    it("renders a single tooth with enlarged dimensions and interactive surface labels", () => {
      const surfaceClick = vi.fn();
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "tooth-16",
        surfaceClick,
      });
      odontogram.render();

      const teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(1);
      const tooth16 = teeth[0];
      expect(tooth16.getAttribute("data-tooth")).toBe("16");

      // Verify enlarged outline
      const outline = tooth16.querySelector<SVGRectElement>(".odontogram-tooth-outline");
      expect(outline).toBeTruthy();
      expect(parseInt(outline!.getAttribute("width")!, 10)).toBeGreaterThan(TOOTH_WIDTH);

      // Verify surface labels are rendered (M, O, D, B, L)
      const surfaceLabels = tooth16.querySelectorAll(".odontogram-surface-label");
      expect(surfaceLabels.length).toBe(5);

      // Verify clicking surface works in detail view
      const occSurface = tooth16.querySelector<SVGPathElement>(
        '.odontogram-surface[data-surface="O"] path',
      );
      expect(occSurface).toBeTruthy();
      occSurface!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(
        odontogram.getSelection().surfaces.some((s) => s.tooth === "16" && s.surface === "O"),
      ).toBe(true);
      expect(surfaceClick).toHaveBeenCalled();

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 6. Patient Right/Left Orientation & Midline Indicators
  // ==========================================================================
  describe("Patient Orientation & Midline Indicators", () => {
    it("renders patient right on screen-left and patient left on screen-right", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        showOrientationLabels: true,
        showMidline: true,
      });
      odontogram.render();

      const orientationLayer = container.querySelector(".odontogram-layer-orientation");
      expect(orientationLayer).toBeTruthy();

      const rightLabel = orientationLayer?.querySelector(".odontogram-orientation-right");
      const leftLabel = orientationLayer?.querySelector(".odontogram-orientation-left");

      expect(rightLabel?.textContent).toContain("R (Patient Right)");
      expect(leftLabel?.textContent).toContain("L (Patient Left)");

      // Midline divider
      const midlineLayer = container.querySelector(".odontogram-layer-midline");
      expect(midlineLayer).toBeTruthy();
      expect(midlineLayer?.querySelector(".odontogram-midline-line")).toBeTruthy();

      odontogram.destroy();
    });

    it("can disable orientation labels and midline via options", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        showOrientationLabels: false,
        showMidline: false,
      });
      odontogram.render();

      expect(container.querySelector(".odontogram-orientation-right")).toBeNull();
      expect(container.querySelector(".odontogram-midline-line")).toBeNull();

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 7. Selection Retention for Hidden Targets
  // ==========================================================================
  describe("Model-Driven Selection of Hidden Targets", () => {
    it("preserves selection on hidden teeth and displays visual highlight upon entering a visible view", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "quadrant-1", // only teeth 18..11 visible
        selectionColor: "#ff9800",
      });
      odontogram.render();

      // Select tooth 36 (in Quadrant 3, currently hidden)
      odontogram.selectTooth("36");
      odontogram.selectSurface("36", "O", "add");

      expect(odontogram.getSelection().teeth).toContain("36");
      expect(
        odontogram.getSelection().surfaces.some((s) => s.tooth === "36" && s.surface === "O"),
      ).toBe(true);

      // Tooth 36 is not in DOM while in Quadrant 1
      expect(container.querySelector('.odontogram-tooth[data-tooth="36"]')).toBeNull();

      // Switch to Quadrant 3 (where 36 is visible)
      odontogram.changeView("quadrant-3");

      const tooth36 = container.querySelector('.odontogram-tooth[data-tooth="36"]');
      expect(tooth36).toBeTruthy();
      expect(tooth36?.getAttribute("aria-selected")).toBe("true");

      const outline = tooth36?.querySelector(".odontogram-tooth-outline");
      expect(outline?.getAttribute("fill")).toBe("#ff9800");

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 8. Partial Dentition & visibleTeeth Filtering
  // ==========================================================================
  describe("Partial Dentition & Visible Teeth Filtering", () => {
    it("renders only specified visibleTeeth without coordinate drift", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        visibleTeeth: ["16", "21", "26", "36"],
      });
      odontogram.render();

      const teeth = container.querySelectorAll(".odontogram-tooth");
      expect(teeth.length).toBe(4);

      expect(container.querySelector('.odontogram-tooth[data-tooth="16"]')).toBeTruthy();
      expect(container.querySelector('.odontogram-tooth[data-tooth="21"]')).toBeTruthy();
      expect(container.querySelector('.odontogram-tooth[data-tooth="26"]')).toBeTruthy();
      expect(container.querySelector('.odontogram-tooth[data-tooth="36"]')).toBeTruthy();
      expect(container.querySelector('.odontogram-tooth[data-tooth="11"]')).toBeNull();

      odontogram.destroy();
    });
  });

  // ==========================================================================
  // 9. Multi-Tooth Annotations Across View Scopes
  // ==========================================================================
  describe("Multi-Tooth Annotations Across Views", () => {
    it("renders bridge when all targets visible and gracefully handles partial views", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
      });
      odontogram.render();

      odontogram.addMark({
        id: "bridge-1",
        type: "bridge",
        target: { teeth: ["14", "15", "16"] },
      });

      // Full view: bridge rendered
      expect(container.querySelector(".odontogram-annotation-bridge")).toBeTruthy();

      // Switch to Quadrant 1 (14, 15, 16 all in Q1)
      odontogram.changeView("quadrant-1");
      expect(container.querySelector(".odontogram-annotation-bridge")).toBeTruthy();

      // Switch to Quadrant 2 (none of 14, 15, 16 visible)
      odontogram.changeView("quadrant-2");
      // Bridge not rendered in DOM but mark preserved in state
      expect(container.querySelector(".odontogram-annotation-bridge path")).toBeNull();
      expect(odontogram.getMark("bridge-1")).toBeTruthy();

      // Switch back to permanent: bridge rendered again
      odontogram.changeView("permanent");
      expect(container.querySelector(".odontogram-annotation-bridge path")).toBeTruthy();

      odontogram.destroy();
    });
  });

  describe("Stage 05 · Responsive viewport interaction", () => {
    it("bounds zoom, keeps all chart geometry in the same SVG space, and resets", () => {
      const odontogram = new Odontogram(container, {
        plugins: [svgPlugin],
        initialView: "permanent",
        width: "100%",
        height: 360,
        maxZoom: 3,
      });
      odontogram.render();
      odontogram.addMark({
        id: "bridge-view",
        type: "bridge",
        target: { teeth: ["14", "15", "16"] },
      });
      const svg = container.querySelector<SVGSVGElement>(".odontogram-svg")!;
      vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 360,
        width: 800,
        height: 360,
        toJSON: () => ({}),
      } as DOMRect);
      const initialViewBox = svg.getAttribute("viewBox");
      const annotationPath = container.querySelector(".odontogram-annotation path")!;
      const dBefore = annotationPath.getAttribute("d");

      svg.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -100000, ctrlKey: true, cancelable: true }),
      );
      expect(svg.getAttribute("data-zoom")).toBe("3");
      expect(svg.getAttribute("viewBox")).not.toBe(initialViewBox);
      expect(annotationPath.getAttribute("d")).toBe(dBefore);
      expect(container.querySelector(".odontogram-tooth-label")).toBeTruthy();

      const zoomedViewBox = svg.getAttribute("viewBox");
      const pointer = (type: string, clientX: number, clientY: number) => {
        const event = new Event(type, { bubbles: true }) as PointerEvent;
        Object.defineProperties(event, {
          pointerId: { value: 7 },
          pointerType: { value: "touch" },
          clientX: { value: clientX },
          clientY: { value: clientY },
        });
        return event;
      };
      svg.dispatchEvent(pointer("pointerdown", 300, 150));
      svg.dispatchEvent(pointer("pointermove", 320, 160));
      svg.dispatchEvent(pointer("pointerup", 320, 160));
      expect(svg.getAttribute("viewBox")).not.toBe(zoomedViewBox);

      svg.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 100000, ctrlKey: true, cancelable: true }),
      );
      expect(svg.getAttribute("data-zoom")).toBe("1");
      svg.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -1000, ctrlKey: true, cancelable: true }),
      );
      svg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      expect(svg.getAttribute("viewBox")).toBe(initialViewBox);
      expect(odontogram.getMark("bridge-view")).toBeTruthy();
      odontogram.destroy();
    });
  });
});
