import { describe, it, expect } from "vitest";
import {
  createValidator,
  RULE_MARK_COEXISTENCE,
  RULE_MARK_ID_UNIQUE,
  RULE_OPTIONS_VALIDITY,
  RULE_SELECTION_INTEGRITY,
  RULE_SURFACE_APPLICABILITY,
  RULE_TARGET_INTEGRITY,
  RULE_TEETH_OVERLAY_INTEGRITY,
  RULE_TOOTH_CATALOG_VALIDITY,
  RULE_TOOTH_PRESENCE_COEXISTENCE,
  validateMarks,
  validateOdontogramState,
  validateOptions,
} from "./validation.js";
import { normalizeMarks } from "./marks.js";
import { VALIDATION_CODES } from "./errors.js";
import type { OdontogramOptions, OdontogramState, SurfaceId } from "./types.js";

describe("Odontogram Validation", () => {
  describe("RULE_MARK_ID_UNIQUE", () => {
    it("detects empty mark IDs and outputs typed code and field path", () => {
      const marks = normalizeMarks([{ id: "", tooth: "16", surfaces: ["O"], type: "caries" }]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_MARK_ID_UNIQUE);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_INVALID_MARK_ID);
      expect(issue?.path).toBe("marks[0].id");
    });

    it("detects duplicate mark IDs and outputs typed code and field path", () => {
      const marks = normalizeMarks([
        { id: "dup-1", tooth: "16", surfaces: ["O"], type: "caries" },
        { id: "dup-1", tooth: "26", surfaces: ["O"], type: "restoration" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_MARK_ID_UNIQUE);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_DUPLICATE_MARK_ID);
      expect(issue?.path).toBe("marks[1].id");
      expect(issue?.message).toContain('Duplicate mark id "dup-1"');
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
    it("detects surface marks with empty surfaces array and outputs typed code and field path", () => {
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
      const issue = result.errors.find((e) => e.ruleId === RULE_TARGET_INTEGRITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_EMPTY_SURFACES);
      expect(issue?.path).toBe("marks[0].target.surfaces");
    });

    it("detects invalid clinical surface codes", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-invalid-surf",
            type: "restoration",
            target: { kind: "surface", tooth: "16", surfaces: ["X" as unknown as SurfaceId] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_TARGET_INTEGRITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_INVALID_SURFACE);
      expect(issue?.path).toBe("marks[0].target.surfaces[0]");
      expect(issue?.message).toContain('Invalid clinical surface code "X"');
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
      const issue = result.errors.find((e) => e.ruleId === RULE_TARGET_INTEGRITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_DUPLICATE_SURFACE);
      expect(issue?.path).toBe("marks[0].target.surfaces[2]");
      expect(issue?.message).toContain('Duplicate surface "M"');
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
      const issue = result.errors.find((e) => e.ruleId === RULE_TARGET_INTEGRITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_EMPTY_TEETH);
      expect(issue?.path).toBe("marks[0].target.teeth");
    });

    it("detects duplicate teeth in multi-tooth marks", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-dup-teeth",
            type: "bridge",
            target: { kind: "teeth", teeth: ["14", "15", "14"] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_TARGET_INTEGRITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_DUPLICATE_TOOTH);
      expect(issue?.path).toBe("marks[0].target.teeth[2]");
    });

    it("accepts ordered support and pontic entries matching a span", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "span-14-16",
            type: "bridge",
            target: {
              kind: "teeth",
              teeth: ["14", "15", "16"],
              targets: [
                { tooth: "14", role: "support", anchor: "anchor-distal" },
                { tooth: "15", role: "pontic", anchor: "anchor-center" },
                { tooth: "16", role: "support", anchor: "anchor-mesial" },
              ],
            },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      expect(validateOdontogramState(state).valid).toBe(true);
    });

    it("rejects ordered span entries that do not match target tooth order", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "span-order-error",
            type: "bridge",
            target: {
              kind: "teeth",
              teeth: ["14", "15", "16"],
              targets: [{ tooth: "15" }, { tooth: "14" }, { tooth: "16" }],
            },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.find((issue) => issue.path === "marks[0].target.targets")?.code).toBe(
        VALIDATION_CODES.ERR_INVALID_TARGET,
      );
    });

    it("detects complex marks with empty elements array", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-empty-elements",
            type: "complex",
            target: { kind: "complex", elements: [] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_TARGET_INTEGRITY);
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_EMPTY_ELEMENTS);
      expect(issue?.path).toBe("marks[0].target.elements");
    });
  });

  describe("RULE_SURFACE_APPLICABILITY", () => {
    it("flags occlusal surface on anterior teeth as invalid with typed code and field path", () => {
      const marks = normalizeMarks([
        { id: "m-incisor-occ", tooth: "11", surfaces: ["O"], type: "caries" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_SURFACE_APPLICABILITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_INAPPLICABLE_SURFACE);
      expect(issue?.path).toBe("marks[0].target.surfaces[0]");
      expect(issue?.message).toContain('Surface "O" is clinically inapplicable for tooth "11"');
    });

    it("flags incisal surface on posterior teeth as invalid", () => {
      const marks = normalizeMarks([
        { id: "m-molar-inc", tooth: "16", surfaces: ["I"], type: "caries" },
      ]);
      const result = validateMarks(marks);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_SURFACE_APPLICABILITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_INAPPLICABLE_SURFACE);
      expect(issue?.path).toBe("marks[0].target.surfaces[0]");
      expect(issue?.message).toContain('Surface "I" is clinically inapplicable for tooth "16"');
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
    it("flags surface marks on missing teeth with ERR_PRESENCE_CONFLICT", () => {
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
      const issue = result.errors.find((e) => e.ruleId === RULE_TOOTH_PRESENCE_COEXISTENCE);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_PRESENCE_CONFLICT);
      expect(issue?.path).toBe("teeth.16.presence");
      expect(issue?.message).toContain(
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
      const issue = result.errors.find((e) => e.ruleId === RULE_TOOTH_PRESENCE_COEXISTENCE);
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_PRESENCE_CONFLICT);
    });
  });

  describe("RULE_TEETH_OVERLAY_INTEGRITY", () => {
    it("detects invalid presence strings with ERR_INVALID_PRESENCE and field path", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [],
        selection: { teeth: [], surfaces: [] },
        teeth: {
          "16": { presence: "decayed" as unknown as "present" },
        },
      };

      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      const issue = result.errors.find((e) => e.ruleId === RULE_TEETH_OVERLAY_INTEGRITY);
      expect(issue).toBeDefined();
      expect(issue?.code).toBe(VALIDATION_CODES.ERR_INVALID_PRESENCE);
      expect(issue?.path).toBe("teeth.16.presence");
    });
  });

  describe("RULE_SELECTION_INTEGRITY", () => {
    it("detects duplicate tooth selection and duplicate surface selections", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [],
        selection: {
          teeth: ["16", "16"],
          surfaces: [
            { tooth: "16", surface: "O" },
            { tooth: "16", surface: "O" },
          ],
        },
        teeth: {},
      };

      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      const errors = result.errors.filter((e) => e.ruleId === RULE_SELECTION_INTEGRITY);
      expect(errors.length).toBe(2);
      expect(errors[0].code).toBe(VALIDATION_CODES.ERR_INVALID_SELECTION);
      expect(errors[0].path).toBe("selection.teeth[1]");
      expect(errors[1].path).toBe("selection.surfaces[1]");
    });
  });

  describe("RULE_OPTIONS_VALIDITY & validateOptions", () => {
    it("detects invalid notation option with ERR_INVALID_OPTION", () => {
      const opts = { notation: "invalid-notation" } as unknown as OdontogramOptions;
      const result = validateOptions(opts);
      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleId).toBe(RULE_OPTIONS_VALIDITY);
      expect(result.errors[0].code).toBe(VALIDATION_CODES.ERR_INVALID_OPTION);
      expect(result.errors[0].path).toBe("options.notation");
    });

    it("emits warning for unknown options with WARN_UNKNOWN_OPTION", () => {
      const opts = { notation: "fdi", unknownCustomProp: 123 } as unknown as OdontogramOptions;
      const result = validateOptions(opts);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].ruleId).toBe(RULE_OPTIONS_VALIDITY);
      expect(result.warnings[0].code).toBe(VALIDATION_CODES.WARN_UNKNOWN_OPTION);
      expect(result.warnings[0].path).toBe("options.unknownCustomProp");
    });
  });

  describe("RULE_TOOTH_CATALOG_VALIDITY", () => {
    it("warns when tooth identifier is not recognized by isValidTooth predicate", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([
          { id: "m-unknown-tooth", tooth: "99", surfaces: ["O"], type: "caries" },
        ]),
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };

      const result = validateOdontogramState(state, {
        isValidTooth: (id) => id === "16" || id === "11",
      });

      const warning = result.warnings.find((w) => w.ruleId === RULE_TOOTH_CATALOG_VALIDITY);
      expect(warning).toBeDefined();
      expect(warning?.code).toBe(VALIDATION_CODES.WARN_UNRECOGNIZED_TOOTH);
      expect(warning?.message).toContain('Tooth identifier "99"');
    });
  });

  describe("RULE_MARK_COEXISTENCE & Incompatible Types", () => {
    it("detects configured incompatible mark types on the same tooth with typed warning code", () => {
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

      const warning = result.warnings.find((w) => w.ruleId === RULE_MARK_COEXISTENCE);
      expect(warning).toBeDefined();
      expect(warning?.code).toBe(VALIDATION_CODES.WARN_INCOMPATIBLE_MARKS);
      expect(warning?.message).toContain('Incompatible mark types "implant"');
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
            code: "ERR_CUSTOM_FORBIDDEN",
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
      expect(result.errors[0].code).toBe("ERR_CUSTOM_FORBIDDEN");
    });

    it("allows disabling specific rules by ID", () => {
      const marks = normalizeMarks([{ id: "m-1", tooth: "11", surfaces: ["O"], type: "caries" }]);
      const result = validateMarks(
        marks,
        {},
        {
          rules: {
            [RULE_SURFACE_APPLICABILITY]: false,
          },
        },
      );
      expect(result.valid).toBe(true);
    });

    it("createValidator creates reusable configured validator instance", () => {
      const validator = createValidator({
        allowMissingToothMarks: true,
      });

      const state: OdontogramState = {
        view: "permanent",
        marks: normalizeMarks([{ id: "m-1", tooth: "16", surfaces: ["O"], type: "caries" }]),
        selection: { teeth: [], surfaces: [] },
        teeth: { "16": { presence: "missing" } },
      };

      const result = validator(state);
      expect(result.valid).toBe(true);
    });
  });
});
