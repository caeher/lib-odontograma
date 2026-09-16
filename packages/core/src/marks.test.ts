import { describe, it, expect } from "vitest";
import {
  createMark,
  getMarksForSurface,
  getMarksForTooth,
  getMarkTargetSurfaces,
  getMarkTargetTeeth,
  isComplexTarget,
  isMultiToothMark,
  isMultiToothTarget,
  isSurfaceMark,
  isSurfaceTarget,
  isWholeToothMark,
  isWholeToothTarget,
  normalizeMark,
  normalizeMarks,
  normalizeTarget,
} from "./marks.js";
import type { OdontographicMark } from "./types.js";

describe("Marks utilities", () => {
  describe("target type guards and normalization", () => {
    it("recognizes surface targets", () => {
      const target = { tooth: "16", surfaces: ["M" as const, "O" as const] };
      expect(isSurfaceTarget(target)).toBe(true);
      expect(isWholeToothTarget(target)).toBe(false);
      expect(isMultiToothTarget(target)).toBe(false);
    });

    it("recognizes whole tooth targets", () => {
      const target = { tooth: "16" };
      expect(isWholeToothTarget(target)).toBe(true);
      expect(isSurfaceTarget(target)).toBe(false);
      expect(isMultiToothTarget(target)).toBe(false);
    });

    it("recognizes multi-tooth targets", () => {
      const target = { teeth: ["14", "15", "16"] };
      expect(isMultiToothTarget(target)).toBe(true);
      expect(isSurfaceTarget(target)).toBe(false);
      expect(isWholeToothTarget(target)).toBe(false);
    });

    it("recognizes complex targets", () => {
      const target = {
        elements: [
          { tooth: "14", surfaces: ["D" as const] },
          { tooth: "16", surfaces: ["M" as const] },
        ],
      };
      expect(isComplexTarget(target)).toBe(true);
    });

    it("normalizes legacy tooth and surfaces format", () => {
      const mark = normalizeMark({
        id: "m1",
        tooth: "16",
        surfaces: ["M", "O", "D"],
        type: "restoration",
      });

      expect(mark.id).toBe("m1");
      expect(mark.type).toBe("restoration");
      expect(mark.target).toEqual({
        kind: "surface",
        tooth: "16",
        surfaces: ["M", "O", "D"],
      });
      expect(mark.tooth).toBe("16");
      expect(mark.surfaces).toEqual(["M", "O", "D"]);
      expect(isSurfaceMark(mark)).toBe(true);
    });

    it("normalizes whole-tooth mark shorthand", () => {
      const mark = normalizeMark({
        id: "m2",
        tooth: "36",
        type: "crown",
        status: "completed",
        text: "Full zirconia crown",
        metadata: { shade: "A2" },
      });

      expect(isWholeToothMark(mark)).toBe(true);
      expect(mark.target).toEqual({ kind: "tooth", tooth: "36" });
      expect(mark.tooth).toBe("36");
      expect(mark.surfaces).toEqual([]);
      expect(mark.status).toBe("completed");
      expect(mark.text).toBe("Full zirconia crown");
      expect(mark.metadata).toEqual({ shade: "A2" });
    });

    it("normalizes multi-tooth group shorthand", () => {
      const mark = normalizeMark({
        id: "m3",
        teeth: ["14", "15", "16"],
        type: "bridge",
        status: "planned",
      });

      expect(isMultiToothMark(mark)).toBe(true);
      expect(mark.target).toEqual({
        kind: "teeth",
        teeth: ["14", "15", "16"],
      });
      expect(getMarkTargetTeeth(mark)).toEqual(["14", "15", "16"]);
    });
  });

  describe("query helpers", () => {
    const marks: OdontographicMark[] = normalizeMarks([
      {
        id: "m-mod-16",
        type: "restoration",
        status: "completed",
        tooth: "16",
        surfaces: ["M", "O", "D"],
      },
      {
        id: "m-caries-b-16",
        type: "caries",
        status: "existing",
        tooth: "16",
        surfaces: ["B"],
      },
      {
        id: "m-crown-36",
        type: "crown",
        status: "completed",
        tooth: "36",
      },
      {
        id: "m-bridge-14-16",
        type: "bridge",
        status: "planned",
        teeth: ["14", "15", "16"],
      },
    ]);

    it("retrieves all marks targeting a tooth across single and multi-tooth targets", () => {
      const tooth16Marks = getMarksForTooth(marks, "16");
      expect(tooth16Marks).toHaveLength(3);
      expect(tooth16Marks.map((m) => m.id)).toEqual([
        "m-mod-16",
        "m-caries-b-16",
        "m-bridge-14-16",
      ]);

      const tooth15Marks = getMarksForTooth(marks, "15");
      expect(tooth15Marks).toHaveLength(1);
      expect(tooth15Marks[0].id).toBe("m-bridge-14-16");

      const tooth36Marks = getMarksForTooth(marks, "36");
      expect(tooth36Marks).toHaveLength(1);
      expect(tooth36Marks[0].id).toBe("m-crown-36");
    });

    it("retrieves marks targeting specific surfaces", () => {
      const occlusalMarks = getMarksForSurface(marks, "16", "O");
      expect(occlusalMarks).toHaveLength(1);
      expect(occlusalMarks[0].id).toBe("m-mod-16");

      const buccalMarks = getMarksForSurface(marks, "16", "B");
      expect(buccalMarks).toHaveLength(1);
      expect(buccalMarks[0].id).toBe("m-caries-b-16");

      const lingualMarks = getMarksForSurface(marks, "16", "L");
      expect(lingualMarks).toHaveLength(0);
    });

    it("extracts target surfaces and teeth from marks accurately", () => {
      expect(getMarkTargetSurfaces(marks[0])).toEqual(["M", "O", "D"]);
      expect(getMarkTargetTeeth(marks[3])).toEqual(["14", "15", "16"]);
    });

    it("supports multiple marks on one tooth while preserving their distinct IDs", () => {
      const tooth16Marks = getMarksForTooth(marks, "16");
      const ids = tooth16Marks.map((m) => m.id);
      expect(new Set(ids).size).toBe(tooth16Marks.length);
      expect(ids).toContain("m-mod-16");
      expect(ids).toContain("m-caries-b-16");
    });
  });
});
