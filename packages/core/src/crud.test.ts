import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { OdontogramError } from "./errors.js";
import type { SurfaceId } from "./types.js";

describe("Typed CRUD Operations (Stage 02)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("Marks CRUD & Queries", () => {
    it("addMark() creates a mark with auto-generated stable ID when ID is omitted", () => {
      const odontogram = new Odontogram(container);
      const created = odontogram.addMark({
        tooth: "16",
        surfaces: ["O"],
        type: "caries",
        text: "Occlusal caries",
      });

      expect(created.id).toBeDefined();
      expect(typeof created.id).toBe("string");
      expect(created.id.length).toBeGreaterThan(5);
      expect(created.type).toBe("caries");
      expect(created.tooth).toBe("16");
      expect(created.surfaces).toEqual(["O"]);

      expect(odontogram.hasMark(created.id)).toBe(true);
      expect(odontogram.getMark(created.id)).toEqual(created);
      expect(odontogram.getMarks()).toHaveLength(1);
    });

    it("addMark() preserves explicitly provided ID", () => {
      const odontogram = new Odontogram(container);
      const created = odontogram.addMark({
        id: "explicit-id-123",
        tooth: "26",
        surfaces: ["M", "O"],
        type: "restoration",
      });

      expect(created.id).toBe("explicit-id-123");
      expect(odontogram.getMark("explicit-id-123")).toEqual(created);
    });

    it("addMarks() adds multiple marks in a single atomic update", () => {
      const odontogram = new Odontogram(container);
      const marks = odontogram.addMarks([
        { tooth: "11", surfaces: ["M"], type: "caries" },
        { tooth: "21", surfaces: ["D"], type: "restoration" },
        { teeth: ["13", "14", "15"], type: "bridge" },
      ]);

      expect(marks).toHaveLength(3);
      expect(odontogram.getMarks()).toHaveLength(3);
      expect(odontogram.hasMark(marks[0].id)).toBe(true);
      expect(odontogram.hasMark(marks[1].id)).toBe(true);
      expect(odontogram.hasMark(marks[2].id)).toBe(true);
    });

    it("getMarksForTooth() and getMarksForSurface() query marks accurately", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMarks([
        { id: "m-16-o", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m-16-mod", tooth: "16", surfaces: ["M", "O", "D"], type: "restoration" },
        { id: "m-16-crown", tooth: "16", type: "crown" },
        { id: "m-bridge", teeth: ["14", "15", "16"], type: "bridge" },
        { id: "m-26-b", tooth: "26", surfaces: ["B"], type: "sealant" },
      ]);

      const marks16 = odontogram.getMarksForTooth("16");
      expect(marks16).toHaveLength(4);
      expect(marks16.map((m) => m.id)).toEqual(
        expect.arrayContaining(["m-16-o", "m-16-mod", "m-16-crown", "m-bridge"]),
      );

      const marks16O = odontogram.getMarksForSurface("16", "O");
      expect(marks16O).toHaveLength(2);
      expect(marks16O.map((m) => m.id)).toEqual(expect.arrayContaining(["m-16-o", "m-16-mod"]));

      const marks16M = odontogram.getMarksForSurface("16", "M");
      expect(marks16M).toHaveLength(1);
      expect(marks16M[0].id).toBe("m-16-mod");
    });

    it("updateMark() updates properties while strictly preserving persistent ID", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMark({
        id: "orig-mark-1",
        tooth: "16",
        surfaces: ["O"],
        type: "caries",
        text: "Small pit",
        metadata: { depth: "enamel" },
      });

      // Update with object patch
      const updated1 = odontogram.updateMark("orig-mark-1", {
        surfaces: ["O", "M"] as SurfaceId[],
        text: "Enlarged pit",
        metadata: { depth: "dentin" },
      });

      expect(updated1.id).toBe("orig-mark-1");
      expect(updated1.surfaces).toEqual(["O", "M"]);
      expect(updated1.text).toBe("Enlarged pit");
      expect(updated1.metadata).toEqual({ depth: "dentin" });

      // Update with functional updater and attempted ID change
      const updated2 = odontogram.updateMark("orig-mark-1", (prev) => ({
        ...prev,
        id: "attempted-hijack-id",
        type: "restoration",
        status: "completed",
      }));

      // ID MUST stay original
      expect(updated2.id).toBe("orig-mark-1");
      expect(updated2.type).toBe("restoration");
      expect(updated2.status).toBe("completed");
      expect(odontogram.hasMark("attempted-hijack-id")).toBe(false);
      expect(odontogram.hasMark("orig-mark-1")).toBe(true);
    });

    it("updateMark() throws OdontogramError when mark is not found", () => {
      const odontogram = new Odontogram(container);
      expect(() =>
        odontogram.updateMark("non-existent-id", {
          type: "restoration",
        }),
      ).toThrow(OdontogramError);
    });

    it("removeMark(), removeMarks(), and removeMarksForTooth() delete marks correctly", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMarks([
        { id: "m1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m2", tooth: "16", surfaces: ["M"], type: "restoration" },
        { id: "m3", tooth: "26", surfaces: ["D"], type: "caries" },
        { id: "m4", tooth: "36", surfaces: ["B"], type: "sealant" },
      ]);

      // removeMark single
      expect(odontogram.removeMark("m1")).toBe(true);
      expect(odontogram.removeMark("m1")).toBe(false);
      expect(odontogram.getMarks()).toHaveLength(3);

      // removeMarks multiple
      const removedCount = odontogram.removeMarks(["m3", "non-existent"]);
      expect(removedCount).toBe(1);
      expect(odontogram.getMarks()).toHaveLength(2);

      // removeMarksForTooth
      const toothRemoved = odontogram.removeMarksForTooth("16");
      expect(toothRemoved).toBe(1);
      expect(odontogram.getMarks()).toHaveLength(1);
      expect(odontogram.getMarks()[0].id).toBe("m4");
    });

    it("clearMarks() supports clearing all or clearing with filters", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMarks([
        { id: "m1", tooth: "16", surfaces: ["O"], type: "caries", status: "planned" },
        { id: "m2", tooth: "16", surfaces: ["M"], type: "restoration", status: "completed" },
        { id: "m3", tooth: "26", surfaces: ["O"], type: "caries", status: "completed" },
        { id: "m4", tooth: "36", surfaces: ["B"], type: "sealant", status: "existing" },
      ]);

      // Filter by type
      const removedCaries = odontogram.clearMarks({ type: "caries" });
      expect(removedCaries).toBe(2);
      expect(odontogram.getMarks()).toHaveLength(2);

      // Filter by status
      const removedExisting = odontogram.clearMarks({ status: "existing" });
      expect(removedExisting).toBe(1);
      expect(odontogram.getMarks()).toHaveLength(1);
      expect(odontogram.getMarks()[0].id).toBe("m2");

      // Clear all
      const clearedAll = odontogram.clearMarks();
      expect(clearedAll).toBe(1);
      expect(odontogram.getMarks()).toHaveLength(0);
    });
  });

  describe("Tooth State (Presence Overlay) Operations", () => {
    it("getToothState() and getToothPresence() return defaults and explicit overlays", () => {
      const odontogram = new Odontogram(container);

      // Omitted teeth default to present
      expect(odontogram.getToothPresence("16")).toBe("present");
      expect(odontogram.getToothState("16")).toEqual({ presence: "present" });
      expect(odontogram.hasToothOverlay("16")).toBe(false);

      // Set explicit missing
      odontogram.setToothState("16", "missing");
      expect(odontogram.getToothPresence("16")).toBe("missing");
      expect(odontogram.getToothState("16")).toEqual({ presence: "missing" });
      expect(odontogram.hasToothOverlay("16")).toBe(true);

      // Set explicit unerupted
      odontogram.setToothState("28", { presence: "unerupted" });
      expect(odontogram.getToothPresence("28")).toBe("unerupted");
      expect(odontogram.hasToothOverlay("28")).toBe(true);

      const overlay = odontogram.getTeethState();
      expect(overlay).toEqual({
        "16": { presence: "missing" },
        "28": { presence: "unerupted" },
      });
    });

    it("setToothState() with present/null/undefined resets overlay entry to default present", () => {
      const odontogram = new Odontogram(container);
      odontogram.setToothState("16", "missing");
      expect(odontogram.hasToothOverlay("16")).toBe(true);

      odontogram.setToothState("16", "present");
      expect(odontogram.hasToothOverlay("16")).toBe(false);
      expect(odontogram.getToothPresence("16")).toBe("present");

      odontogram.setToothState("16", "missing");
      odontogram.setToothState("16", null);
      expect(odontogram.hasToothOverlay("16")).toBe(false);
    });

    it("setToothState() with pruneMarks: true cleans up incompatible surface marks", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMarks([
        { id: "m-surf-16", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m-whole-16", tooth: "16", type: "implant" },
      ]);

      // Setting missing with pruneMarks will remove m-surf-16 but keep m-whole-16
      odontogram.setToothState("16", "missing", { pruneMarks: true });

      expect(odontogram.getToothPresence("16")).toBe("missing");
      expect(odontogram.hasMark("m-surf-16")).toBe(false);
      expect(odontogram.hasMark("m-whole-16")).toBe(true);
    });

    it("setTeethState() bulk updates and resetTeethState() resets all overlays", () => {
      const odontogram = new Odontogram(container);
      odontogram.setTeethState({
        "18": "missing",
        "28": "missing",
        "38": "unerupted",
        "48": "unerupted",
      });

      expect(odontogram.getTeethState()).toEqual({
        "18": { presence: "missing" },
        "28": { presence: "missing" },
        "38": { presence: "unerupted" },
        "48": { presence: "unerupted" },
      });

      odontogram.resetToothState("18");
      expect(odontogram.hasToothOverlay("18")).toBe(false);
      expect(odontogram.hasToothOverlay("28")).toBe(true);

      odontogram.resetTeethState();
      expect(odontogram.getTeethState()).toEqual({});
    });
  });

  describe("Selection Operations (DOM-Independent)", () => {
    it("selectTooth() supports replace, add, and toggle modes", () => {
      const odontogram = new Odontogram(container);

      odontogram.selectTooth("16", "replace");
      expect(odontogram.getSelection().teeth).toEqual(["16"]);
      expect(odontogram.isToothSelected("16")).toBe(true);

      odontogram.selectTooth("26", "add");
      expect(odontogram.getSelection().teeth).toEqual(["16", "26"]);

      odontogram.selectTooth("16", "toggle");
      expect(odontogram.getSelection().teeth).toEqual(["26"]);
      expect(odontogram.isToothSelected("16")).toBe(false);

      odontogram.clearSelection();
      expect(odontogram.getSelection().teeth).toEqual([]);
    });

    it("selectSurface() supports replace, add, and toggle modes", () => {
      const odontogram = new Odontogram(container);

      odontogram.selectSurface("16", "O", "replace");
      expect(odontogram.getSelection().surfaces).toEqual([{ tooth: "16", surface: "O" }]);
      expect(odontogram.isSurfaceSelected("16", "O")).toBe(true);

      odontogram.selectSurface("16", "M", "add");
      expect(odontogram.getSelection().surfaces).toEqual([
        { tooth: "16", surface: "O" },
        { tooth: "16", surface: "M" },
      ]);

      odontogram.selectSurface("16", "O", "toggle");
      expect(odontogram.getSelection().surfaces).toEqual([{ tooth: "16", surface: "M" }]);
      expect(odontogram.isSurfaceSelected("16", "O")).toBe(false);

      odontogram.clearSelection();
      expect(odontogram.getSelection().surfaces).toEqual([]);
    });

    it("setSelection() replaces full selection state", () => {
      const odontogram = new Odontogram(container);
      odontogram.setSelection({
        teeth: ["16", "26"],
        surfaces: [{ tooth: "11", surface: "M" }],
      });

      const sel = odontogram.getSelection();
      expect(sel.teeth).toEqual(["16", "26"]);
      expect(sel.surfaces).toEqual([{ tooth: "11", surface: "M" }]);
    });
  });
});
