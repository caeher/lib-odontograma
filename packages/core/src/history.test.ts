import { describe, expect, it, vi } from "vitest";
import { Odontogram } from "./odontogram.js";

describe("odontogram local history", () => {
  it("undoes and redoes combined mark and tooth state changes", () => {
    const odontogram = new Odontogram(null, { historyLimit: 5 });
    odontogram.batch(() => {
      odontogram.addMark({ id: "m1", tooth: "16", surfaces: ["M", "O"], type: "caries" });
      odontogram.setToothState("18", "missing");
    });
    expect(odontogram.canUndo()).toBe(true);
    expect(odontogram.canRedo()).toBe(false);
    expect(odontogram.undo()).toBe(true);
    expect(odontogram.getState().marks).toEqual([]);
    expect(odontogram.getState().teeth).toEqual({});
    expect(odontogram.canRedo()).toBe(true);
    expect(odontogram.redo()).toBe(true);
    expect(odontogram.getState().marks).toHaveLength(1);
    expect(odontogram.getState().teeth["18"]?.presence).toBe("missing");
  });

  it("retains enough prior mark state to undo create, update, and delete", () => {
    const odontogram = new Odontogram(null);
    odontogram.addMark({ id: "m1", tooth: "16", type: "caries", surfaces: ["O"] });
    odontogram.updateMark("m1", { type: "restoration", surfaces: ["M", "O"] });
    odontogram.removeMark("m1");

    expect(odontogram.undo()).toBe(true);
    expect(odontogram.getMark("m1")?.type).toBe("restoration");
    expect(odontogram.undo()).toBe(true);
    expect(odontogram.getMark("m1")?.type).toBe("caries");
    expect(odontogram.getMark("m1")?.surfaces).toEqual(["O"]);
    expect(odontogram.undo()).toBe(true);
    expect(odontogram.hasMark("m1")).toBe(false);
  });

  it("clears redo on a new edit and enforces the configured memory limit", () => {
    const odontogram = new Odontogram(null, { historyLimit: 2 });
    odontogram.setToothState("16", "missing");
    odontogram.setToothState("17", "missing");
    odontogram.setToothState("18", "missing");
    expect(odontogram.undo()).toBe(true);
    expect(odontogram.undo()).toBe(true);
    expect(odontogram.undo()).toBe(false);
    expect(odontogram.redo()).toBe(true);
    odontogram.setToothState("19", "unerupted");
    expect(odontogram.canRedo()).toBe(false);
  });

  it("clears local history for external state and does not enable it in controlled mode", () => {
    const odontogram = new Odontogram(null);
    odontogram.addMark({ id: "m1", tooth: "16", type: "crown" });
    odontogram.setState({ marks: [] }, { source: "external" });
    expect(odontogram.canUndo()).toBe(false);
    expect(odontogram.undo()).toBe(false);

    const controlled = new Odontogram(null, { mode: "controlled" });
    controlled.setState(
      { marks: [{ id: "host", tooth: "16", type: "crown" }] },
      { source: "external" },
    );
    expect(controlled.canUndo()).toBe(false);
    expect(controlled.canRedo()).toBe(false);
  });

  it("notifies when undo and redo availability changes", () => {
    const historyDidChange = vi.fn();
    const odontogram = new Odontogram(null, { historyDidChange });
    odontogram.addMark({ id: "m1", tooth: "16", type: "crown" });
    odontogram.undo();
    odontogram.redo();
    expect(historyDidChange).toHaveBeenCalledWith({
      canUndo: true,
      canRedo: false,
      undoCount: 1,
      redoCount: 0,
    });
    expect(historyDidChange).toHaveBeenCalledTimes(3);
  });
});
