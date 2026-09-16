import { describe, it, expect, afterEach } from "vitest";
import { svgPlugin } from "./index.js";
import { renderSchematicView } from "./schematic-view.js";
import { mapSurfaceToFace } from "@odontogram/dentition";
import type { ViewRenderContext } from "@odontogram/core";

function createContext(
  stateOverrides: Partial<ViewRenderContext["state"]> = {},
): ViewRenderContext {
  const el = document.createElement("div");
  const state = {
    view: "permanent",
    marks: [],
    selection: { teeth: [], surfaces: [] },
    teeth: {},
    ...stateOverrides,
  };

  return {
    el,
    options: {
      notation: "fdi",
      toothColor: "#f5f5f5",
      surfaceColor: "#e0e0e0",
      selectionColor: "#90caf9",
    },
    state,
    requestRender: () => {},
    selectTooth: () => {},
    selectSurface: () => {},
    toggleSurfaceSelection: () => {},
    emitToothClick: () => {},
    emitSurfaceClick: () => {},
  };
}

function renderIntoDocument(stateOverrides: Partial<ViewRenderContext["state"]> = {}): HTMLElement {
  const ctx = createContext(stateOverrides);
  document.body.appendChild(ctx.el);
  renderSchematicView(ctx);
  return ctx.el;
}

