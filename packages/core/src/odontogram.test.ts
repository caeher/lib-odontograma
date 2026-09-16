import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import { createDefaultState, getToothPresence } from "./defaults.js";
import type { SelectionState, ViewRenderContext } from "./types.js";

function createMockView(type: string) {
  let renderCount = 0;
  const view = {
    type,
    render: vi.fn((ctx: ViewRenderContext) => {
      renderCount++;
      const div = document.createElement("div");
      div.className = `mock-view-${type}`;
      div.textContent = `render-${renderCount}`;
      ctx.el.appendChild(div);
    }),
    destroy: vi.fn(),
  };
  return { view, getRenderCount: () => renderCount };
}

describe("Odontogram", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("render() mounts host element and calls view render", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();

    expect(container.querySelector(".odontogram-host")).toBeTruthy();
    expect(view.render).toHaveBeenCalled();
  });

  it("destroy() removes host and calls view destroy", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();
    odontogram.destroy();

    expect(container.querySelector(".odontogram-host")).toBeNull();
    expect(view.destroy).toHaveBeenCalled();
  });

  it("getOption/setOption work for mutable options", () => {
    const odontogram = new Odontogram(container, { notation: "fdi" });
    expect(odontogram.getOption("notation")).toBe("fdi");

    odontogram.setOption("notation", "universal");
    expect(odontogram.getOption("notation")).toBe("universal");
  });

  it("setOption warns for immutable options", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const odontogram = new Odontogram(container, { initialView: "permanent" });
    odontogram.setOption("initialView", "deciduous");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("changeView switches view and re-renders", () => {
    const permanent = createMockView("permanent");
    const deciduous = createMockView("deciduous");
    const plugin = createPlugin({
      name: "test",
      views: [permanent.view, deciduous.view],
    });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();
    expect(odontogram.getState().view).toBe("permanent");

    odontogram.changeView("deciduous");
    expect(odontogram.getState().view).toBe("deciduous");
    expect(deciduous.view.render).toHaveBeenCalled();
  });

  it("getState/setState manage marks and selection", () => {
    const odontogram = new Odontogram(container, { initialView: "permanent" });

    odontogram.setState({
      marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      selection: { teeth: ["16"], surfaces: [] },
    });

    const state = odontogram.getState();
    expect(state.marks).toHaveLength(1);
    expect(state.marks[0].type).toBe("caries");
    expect(state.selection.teeth).toContain("16");
    expect(state.teeth).toEqual({});
  });

  it("teeth overlay stores explicit missing and unerupted states", () => {
    const odontogram = new Odontogram(container, { initialView: "permanent" });

    odontogram.setState({
      teeth: {
        "16": { presence: "missing" },
        "26": { presence: "unerupted" },
      },
    });

    const state = odontogram.getState();
    expect(state.teeth["16"]?.presence).toBe("missing");
    expect(state.teeth["26"]?.presence).toBe("unerupted");
    expect(state.teeth["11"]).toBeUndefined();
  });

  it("omitted tooth ids are not treated as missing", () => {
    const state = createDefaultState("permanent");
    expect(getToothPresence(state.teeth, "16")).toBe("present");
    expect(state.teeth["16"]).toBeUndefined();
  });

  it("batchRendering coalesces multiple updates into one render", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();
    const callsAfterRender = view.render.mock.calls.length;

    odontogram.batchRendering(() => {
      odontogram.setOption("notation", "palmer");
      odontogram.setState({
        marks: [{ id: "m1", tooth: "11", surfaces: ["M"], type: "restoration" }],
      });
    });

    // Initial render + one batched render
    expect(view.render.mock.calls.length).toBe(callsAfterRender + 1);
  });

  it("render without view plugin logs warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const odontogram = new Odontogram(container);
    odontogram.render();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("No view implementation"));
    warn.mockRestore();
  });

  it("preserves selection, marks, and presence when notation changes at runtime", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
      notation: "fdi",
    });

    odontogram.render();

    // Set initial state with canonical FDI identifiers
    odontogram.setState({
      marks: [
        { id: "m1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m2", tooth: "21", surfaces: ["M", "D"], type: "restoration" },
      ],
      selection: {
        teeth: ["16"],
        surfaces: [{ tooth: "21", surface: "M" }],
      },
      teeth: {
        "48": { presence: "missing" },
        "26": { presence: "unerupted" },
      },
    });

    const stateBefore = odontogram.getState();

    // Switch notation to Universal
    odontogram.setOption("notation", "universal");
    const stateInUniversal = odontogram.getState();
    expect(stateInUniversal.marks).toEqual(stateBefore.marks);
    expect(stateInUniversal.selection).toEqual(stateBefore.selection);
    expect(stateInUniversal.teeth).toEqual(stateBefore.teeth);
    expect(stateInUniversal.marks[0].tooth).toBe("16");
    expect(stateInUniversal.selection.teeth).toContain("16");

    // Switch notation to Palmer
    odontogram.setOption("notation", "palmer");
    const stateInPalmer = odontogram.getState();
    expect(stateInPalmer.marks).toEqual(stateBefore.marks);
    expect(stateInPalmer.selection).toEqual(stateBefore.selection);
    expect(stateInPalmer.teeth).toEqual(stateBefore.teeth);

    // Switch back to FDI
    odontogram.setOption("notation", "fdi");
    const stateInFdi = odontogram.getState();
    expect(stateInFdi).toEqual(stateBefore);
  });

  it("emits canonical tooth IDs in click and selection callbacks regardless of active notation", () => {
    let clickedTooth: string | null = null;
    let clickedSurface: { tooth: string; surface: string } | null = null;
    let selectedState: SelectionState | null = null;

    let capturedCtx: ViewRenderContext | null = null;
    const view = {
      type: "permanent",
      render: (ctx: ViewRenderContext) => {
        capturedCtx = ctx;
      },
      destroy: vi.fn(),
    };
    const plugin = createPlugin({ name: "test", views: [view] });

    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
      notation: "universal",
      toothClick: (arg) => {
        clickedTooth = arg.tooth;
      },
      surfaceClick: (arg) => {
        clickedSurface = { tooth: arg.tooth, surface: arg.surface };
      },
      selectionDidChange: (arg) => {
        selectedState = arg.selection;
      },
    });

    odontogram.render();
    expect(capturedCtx).toBeTruthy();

    // Emit interaction from view using canonical tooth id "16" (which is Universal "3")
    const dummyEvent = new MouseEvent("click");
    capturedCtx!.emitToothClick("16", dummyEvent);
    expect(clickedTooth).toBe("16");

    capturedCtx!.emitSurfaceClick("16", "O", dummyEvent);
    expect(clickedSurface).toEqual({ tooth: "16", surface: "O" });

    capturedCtx!.selectTooth("16");
    expect((selectedState as SelectionState | null)?.teeth).toContain("16");
  });

  it("normalizes marks with target structure in setState and getState", () => {
    const odontogram = new Odontogram(container, { initialView: "permanent" });

    odontogram.setState({
      marks: [
        {
          id: "m1",
          tooth: "16",
          surfaces: ["M", "O", "D"],
          type: "restoration",
          status: "completed",
          text: "MOD composite",
          metadata: { shade: "A2" },
        },
        {
          id: "m2",
          type: "bridge",
          status: "planned",
          teeth: ["14", "15", "16"],
        },
      ],
    });

    const state = odontogram.getState();
    expect(state.marks).toHaveLength(2);
    expect(state.marks[0].target).toEqual({
      kind: "surface",
      tooth: "16",
      surfaces: ["M", "O", "D"],
    });
    expect(state.marks[0].status).toBe("completed");
    expect(state.marks[0].metadata).toEqual({ shade: "A2" });
    expect(state.marks[1].target).toEqual({
      kind: "teeth",
      teeth: ["14", "15", "16"],
    });
  });

  it("runs validate() on the odontogram instance and emits validationDidChange callback", () => {
    let validationResults: any = null;
    const odontogram = new Odontogram(container, {
      initialView: "permanent",
      validator: true,
      validationDidChange: (arg) => {
        validationResults = arg.result;
      },
    });

    // Set invalid state (caries on incisal anterior tooth)
    odontogram.setState({
      marks: [{ id: "m-invalid", tooth: "11", surfaces: ["O"], type: "caries" }],
    });

    expect(validationResults).toBeTruthy();
    expect(validationResults.valid).toBe(false);
    expect(validationResults.errors.length).toBeGreaterThan(0);

    const directResult = odontogram.validate();
    expect(directResult.valid).toBe(false);
  });
});

