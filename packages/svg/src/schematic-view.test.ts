import { describe, it, expect, afterEach } from "vitest";
import { svgPlugin } from "./index.js";
import { renderSchematicView } from "./schematic-view.js";
import { mapSurfaceToFace } from "@odontogram/dentition";
import type { ViewRenderContext } from "@odontogram/core";

function createContext(stateOverrides: Partial<ViewRenderContext["state"]> = {}): ViewRenderContext {
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
    const mesial = document.querySelector(
      '.odontogram-surface[data-tooth="16"][data-surface="M"]',
    );
    expect(mesial?.getAttribute("data-face")).toBe(mapSurfaceToFace("16", "M"));
    expect(mesial?.getAttribute("data-face")).toBe("right");
  });

  it("maps mesial to screen-left for patient-left teeth", () => {
    renderIntoDocument();
    const mesial = document.querySelector(
      '.odontogram-surface[data-tooth="26"][data-surface="M"]',
    );
    expect(mesial?.getAttribute("data-face")).toBe("left");
  });

  it("maps mandibular buccal to bottom", () => {
    renderIntoDocument();
    const buccal = document.querySelector(
      '.odontogram-surface[data-tooth="46"][data-surface="B"]',
    );
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
});