describe("schematic SVG view", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers permanent, deciduous, and mixed views", () => {
    const views = svgPlugin.pluginDef.views?.map((v) => v.type) ?? [];
    expect(views).toEqual(["permanent", "deciduous", "mixed"]);
  });

  it("maps mesial to screen-right for patient-right teeth", () => {
    renderIntoDocument();
    const mesial = document.querySelector('.odontogram-surface[data-tooth="16"][data-surface="M"]');
    expect(mesial?.getAttribute("data-face")).toBe(mapSurfaceToFace("16", "M"));
    expect(mesial?.getAttribute("data-face")).toBe("right");
  });

  it("maps mesial to screen-left for patient-left teeth", () => {
    renderIntoDocument();
    const mesial = document.querySelector('.odontogram-surface[data-tooth="26"][data-surface="M"]');
    expect(mesial?.getAttribute("data-face")).toBe("left");
  });

  it("maps mandibular buccal to bottom", () => {
    renderIntoDocument();
    const buccal = document.querySelector('.odontogram-surface[data-tooth="46"][data-surface="B"]');
    expect(buccal?.getAttribute("data-face")).toBe("bottom");
  });

  it("renders incisal on anterior teeth, not occlusal", () => {
    renderIntoDocument();
    expect(
      document.querySelector('.odontogram-surface[data-tooth="11"][data-surface="I"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('.odontogram-surface[data-tooth="11"][data-surface="O"]'),
    ).toBeNull();
  });

  it("renders missing presence with indicator and no surfaces", () => {
    renderIntoDocument({
      teeth: { "16": { presence: "missing" } },
    });
    const tooth = document.querySelector('.odontogram-tooth[data-tooth="16"]');
    expect(tooth?.getAttribute("data-presence")).toBe("missing");
    expect(
      document.querySelector('.odontogram-surface[data-tooth="16"][data-surface="O"]'),
    ).toBeNull();
    expect(tooth?.querySelector("line")).toBeTruthy();
  });

  it("renders unerupted with dashed styling", () => {
    renderIntoDocument({
      teeth: { "26": { presence: "unerupted" } },
    });
    const tooth = document.querySelector('.odontogram-tooth[data-tooth="26"]');
    expect(tooth?.getAttribute("data-presence")).toBe("unerupted");
    const rect = tooth?.querySelector("rect");
    expect(rect?.getAttribute("stroke-dasharray")).toBe("4 3");
  });

  it("renders FDI notation labels and accessibility attributes by default", () => {
    renderIntoDocument();
    const tooth16 = document.querySelector('.odontogram-tooth[data-tooth="16"]');
    expect(tooth16?.getAttribute("data-notation-label")).toBe("16");
    expect(tooth16?.getAttribute("aria-label")).toBe("FDI 16");
    expect(tooth16?.querySelector("text")?.textContent).toBe("16");
  });

  it("renders Universal notation labels when notation option is universal", () => {
    const ctx = createContext();
    ctx.options.notation = "universal";
    document.body.appendChild(ctx.el);
    renderSchematicView(ctx);

    const tooth11 = document.querySelector('.odontogram-tooth[data-tooth="11"]');
    expect(tooth11?.getAttribute("data-notation-label")).toBe("8");
    expect(tooth11?.getAttribute("aria-label")).toBe("Universal 8");
    expect(tooth11?.querySelector("text")?.textContent).toBe("8");

    const tooth18 = document.querySelector('.odontogram-tooth[data-tooth="18"]');
    expect(tooth18?.getAttribute("data-notation-label")).toBe("1");
    expect(tooth18?.querySelector("text")?.textContent).toBe("1");
  });

  it("renders Palmer notation labels and accessible attributes when notation option is palmer", () => {
    const ctx = createContext();
    ctx.options.notation = "palmer";
    document.body.appendChild(ctx.el);
    renderSchematicView(ctx);

    const tooth18 = document.querySelector('.odontogram-tooth[data-tooth="18"]');
    expect(tooth18?.getAttribute("data-notation-label")).toBe("8┘");
    expect(tooth18?.getAttribute("aria-label")).toBe("UR8");
    expect(tooth18?.querySelector("text")?.textContent).toBe("8┘");

    const tooth21 = document.querySelector('.odontogram-tooth[data-tooth="21"]');
    expect(tooth21?.getAttribute("data-notation-label")).toBe("└1");
    expect(tooth21?.getAttribute("aria-label")).toBe("UL1");
    expect(tooth21?.querySelector("text")?.textContent).toBe("└1");
  });

  it("renders multi-surface marks across all targeted surfaces", () => {
    renderIntoDocument({
      marks: [
        {
          id: "m-mod-16",
          type: "restoration",
          status: "completed",
          target: {
            tooth: "16",
            surfaces: ["M", "O", "D"],
          },
          tooth: "16",
          surfaces: ["M", "O", "D"],
          style: { fill: "#1976d2" },
        },
      ],
    });

    const mesial = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="M"] path',
    );
    const occlusal = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="O"] path',
    );
    const distal = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="D"] path',
    );
    const buccal = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="B"] path',
    );

    expect(mesial?.getAttribute("fill")).toBe("#1976d2");
    expect(occlusal?.getAttribute("fill")).toBe("#1976d2");
    expect(distal?.getAttribute("fill")).toBe("#1976d2");
    expect(buccal?.getAttribute("fill")).toBe("#e0e0e0"); // default surface color
  });

  it("renders multiple marks on one tooth with correct data attributes and colors", () => {
    renderIntoDocument({
      marks: [
        {
          id: "m-1",
          type: "restoration",
          status: "completed",
          target: { tooth: "16", surfaces: ["O"] },
          tooth: "16",
          surfaces: ["O"],
        },
        {
          id: "m-2",
          type: "caries",
          status: "existing",
          target: { tooth: "16", surfaces: ["B"] },
          tooth: "16",
          surfaces: ["B"],
        },
      ],
    });

    const tooth16 = document.querySelector('.odontogram-tooth[data-tooth="16"]');
    expect(tooth16?.getAttribute("data-tooth-marks")).toBe("m-1 m-2");

    const occSurface = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="O"]',
    );
    expect(occSurface?.getAttribute("data-mark-ids")).toBe("m-1");
    expect(occSurface?.getAttribute("data-status")).toBe("completed");

    const buccalSurface = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="B"]',
    );
    expect(buccalSurface?.getAttribute("data-mark-ids")).toBe("m-2");
    expect(buccalSurface?.getAttribute("data-status")).toBe("existing");
  });

  it("applies statusColors when specific mark color or style is not defined", () => {
    const ctx = createContext({
      marks: [
        {
          id: "m-planned",
          type: "unspecified-type",
          status: "planned",
          target: { tooth: "16", surfaces: ["O"] },
          tooth: "16",
          surfaces: ["O"],
        },
      ],
    });
    ctx.options.statusColors = {
      planned: "#ff9800",
    };
    document.body.appendChild(ctx.el);
    renderSchematicView(ctx);

    const path = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="O"] path',
    );
    expect(path?.getAttribute("fill")).toBe("#ff9800");
  });
});
