import {
  getMarksForTooth,
  getMarkTargetSurfaces,
  getMarkTargetTeeth,
  isMultiToothTarget,
  isSurfaceTarget,
  isWholeToothTarget,
  isComplexTarget,
} from "./marks.js";
import type {
  OdontogramState,
  OdontographicMark,
  SurfaceId,
  ToothId,
  ToothState,
  ValidationContext,
  ValidationIssue,
  ValidationResult,
  ValidationSeverity,
  ValidatorConfig,
} from "./types.js";

export const RULE_MARK_ID_UNIQUE = "mark-id-unique";
export const RULE_TARGET_INTEGRITY = "target-integrity";
export const RULE_SURFACE_APPLICABILITY = "surface-applicability";
export const RULE_TOOTH_PRESENCE_COEXISTENCE = "tooth-presence-coexistence";
export const RULE_MARK_COEXISTENCE = "mark-coexistence";
export const RULE_TOOTH_CATALOG_VALIDITY = "tooth-catalog-validity";

const VALID_SURFACES = new Set<SurfaceId>(["M", "O", "I", "D", "B", "L"]);

/** Default FDI anterior/posterior surface applicability checker */
function defaultIsSurfaceApplicable(tooth: ToothId, surface: SurfaceId): boolean {
  if (!VALID_SURFACES.has(surface)) return false;

  // If tooth is standard 2-digit FDI string
  if (tooth.length === 2) {
    const pos = parseInt(tooth.charAt(1), 10);
    if (!isNaN(pos)) {
      if (pos >= 1 && pos <= 3) {
        // Anterior: M, I, D, B, L (no O)
        return surface !== "O";
      }
      if (pos >= 4 && pos <= 8) {
        // Posterior: M, O, D, B, L (no I)
        return surface !== "I";
      }
    }
  }

  return true;
}

/** Check rule status in config */
function getRuleConfig(
  config: ValidatorConfig | undefined,
  ruleId: string,
  defaultSeverity: ValidationSeverity = "error",
): { enabled: boolean; severity: ValidationSeverity } {
  if (!config?.rules || !(ruleId in config.rules)) {
    return {
      enabled: true,
      severity: config?.strict ? "error" : defaultSeverity,
    };
  }

  const setting = config.rules[ruleId];
  if (typeof setting === "boolean") {
    return {
      enabled: setting,
      severity: config?.strict ? "error" : defaultSeverity,
    };
  }

  return {
    enabled: setting?.enabled ?? true,
    severity: config?.strict ? "error" : (setting?.severity ?? defaultSeverity),
  };
}

/**
 * Validates an OdontogramState against structural coexistence rules,
 * identity constraints, target integrity, and configurable rules.
 */
