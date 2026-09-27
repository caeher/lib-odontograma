import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import { createDefaultState, getToothPresence } from "./defaults.js";
import { OdontogramError, OdontogramValidationError, VALIDATION_CODES } from "./errors.js";
import type { SelectionState, ValidationResult, ViewRenderContext } from "./types.js";

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

  it("throws OdontogramError when container is not a valid HTMLElement", () => {
    expect(() => new Odontogram({} as unknown as HTMLElement)).toThrow(OdontogramError);
    expect(() => new Odontogram("invalid" as unknown as HTMLElement)).toThrow(OdontogramError);
  });

  it("throws OdontogramValidationError when constructor options are invalid", () => {
    expect(
      () =>
        new Odontogram(container, {
          notation: "invalid-notation" as unknown as "fdi",
        }),
    ).toThrow(OdontogramValidationError);
  });

  it("warns when unknown options are provided to constructor", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const odontogram = new Odontogram(container, {
      unknownCustomOption: "value",
    } as unknown as object);
    expect(odontogram).toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown configuration option"));
    warn.mockRestore();
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

  it("setOption throws a clear error for recreation-only options", () => {
    const odontogram = new Odontogram(container, { initialView: "permanent" });
    expect(() => odontogram.setOption("initialView", "deciduous")).toThrow(
      'Option "initialView" can only be set when creating an Odontogram instance.',
    );
  });

  it("setOption throws OdontogramValidationError for invalid option values", () => {
    const odontogram = new Odontogram(container);
    expect(() => odontogram.setOption("notation", "invalid" as unknown as "fdi")).toThrow(
      OdontogramValidationError,
    );
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

  it("allows API selection while respecting locked teeth and surfaces", () => {
    const odontogram = new Odontogram(container, {
      lockedTeeth: ["18"],
      lockedSurfaces: [{ tooth: "16", surface: "O" }],
      isToothSelectable: (tooth) => tooth !== "17",
      isSurfaceSelectable: (_tooth, surface) => surface !== "M",
    });

    odontogram.selectTooth("18");
    odontogram.selectTooth("17");
    odontogram.selectSurface("16", "O");
    odontogram.selectSurface("16", "M");
    odontogram.selectTooth("16");
    expect(odontogram.getSelection()).toEqual({ teeth: ["16"], surfaces: [] });
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

  it("applies changes atomically: rejecting invalid input leaves previous state completely intact", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const marksSetCallback = vi.fn();
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
      marksSet: marksSetCallback,
    });

    odontogram.render();

    const initialValidMarks = [
      { id: "m-valid-1", tooth: "16", surfaces: ["O" as const], type: "caries" },
    ];
    odontogram.setState({ marks: initialValidMarks });

    const stateBefore = odontogram.getState();
    expect(stateBefore.marks).toHaveLength(1);
    expect(stateBefore.marks[0].id).toBe("m-valid-1");

    const renderCallsBefore = view.render.mock.calls.length;
    const marksSetCallsBefore = marksSetCallback.mock.calls.length;

    // Attempt invalid state update: duplicate surfaces ["O", "O"] and invalid surface "Z"
    let thrownError: OdontogramValidationError | null = null;
    try {
      odontogram.setState({
        marks: [
          {
            id: "m-invalid",
            tooth: "16",
            surfaces: ["O" as const, "Z" as unknown as "O"],
            type: "caries",
          },
        ],
      });
    } catch (err) {
      if (err instanceof OdontogramValidationError) {
        thrownError = err;
      }
    }

    expect(thrownError).toBeInstanceOf(OdontogramValidationError);
    expect(thrownError?.code).toBe(VALIDATION_CODES.ERR_INVALID_STATE);
    expect(thrownError?.errors.some((e) => e.code === VALIDATION_CODES.ERR_INVALID_SURFACE)).toBe(
      true,
    );

    // State MUST be unchanged
    const stateAfter = odontogram.getState();
    expect(stateAfter).toEqual(stateBefore);
    expect(stateAfter.marks).toHaveLength(1);
    expect(stateAfter.marks[0].id).toBe("m-valid-1");

    // No re-render and no callback after failed update
    expect(view.render.mock.calls.length).toBe(renderCallsBefore);
    expect(marksSetCallback.mock.calls.length).toBe(marksSetCallsBefore);
  });

  it("preserves unknown mark types without loss of metadata or properties", () => {
    const odontogram = new Odontogram(container, { initialView: "permanent" });

    odontogram.setState({
      marks: [
        {
          id: "custom-mark-1",
          type: "custom-plugin-telemetry",
          status: "existing",
          tooth: "16",
          surfaces: ["O"],
          text: "Custom probe reading",
          metadata: {
            probeMm: [3, 2, 4],
            sensorId: "sens-99",
          },
          style: { fill: "#123456" },
        },
      ],
    });

    const state = odontogram.getState();
    expect(state.marks).toHaveLength(1);
    expect(state.marks[0].type).toBe("custom-plugin-telemetry");
    expect(state.marks[0].metadata).toEqual({
      probeMm: [3, 2, 4],
      sensorId: "sens-99",
    });
    expect(state.marks[0].style).toEqual({ fill: "#123456" });
  });

  it("runs validate() on the odontogram instance and emits validationDidChange callback for non-fatal diagnostics", () => {
    let validationResults: ValidationResult | null = null;
    const odontogram = new Odontogram(container, {
      initialView: "permanent",
      validator: {
        incompatibleTypes: [["implant", "natural-root"]],
      },
      validationDidChange: (arg) => {
        validationResults = arg.result;
      },
    });

    // Valid state with a coexistence warning
    odontogram.setState({
      marks: [
        { id: "m-imp", tooth: "16", type: "implant" },
        { id: "m-nat", tooth: "16", type: "natural-root" },
      ],
    });

    const results = validationResults as ValidationResult | null;
    expect(results).toBeTruthy();
    expect(results?.valid).toBe(true);
    expect(results?.warnings.length).toBeGreaterThan(0);
    expect(results?.warnings[0].code).toBe(VALIDATION_CODES.WARN_INCOMPATIBLE_MARKS);

    const directResult = odontogram.validate();
    expect(directResult.valid).toBe(true);
    expect(directResult.warnings).toHaveLength(1);
  });
});
