import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import { OdontogramValidationError } from "./errors.js";
import type { ViewRenderContext } from "./types.js";

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

describe("Atomic Batch Operations & Transactional Rollback (Stage 02)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("coalesces compound operations into a single revision increment, single callback, and single render", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const marksSetSpy = vi.fn();
    const selectionSpy = vi.fn();
    const stateChangeSpy = vi.fn();

    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
      marksSet: marksSetSpy,
      selectionDidChange: selectionSpy,
      stateDidChange: stateChangeSpy,
    });

    odontogram.render();
    const rendersAfterMount = view.render.mock.calls.length;
    expect(odontogram.getRevision()).toBe(0);

    // Execute batch with multiple compound operations
    odontogram.batch(() => {
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      odontogram.addMark({ tooth: "26", surfaces: ["M"], type: "restoration" });
      odontogram.setToothState("18", "missing");
      odontogram.selectTooth("16");
    });

    // Exactly one revision increment for the entire compound batch
    expect(odontogram.getRevision()).toBe(1);

    // Callbacks fired exactly once with final aggregated results
    expect(marksSetSpy).toHaveBeenCalledTimes(1);
    expect(selectionSpy).toHaveBeenCalledTimes(1);
    expect(stateChangeSpy).toHaveBeenCalledTimes(1);

    const stateChangeArg = stateChangeSpy.mock.calls[0][0];
    expect(stateChangeArg.source).toBe("batch");
    expect(stateChangeArg.changedProperties).toEqual(
      expect.arrayContaining(["marks", "teeth", "selection"]),
    );
    expect(stateChangeArg.state.marks).toHaveLength(2);

    // View rendered exactly once after mount
    expect(view.render.mock.calls.length).toBe(rendersAfterMount + 1);
  });

  it("rolls back all staged changes to pre-batch snapshot when an error occurs inside the batch", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const stateChangeSpy = vi.fn();

    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
      stateDidChange: stateChangeSpy,
    });

    odontogram.render();

    // Setup initial valid state
    odontogram.addMark({ id: "initial-mark", tooth: "11", surfaces: ["M"], type: "caries" });
    expect(odontogram.getRevision()).toBe(1);
    const preBatchState = odontogram.getState();
    const rendersBefore = view.render.mock.calls.length;
    const stateChangesBefore = stateChangeSpy.mock.calls.length;

    // Execute failing batch
    expect(() => {
      odontogram.batch(() => {
        odontogram.addMark({ id: "staged-mark-1", tooth: "16", surfaces: ["O"], type: "caries" });
        odontogram.setToothState("28", "missing");

        // Force a validation error or throw exception inside batch
        throw new Error("Simulated transactional failure");
      });
    }).toThrow("Simulated transactional failure");

    // State MUST be completely restored to pre-batch snapshot
    expect(odontogram.getState()).toEqual(preBatchState);
    expect(odontogram.getRevision()).toBe(1);
    expect(odontogram.hasMark("staged-mark-1")).toBe(false);
    expect(odontogram.hasToothOverlay("28")).toBe(false);

    // No renders or callbacks dispatched for aborted batch
    expect(view.render.mock.calls.length).toBe(rendersBefore);
    expect(stateChangeSpy.mock.calls.length).toBe(stateChangesBefore);
  });

  it("rolls back when an atomic validation error is triggered inside the batch", () => {
    const odontogram = new Odontogram(container);
    odontogram.addMark({ id: "valid-1", tooth: "11", surfaces: ["M"], type: "caries" });

    const stateBefore = odontogram.getState();
    const revBefore = odontogram.getRevision();

    expect(() => {
      odontogram.batch(() => {
        odontogram.addMark({ id: "valid-2", tooth: "21", surfaces: ["D"], type: "restoration" });
        // Duplicate mark ID causes validation error
        odontogram.addMark({ id: "valid-1", tooth: "31", surfaces: ["M"], type: "caries" });
      });
    }).toThrow(OdontogramValidationError);

    expect(odontogram.getState()).toEqual(stateBefore);
    expect(odontogram.getRevision()).toBe(revBefore);
    expect(odontogram.getMarks()).toHaveLength(1);
  });

  it("supports nested batches and only commits at the outermost batch exit", () => {
    const stateChangeSpy = vi.fn();
    const odontogram = new Odontogram(container, {
      stateDidChange: stateChangeSpy,
    });

    odontogram.batch(() => {
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });

      odontogram.batch(() => {
        odontogram.addMark({ tooth: "26", surfaces: ["M"], type: "restoration" });

        odontogram.batch(() => {
          odontogram.setToothState("48", "missing");
        });
      });
    });

    // 1 single revision increment and 1 callback emission
    expect(odontogram.getRevision()).toBe(1);
    expect(stateChangeSpy).toHaveBeenCalledTimes(1);
    expect(odontogram.getMarks()).toHaveLength(2);
    expect(odontogram.getToothPresence("48")).toBe("missing");
  });
});
