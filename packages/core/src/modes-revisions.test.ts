import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import type { StateChangeArg, ToothStateChangeArg } from "./types.js";

describe("Controlled vs Internal Modes & Revisions (Stage 02)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("Mode Configuration", () => {
    it("defaults to 'internal' mode", () => {
      const odontogram = new Odontogram(container);
      expect(odontogram.getMode()).toBe("internal");
    });

    it("respects 'controlled' mode configuration", () => {
      const odontogram = new Odontogram(container, { mode: "controlled" });
      expect(odontogram.getMode()).toBe("controlled");
    });
  });

  describe("Revision Tracking", () => {
    it("starts at revision 0 and increments on discrete state updates", () => {
      const odontogram = new Odontogram(container);
      expect(odontogram.getRevision()).toBe(0);

      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      expect(odontogram.getRevision()).toBe(1);

      odontogram.setToothState("18", "missing");
      expect(odontogram.getRevision()).toBe(2);

      odontogram.selectTooth("16");
      expect(odontogram.getRevision()).toBe(3);

      odontogram.clearMarks();
      expect(odontogram.getRevision()).toBe(4);
    });

    it("does not increment revision or fire callbacks on identical idempotent setState", () => {
      const marksSetSpy = vi.fn();
      const stateChangeSpy = vi.fn();

      const odontogram = new Odontogram(container, {
        marksSet: marksSetSpy,
        stateDidChange: stateChangeSpy,
      });

      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      });

      expect(odontogram.getRevision()).toBe(1);
      expect(marksSetSpy).toHaveBeenCalledTimes(1);
      expect(stateChangeSpy).toHaveBeenCalledTimes(1);

      // Call setState with identical structure
      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      });

      // Must remain at revision 1 and not fire duplicate callbacks
      expect(odontogram.getRevision()).toBe(1);
      expect(marksSetSpy).toHaveBeenCalledTimes(1);
      expect(stateChangeSpy).toHaveBeenCalledTimes(1);
    });

    it("synchronizes explicit revision passed in SetStateOptions", () => {
      const odontogram = new Odontogram(container);
      expect(odontogram.getRevision()).toBe(0);

      odontogram.setState(
        {
          marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
        },
        { revision: 105, source: "external" },
      );

      expect(odontogram.getRevision()).toBe(105);
    });
  });

  describe("State Change Callbacks & Diffs", () => {
    it("dispatches stateDidChange with accurate changedProperties and previousState", () => {
      let capturedArg: StateChangeArg | null = null;
      const odontogram = new Odontogram(container, {
        stateDidChange: (arg) => {
          capturedArg = arg;
        },
      });

      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
        teeth: { "18": { presence: "missing" } },
      });

      expect(capturedArg).toBeTruthy();
      expect(capturedArg!.revision).toBe(1);
      expect(capturedArg!.source).toBe("internal");
      expect(capturedArg!.changedProperties).toEqual(expect.arrayContaining(["marks", "teeth"]));
      expect(capturedArg!.previousState.marks).toEqual([]);
      expect(capturedArg!.state.marks).toHaveLength(1);
      expect(capturedArg!.state.teeth["18"]?.presence).toBe("missing");
    });

    it("dispatches toothStateDidChange for changed tooth overlay entries", () => {
      const capturedChanges: ToothStateChangeArg[] = [];
      const odontogram = new Odontogram(container, {
        toothStateDidChange: (arg) => {
          capturedChanges.push(arg);
        },
      });

      odontogram.setToothState("16", "missing");
      odontogram.setToothState("26", "unerupted");
      odontogram.setToothState("16", "present");

      expect(capturedChanges).toHaveLength(3);

      expect(capturedChanges[0]).toEqual({
        toothId: "16",
        state: { presence: "missing" },
        previousState: { presence: "present" },
      });

      expect(capturedChanges[1]).toEqual({
        toothId: "26",
        state: { presence: "unerupted" },
        previousState: { presence: "present" },
      });

      expect(capturedChanges[2]).toEqual({
        toothId: "16",
        state: { presence: "present" },
        previousState: { presence: "missing" },
      });
    });
  });
});