export function validateOdontogramState(
  state: OdontogramState,
  config: ValidatorConfig = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const teethOverlay = state.teeth || {};
  const marks = state.marks || [];

  // 1. Mark ID Uniqueness & Integrity
  const idRule = getRuleConfig(config, RULE_MARK_ID_UNIQUE, "error");
  if (idRule.enabled) {
    const seenIds = new Set<string>();
    for (const mark of marks) {
      if (!mark.id || typeof mark.id !== "string" || mark.id.trim() === "") {
        issues.push({
          ruleId: RULE_MARK_ID_UNIQUE,
          severity: idRule.severity,
          message: "Mark must have a non-empty string 'id'.",
          markId: mark.id,
        });
      } else if (seenIds.has(mark.id)) {
        issues.push({
          ruleId: RULE_MARK_ID_UNIQUE,
          severity: idRule.severity,
          message: `Duplicate mark id "${mark.id}". Mark identifiers must be unique across the odontogram.`,
          markId: mark.id,
        });
      } else {
        seenIds.add(mark.id);
      }
    }
  }

  // 2. Target Integrity & Surface Validity
  const targetRule = getRuleConfig(config, RULE_TARGET_INTEGRITY, "error");
  const isSurfaceApplicableFn = config.isSurfaceApplicable ?? defaultIsSurfaceApplicable;
  const surfaceApplicabilityRule = getRuleConfig(config, RULE_SURFACE_APPLICABILITY, "error");

  for (const mark of marks) {
    const { target } = mark;
    if (!target) {
      if (targetRule.enabled) {
        issues.push({
          ruleId: RULE_TARGET_INTEGRITY,
          severity: targetRule.severity,
          message: `Mark "${mark.id}" must define a valid target.`,
          markId: mark.id,
        });
      }
      continue;
    }

    if (isSurfaceTarget(target)) {
      if (!target.tooth || typeof target.tooth !== "string" || target.tooth.trim() === "") {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            severity: targetRule.severity,
            message: `Mark "${mark.id}" target has invalid or missing tooth identifier.`,
            markId: mark.id,
          });
        }
      }
      if (!Array.isArray(target.surfaces) || target.surfaces.length === 0) {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            severity: targetRule.severity,
            message: `Surface mark "${mark.id}" on tooth "${target.tooth}" must specify at least one surface.`,
            markId: mark.id,
            toothId: target.tooth,
          });
        }
      } else {
        // Check duplicate surfaces in target
        const seenSurfaces = new Set<SurfaceId>();
        for (const surf of target.surfaces) {
          if (!VALID_SURFACES.has(surf)) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                severity: targetRule.severity,
                message: `Invalid clinical surface code "${surf}" in mark "${mark.id}". Must be one of M, O, I, D, B, L.`,
                markId: mark.id,
                toothId: target.tooth,
                surface: surf,
              });
            }
          } else if (seenSurfaces.has(surf)) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                severity: targetRule.severity,
                message: `Duplicate surface "${surf}" in mark "${mark.id}" for tooth "${target.tooth}".`,
                markId: mark.id,
                toothId: target.tooth,
                surface: surf,
              });
            }
          } else {
            seenSurfaces.add(surf);
          }

          // Clinical surface applicability check
          if (
            surfaceApplicabilityRule.enabled &&
            target.tooth &&
            !isSurfaceApplicableFn(target.tooth, surf)
          ) {
            issues.push({
              ruleId: RULE_SURFACE_APPLICABILITY,
              severity: surfaceApplicabilityRule.severity,
              message: `Surface "${surf}" is clinically inapplicable for tooth "${target.tooth}".`,
              markId: mark.id,
              toothId: target.tooth,
              surface: surf,
            });
          }
        }
      }
    } else if (isWholeToothTarget(target)) {
      if (!target.tooth || typeof target.tooth !== "string" || target.tooth.trim() === "") {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            severity: targetRule.severity,
            message: `Whole-tooth mark "${mark.id}" must have a valid tooth identifier.`,
            markId: mark.id,
          });
        }
      }
    } else if (isMultiToothTarget(target)) {
      if (!Array.isArray(target.teeth) || target.teeth.length === 0) {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            severity: targetRule.severity,
            message: `Multi-tooth mark "${mark.id}" must specify at least one tooth in 'teeth' array.`,
            markId: mark.id,
          });
        }
      } else {
        const seenTeeth = new Set<ToothId>();
        for (const t of target.teeth) {
          if (!t || typeof t !== "string") {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                severity: targetRule.severity,
                message: `Invalid tooth ID in multi-tooth mark "${mark.id}".`,
                markId: mark.id,
              });
            }
          } else if (seenTeeth.has(t)) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                severity: targetRule.severity,
                message: `Duplicate tooth "${t}" in multi-tooth mark "${mark.id}".`,
                markId: mark.id,
                toothId: t,
              });
            }
          } else {
            seenTeeth.add(t);
          }
        }
      }
    } else if (isComplexTarget(target)) {
      if (!Array.isArray(target.elements) || target.elements.length === 0) {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            severity: targetRule.severity,
            message: `Complex mark "${mark.id}" must specify at least one element.`,
            markId: mark.id,
          });
        }
      }
    }
  }

  // 3. Tooth Presence Coexistence
  const presenceRule = getRuleConfig(config, RULE_TOOTH_PRESENCE_COEXISTENCE, "error");
  if (presenceRule.enabled) {
    for (const [toothId, toothState] of Object.entries(teethOverlay)) {
      if (toothState.presence === "missing" && !config.allowMissingToothMarks) {
        const toothMarks = getMarksForTooth(marks, toothId);
        for (const mark of toothMarks) {
          const surfaces = getMarkTargetSurfaces(mark, toothId);
          // If the mark has specific surface findings on a missing tooth, it is incompatible
          if (surfaces.length > 0) {
            issues.push({
              ruleId: RULE_TOOTH_PRESENCE_COEXISTENCE,
              severity: presenceRule.severity,
              message: `Tooth "${toothId}" is marked as missing; recording surface mark "${mark.id}" (${mark.type}) on surfaces [${surfaces.join(", ")}] is structurally incompatible.`,
              markId: mark.id,
              toothId,
            });
          }
        }
      } else if (toothState.presence === "unerupted" && !config.allowUneruptedToothMarks) {
        const toothMarks = getMarksForTooth(marks, toothId);
        for (const mark of toothMarks) {
          const surfaces = getMarkTargetSurfaces(mark, toothId);
          if (surfaces.length > 0 && (mark.type === "caries" || mark.type === "restoration")) {
            issues.push({
              ruleId: RULE_TOOTH_PRESENCE_COEXISTENCE,
              severity: presenceRule.severity,
              message: `Tooth "${toothId}" is marked as unerupted; recording surface ${mark.type} mark "${mark.id}" is structurally incompatible.`,
              markId: mark.id,
              toothId,
            });
          }
        }
      }
    }
  }

  // 4. Mark Coexistence & Incompatible Types
  const coexistenceRule = getRuleConfig(config, RULE_MARK_COEXISTENCE, "warning");
  if (coexistenceRule.enabled && config.incompatibleTypes) {
    for (const [typeA, typeB] of config.incompatibleTypes) {
      // Find teeth containing both typeA and typeB
      const teethWithMarks = new Set<ToothId>();
      for (const m of marks) {
        for (const t of getMarkTargetTeeth(m)) {
          teethWithMarks.add(t);
        }
      }

      for (const toothId of teethWithMarks) {
        const toothMarks = getMarksForTooth(marks, toothId);
        const marksA = toothMarks.filter((m) => m.type === typeA);
        const marksB = toothMarks.filter((m) => m.type === typeB);

        if (marksA.length > 0 && marksB.length > 0) {
          for (const a of marksA) {
            for (const b of marksB) {
              issues.push({
                ruleId: RULE_MARK_COEXISTENCE,
                severity: coexistenceRule.severity,
                message: `Incompatible mark types "${typeA}" (mark ${a.id}) and "${typeB}" (mark ${b.id}) coexist on tooth "${toothId}".`,
                markId: a.id,
                toothId,
                details: { conflictingMarkId: b.id },
              });
            }
          }
        }
      }
    }
  }

  // 5. Tooth Catalog Validity (if custom isValidTooth provided)
  const catalogRule = getRuleConfig(config, RULE_TOOTH_CATALOG_VALIDITY, "warning");
  if (catalogRule.enabled && config.isValidTooth) {
    for (const mark of marks) {
      for (const toothId of getMarkTargetTeeth(mark)) {
        if (!config.isValidTooth(toothId)) {
          issues.push({
            ruleId: RULE_TOOTH_CATALOG_VALIDITY,
            severity: catalogRule.severity,
            message: `Tooth identifier "${toothId}" in mark "${mark.id}" is not recognized in the active catalog.`,
            markId: mark.id,
            toothId,
          });
        }
      }
    }
  }

  // 6. Custom Validation Rules
  if (config.customRules && config.customRules.length > 0) {
    const context: ValidationContext = {
      state,
      teeth: teethOverlay,
      marks,
    };
    for (const customRule of config.customRules) {
      try {
        const result = customRule(state, context);
        if (result) {
          if (Array.isArray(result)) {
            issues.push(...result);
          } else {
            issues.push(result);
          }
        }
      } catch (err) {
        issues.push({
          ruleId: "custom-rule-error",
          severity: "error",
          message: `Custom validation rule failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

/** Validates an array of marks against structural rules. */
export function validateMarks(
  marks: OdontographicMark[],
  teethOverlay: Record<ToothId, ToothState> = {},
  config: ValidatorConfig = {},
): ValidationResult {
  const dummyState: OdontogramState = {
    view: "permanent",
    marks,
    selection: { teeth: [], surfaces: [] },
    teeth: teethOverlay,
  };
  return validateOdontogramState(dummyState, config);
}

/** Validates a single mark against structural rules. */
export function validateMark(
  mark: OdontographicMark,
  context: Partial<ValidationContext> = {},
  config: ValidatorConfig = {},
): ValidationResult {
  const marks = context.marks ? [...context.marks, mark] : [mark];
  const teeth = context.teeth || {};
  return validateMarks(marks, teeth, config);
}

/** Creates a reusable validation function configured with specific options. */
export function createValidator(
  config: ValidatorConfig = {},
): (state: OdontogramState) => ValidationResult {
  return (state: OdontogramState) => validateOdontogramState(state, config);
}
