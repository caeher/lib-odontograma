import { describe, it, expect } from "vitest";
import {
  createValidator,
  RULE_MARK_COEXISTENCE,
  RULE_MARK_ID_UNIQUE,
  RULE_SURFACE_APPLICABILITY,
  RULE_TARGET_INTEGRITY,
  RULE_TOOTH_PRESENCE_COEXISTENCE,
  validateMarks,
  validateOdontogramState,
} from "./validation.js";
import { normalizeMarks } from "./marks.js";
import type { OdontogramState } from "./types.js";

describe("Odontogram Validation", () => {
  describe("RULE_MARK_ID_UNIQUE", () => {
    it("detects empty mark IDs", () => {
      const marks = normalizeMarks([
        { id: "", tooth: "16", surfaces: ["O"], type: "caries" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_MARK_ID_UNIQUE)).toBe(true);
    });

    it("detects duplicate mark IDs", () => {
      const marks = normalizeMarks([
        { id: "dup-1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "dup-1", tooth: "26", surfaces: ["O"], type: "restoration" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_MARK_ID_UNIQUE)).toBe(true);
      expect(result.errors[0].message).toContain('Duplicate mark id "dup-1"');
    });

    it("passes when all mark IDs are unique", () => {
      const marks = normalizeMarks([
        { id: "m-1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "m-2", tooth: "16", surfaces: ["B"], type: "restoration" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(true);
    });
  });

  describe("RULE_TARGET_INTEGRITY", () => {
    it("detects surface marks with empty surfaces array", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-empty-surf",
            type: "restoration",
            target: { kind: "surface", tooth: "16", surfaces: [] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_TARGET_INTEGRITY)).toBe(true);
    });

    it("detects invalid clinical surface codes", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-invalid-surf",
            type: "restoration",
            target: { kind: "surface", tooth: "16", surfaces: ["X" as any] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_TARGET_INTEGRITY)).toBe(true);
      expect(result.errors[0].message).toContain('Invalid clinical surface code "X"');
    });

    it("detects duplicate surfaces in a single mark target", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-dup-surf",
            type: "restoration",
            target: { kind: "surface", tooth: "16", surfaces: ["M", "O", "M"] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_TARGET_INTEGRITY)).toBe(true);
      expect(result.errors[0].message).toContain('Duplicate surface "M"');
    });

    it("detects multi-tooth marks with empty teeth array", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-empty-teeth",
            type: "bridge",
            target: { kind: "teeth", teeth: [] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_TARGET_INTEGRITY)).toBe(true);
    });
  });

  describe("RULE_SURFACE_APPLICABILITY", () => {
    it("flags occlusal surface on anterior teeth as invalid", () => {
      const marks = normalizeMarks([
        { id: "m-incisor-occ", tooth: "11", surfaces: ["O"], type: "caries" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_SURFACE_APPLICABILITY)).toBe(true);
      expect(result.errors[0].message).toContain('Surface "O" is clinically inapplicable for tooth "11"');
    });

    it("flags incisal surface on posterior teeth as invalid", () => {
      const marks = normalizeMarks([
        { id: "m-molar-inc", tooth: "16", surfaces: ["I"], type: "caries" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_SURFACE_APPLICABILITY)).toBe(true);
      expect(result.errors[0].message).toContain('Surface "I" is clinically inapplicable for tooth "16"');
    });

    it("allows incisal on anterior teeth and occlusal on posterior teeth", () => {
      const marks = normalizeMarks([
        { id: "m-1", tooth: "11", surfaces: ["M", "I", "D"], type: "restoration" },
        { id: "m-2", tooth: "16", surfaces: ["M", "O", "D"], type: "restoration" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(true);
    });
  });

  describe("RULE_TOOTH_PRESENCE_COEXISTENCE", () => {
    it("flags surface marks on missing teeth", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-missing-caries", tooth: "16", surfaces: ["O"], type: "caries" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {
          "16": { presence: "missing" },
        },
      };

      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.ruleId === RULE_TOOTH_PRESENCE_COEXISTENCE),
      ).toBe(true);
      expect(result.errors[0].message).toContain(
        'Tooth "16" is marked as missing; recording surface mark "m-missing-caries"',
      );
    });

    it("allows marks on missing teeth when allowMissingToothMarks is enabled", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-missing-caries", tooth: "16", surfaces: ["O"], type: "caries" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {
          "16": { presence: "missing" },
        },
      };

      const result = validateOdontogramState(state, {
        allowMissingToothMarks: true,
      });
      expect(result.valid).toBe(true);
    });

    it("flags surface restorations on unerupted teeth", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-unerupted-resto", tooth: "28", surfaces: ["O"], type: "restoration" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {
          "28": { presence: "unerupted" },
        },
      };

      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.ruleId === RULE_TOOTH_PRESENCE_COEXISTENCE),
      ).toBe(true);
    });
  });

  describe("RULE_MARK_COEXISTENCE & Incompatible Types", () => {
    it("detects configured incompatible mark types on the same tooth", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-imp", tooth: "16", type: "implant" },
          { id: "m-nat", tooth: "16", type: "natural-root" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };

      const result = validateOdontogramState(state, {
        incompatibleTypes: [["implant", "natural-root"]],
      });

      expect(result.warnings.some((w) => w.ruleId === RULE_MARK_COEXISTENCE)).toBe(true);
      expect(result.warnings[0].message).toContain('Incompatible mark types "implant"');
    });

    it("elevates warnings to errors in strict mode", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-imp", tooth: "16", type: "implant" },
          { id: "m-nat", tooth: "16", type: "natural-root" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };

      const result = validateOdontogramState(state, {
        incompatibleTypes: [["implant", "natural-root"]],
        strict: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === RULE_MARK_COEXISTENCE)).toBe(true);
    });
  });

  describe("Custom Validation Rules and Configurable Rules", () => {
    it("executes custom validation rules", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-custom", tooth: "16", surfaces: ["O"], type: "custom-forbidden" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };

      const customRule = (s: OdontogramState) => {
        const forbidden = s.marks.find((m) => m.type === "custom-forbidden");
        if (forbidden) {
          return {
            ruleId: "no-forbidden-type",
            severity: "error" as const,
            message: "Custom forbidden mark type is not allowed.",
            markId: forbidden.id,
          };
        }
        return null;
      };

      const result = validateOdontogramState(state, {
        customRules: [customRule],
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleId).toBe("no-forbidden-type");
    });

    it("allows disabling specific rules by ID", () => {
      const marks = normalizeMarks([
        { id: "m-1", tooth: "11", surfaces: ["O"], type: "caries" },
      ]);
      const result = validateMarks(marks, {}, {
        rules: {
          [RULE_SURFACE_APPLICABILITY]: false,
        },
      });
      expect(result.valid).toBe(true);
    });

    it("createValidator creates reusable configured validator instance", () => {
      const validator = createValidator({
        allowMissingToothMarks: true,
      });

      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-1", tooth: "16", surfaces: ["O"], type: "caries" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: { "16": { presence: "missing" } },
      };

      const result = validator(state);
      expect(result.valid).toBe(true);
    });
  });
});
