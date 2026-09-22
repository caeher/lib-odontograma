import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { OdontogramError, VALIDATION_CODES } from "./errors.js";

describe("Reset, Referential Integrity & Multi-Instance Isolation (Stage 02)", () => {
  let container1: HTMLElement;
  let container2: HTMLElement;

  beforeEach(() => {
    container1 = document.createElement("div");
    container2 = document.createElement("div");
    document.body.appendChild(container1);
    document.body.appendChild(container2);
  });

  afterEach(() => {
    container1.remove();
    container2.remove();
  });

  describe("Reset Operations", () => {
    it("reset() restores odontogram to initial state snapshot", () => {
      const odontogram = new Odontogram(container1, { initialView: "permanent" });

      odontogram.changeView("deciduous");
      odontogram.addMark({ tooth: "55", surfaces: ["O"], type: "caries" });
      odontogram.setToothState("54", "missing");
      odontogram.selectTooth("55");

      expect(odontogram.getMarks()).toHaveLength(1);
      expect(odontogram.getToothPresence("54")).toBe("missing");
      expect(odontogram.getSelection().teeth).toEqual(["55"]);
      expect(odontogram.getState().view).toBe("deciduous");

      // Reset
      odontogram.reset();

      const state = odontogram.getState();
      expect(state.view).toBe("permanent");
      expect(state.marks).toEqual([]);
      expect(state.teeth).toEqual({});
      expect(state.selection).toEqual({ teeth: [], surfaces: [] });
    });

    it("reset() respects keepView and keepSelection options", () => {
      const odontogram = new Odontogram(container1, { initialView: "permanent" });

      odontogram.changeView("deciduous");
      odontogram.addMark({ tooth: "55", surfaces: ["O"], type: "caries" });
      odontogram.selectTooth("55");

      odontogram.reset({ keepView: true, keepSelection: true });

      const state = odontogram.getState();
      expect(state.view).toBe("deciduous");
      expect(state.selection.teeth).toEqual(["55"]);
      expect(state.marks).toEqual([]);
    });

    it("resetMarks(), resetTeeth(), and resetSelection() perform selective cleanups", () => {
      const odontogram = new Odontogram(container1);
      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      odontogram.setToothState("18", "missing");
      odontogram.selectTooth("16");

      odontogram.resetMarks();
      expect(odontogram.getMarks()).toEqual([]);
      expect(odontogram.hasToothOverlay("18")).toBe(true);

      odontogram.resetTeeth();
      expect(odontogram.getTeethState()).toEqual({});

      odontogram.clearSelection();
      expect(odontogram.getSelection().teeth).toEqual([]);
    });
  });

  describe("Referential Integrity & Orphaned Mark Pruning", () => {
    it("pruneOrphanedMarks() removes surface marks conflicting with missing/unerupted teeth", () => {
      // Configure with allowMissingToothMarks: true to stage data
      const odontogram = new Odontogram(container1, {
        validator: { allowMissingToothMarks: true },
      });
      odontogram.addMarks([
        { id: "m1-surf", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m1-whole", tooth: "16", type: "implant" },
        { id: "m2-valid", tooth: "26", surfaces: ["O"], type: "caries" },
      ]);

      // Set tooth 16 as missing
      odontogram.setToothState("16", "missing");

      // Run pruneOrphanedMarks
      const prunedCount = odontogram.pruneOrphanedMarks();
      expect(prunedCount).toBe(1);

      // m1-surf is removed, m1-whole (implant) and m2-valid remain
      expect(odontogram.hasMark("m1-surf")).toBe(false);
      expect(odontogram.hasMark("m1-whole")).toBe(true);
      expect(odontogram.hasMark("m2-valid")).toBe(true);
    });
  });

  describe("Headless & DOM-Independent Execution", () => {
    it("allows full state management and CRUD in headless mode without DOM container", () => {
      // Instantiated without container (null or omitted)
      const headless = new Odontogram(null, {
        initialView: "permanent",
        notation: "universal",
      });

      expect(headless.getMode()).toBe("internal");
      expect(headless.getRevision()).toBe(0);

      // Programmatic CRUD
      const mark = headless.addMark({
        tooth: "16",
        surfaces: ["M", "O"],
        type: "restoration",
      });
      expect(headless.hasMark(mark.id)).toBe(true);

      headless.setToothState("18", "missing");
      expect(headless.getToothPresence("18")).toBe("missing");

      headless.selectTooth("16");
      expect(headless.isToothSelected("16")).toBe(true);

      // Validation
      const result = headless.validate();
      expect(result.valid).toBe(true);

      // Calling render() without container throws informative error
      expect(() => headless.render()).toThrow(OdontogramError);
      expect(() => headless.render()).toThrow(
        expect.objectContaining({ code: VALIDATION_CODES.ERR_NO_CONTAINER }),
      );

      // Attaching container dynamically to render()
      const div = document.createElement("div");
      headless.render(div);
      expect(div.querySelector(".odontogram-host")).toBeTruthy();

      headless.destroy();
      expect(div.querySelector(".odontogram-host")).toBeNull();
    });
  });

  describe("Complete Multi-Instance Isolation", () => {
    it("guarantees complete state, revision, callback, and batch isolation between concurrent instances", () => {
      const stateChange1 = vi.fn();
      const stateChange2 = vi.fn();

      const od1 = new Odontogram(container1, { stateDidChange: stateChange1 });
      const od2 = new Odontogram(container2, { stateDidChange: stateChange2 });

      // Mutate instance 1
      od1.addMark({ id: "od1-mark", tooth: "16", surfaces: ["O"], type: "caries" });
      od1.setToothState("18", "missing");
      od1.selectTooth("16");

      expect(od1.getRevision()).toBe(3);
      expect(od1.getMarks()).toHaveLength(1);
      expect(od1.hasToothOverlay("18")).toBe(true);
      expect(od1.isToothSelected("16")).toBe(true);
      expect(stateChange1).toHaveBeenCalledTimes(3);

      // Instance 2 MUST be completely unaffected
      expect(od2.getRevision()).toBe(0);
      expect(od2.getMarks()).toHaveLength(0);
      expect(od2.hasToothOverlay("18")).toBe(false);
      expect(od2.isToothSelected("16")).toBe(false);
      expect(stateChange2).not.toHaveBeenCalled();

      // Mutate instance 2 in batch
      od2.batch(() => {
        od2.addMark({ id: "od2-mark", tooth: "26", surfaces: ["M"], type: "restoration" });
        od2.setToothState("28", "unerupted");
      });

      expect(od2.getRevision()).toBe(1);
      expect(od2.getMarks()).toHaveLength(1);
      expect(od2.getMarks()[0].id).toBe("od2-mark");
      expect(od2.getToothPresence("28")).toBe("unerupted");

      // Instance 1 remains untouched
      expect(od1.getRevision()).toBe(3);
      expect(od1.getMarks()).toHaveLength(1);
      expect(od1.getMarks()[0].id).toBe("od1-mark");

      // Reset instance 1 does not affect instance 2
      od1.reset();
      expect(od1.getMarks()).toHaveLength(0);
      expect(od2.getMarks()).toHaveLength(1);
    });
  });
});
