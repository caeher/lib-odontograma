import { VALIDATION_CODES } from "./errors.js";
import {
  getMarksForTooth,
  getMarkTargetSurfaces,
  getMarkTargetTeeth,
  isComplexTarget,
  isMultiToothTarget,
  isSurfaceTarget,
  isWholeToothTarget,
} from "./marks.js";
import type {
  OdontogramOptions,
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
export const RULE_UNKNOWN_MARK_TYPE = "unknown-mark-type";
export const RULE_SELECTION_INTEGRITY = "selection-integrity";
export const RULE_TEETH_OVERLAY_INTEGRITY = "teeth-overlay-integrity";
export const RULE_OPTIONS_VALIDITY = "options-validity";

const VALID_SURFACES = new Set<SurfaceId>(["M", "O", "I", "D", "B", "L"]);
const VALID_PRESENCE_VALUES = new Set(["present", "missing", "unerupted"]);
const VALID_NOTATIONS = new Set(["fdi", "universal", "palmer"]);
const VALID_MODES = new Set(["internal", "controlled"]);

const KNOWN_OPTION_KEYS = new Set<keyof OdontogramOptions>([
  "plugins",
  "mode",
  "historyLimit",
  "initialView",
  "locale",
  "localeText",
  "notation",
  "width",
  "height",
  "fitToContainer",
  "minZoom",
  "maxZoom",
  "selectable",
  "disabled",
  "readOnly",
  "toolbar",
  "legend",
  "markCatalog",
  "lockedTeeth",
  "lockedSurfaces",
  "isToothSelectable",
  "isSurfaceSelectable",
  "toothColor",
  "surfaceColor",
  "selectionColor",
  "markColors",
  "statusColors",
  "instanceId",
  "viewOptions",
  "showOrientationLabels",
  "showMidline",
  "visibleTeeth",
  "toothResources",
  "toothResourceFallback",
  "validator",
  "toothClick",
  "surfaceClick",
  "selectionDidChange",
  "marksSet",
  "validationDidChange",
  "stateDidChange",
  "historyDidChange",
  "detailDidChange",
  "beforeMarkCommand",
  "toothStateDidChange",
  "toothClassNames",
  "toothLabelClassNames",
  "toothLabelContent",
  "surfaceClassNames",
  "markClassNames",
  "annotationClassNames",
  "toothContent",
  "surfaceContent",
  "annotationContent",
  "toothDidMount",
  "toothWillUnmount",
  "surfaceDidMount",
  "surfaceWillUnmount",
  "annotationDidMount",
  "annotationWillUnmount",
  "markDidMount",
  "markWillUnmount",
  "viewDidMount",
  "viewWillUnmount",
  "beforeMount",
  "mountDidMount",
  "beforeViewChange",
  "viewDidChange",
  "beforeSelectionChange",
  "beforeDataChange",
  "editDidChange",
  "errorDidOccur",
  "pluginDidError",
]);

/** Deeply clones any serializable object to prevent consumer mutation leakage. */
export function deepClone<T>(val: T): T {
  if (val === null || typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepClone(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(val as Record<string, unknown>)) {
    copy[key] = deepClone((val as Record<string, unknown>)[key]);
  }
  return copy as T;
}

/** Deep equality check for state snapshots and objects. */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || typeof a !== "object" || b === null || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

/** Default FDI anterior/posterior surface applicability checker */
function defaultIsSurfaceApplicable(tooth: ToothId, surface: SurfaceId): boolean {
  if (!VALID_SURFACES.has(surface)) return false;

  // Standard 2-digit FDI string: Quadrant 1-8, Position 1-8
  if (tooth.length === 2) {
    const pos = parseInt(tooth.charAt(1), 10);
    if (!isNaN(pos)) {
      if (pos >= 1 && pos <= 3) {
        // Anterior (Central, Lateral, Canine): M, I, D, B, L (no O)
        return surface !== "O";
      }
      if (pos >= 4 && pos <= 8) {
        // Posterior (Premolars, Molars): M, O, D, B, L (no I)
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
 * Validates an OdontogramOptions object for correct types and unknown properties.
 */
export function validateOptions(options: OdontogramOptions): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!options || typeof options !== "object") {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: "Options must be an object.",
      path: "options",
    });
    return {
      valid: false,
      issues,
      errors: issues,
      warnings: [],
    };
  }

  // Check for unknown options
  for (const key of Object.keys(options)) {
    if (!KNOWN_OPTION_KEYS.has(key as keyof OdontogramOptions)) {
      issues.push({
        ruleId: RULE_OPTIONS_VALIDITY,
        code: VALIDATION_CODES.WARN_UNKNOWN_OPTION,
        severity: "warning",
        message: `Unknown configuration option "${key}". Verify option spelling against OdontogramOptions.`,
        path: `options.${key}`,
      });
    }
  }

  // Validate specific option types
  if (options.mode !== undefined && !VALID_MODES.has(options.mode)) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Invalid mode "${options.mode}". Must be "internal" or "controlled".`,
      path: "options.mode",
    });
  }

  if (
    options.historyLimit !== undefined &&
    (!Number.isInteger(options.historyLimit) || options.historyLimit < 0)
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: 'Option "historyLimit" must be a non-negative integer.',
      path: "options.historyLimit",
    });
  }

  if (options.notation !== undefined && !VALID_NOTATIONS.has(options.notation)) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Invalid notation "${options.notation}". Must be "fdi", "universal", or "palmer".`,
      path: "options.notation",
    });
  }

  for (const dimension of ["width", "height"] as const) {
    const value = options[dimension];
    if (value !== undefined) {
      if (typeof value === "number") {
        if (value <= 0 || isNaN(value)) {
          issues.push({
            ruleId: RULE_OPTIONS_VALIDITY,
            code: VALIDATION_CODES.ERR_INVALID_OPTION,
            severity: "error",
            message: `Option "${dimension}" must be a positive number or valid CSS string.`,
            path: `options.${dimension}`,
          });
        }
      } else if (typeof value !== "string" || value.trim() === "") {
        issues.push({
          ruleId: RULE_OPTIONS_VALIDITY,
          code: VALIDATION_CODES.ERR_INVALID_OPTION,
          severity: "error",
          message: `Option "${dimension}" must be a non-empty string or positive number.`,
          path: `options.${dimension}`,
        });
      }
    }
  }

  if (options.fitToContainer !== undefined && typeof options.fitToContainer !== "boolean") {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: 'Option "fitToContainer" must be a boolean.',
      path: "options.fitToContainer",
    });
  }
  for (const bound of ["minZoom", "maxZoom"] as const) {
    const value = options[bound];
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    ) {
      issues.push({
        ruleId: RULE_OPTIONS_VALIDITY,
        code: VALIDATION_CODES.ERR_INVALID_OPTION,
        severity: "error",
        message: `Option "${bound}" must be a positive finite number.`,
        path: `options.${bound}`,
      });
    }
  }
  if (
    (options.minZoom ?? 1) > 1 ||
    (options.maxZoom ?? 4) < 1 ||
    (options.minZoom ?? 1) > (options.maxZoom ?? 4)
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: "Zoom bounds must contain the fitted scale of 1 and minZoom cannot exceed maxZoom.",
      path: "options.minZoom",
    });
  }

  if (options.selectable !== undefined && typeof options.selectable !== "boolean") {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "selectable" must be a boolean.`,
      path: "options.selectable",
    });
  }

  if (options.disabled !== undefined && typeof options.disabled !== "boolean") {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "disabled" must be a boolean.`,
      path: "options.disabled",
    });
  }

  if (
    options.toolbar !== undefined &&
    options.toolbar !== false &&
    typeof options.toolbar !== "object"
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "toolbar" must be false or a toolbar configuration object.`,
      path: "options.toolbar",
    });
  }

  if (
    options.legend !== undefined &&
    options.legend !== false &&
    typeof options.legend !== "object"
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "legend" must be false or a legend configuration object.`,
      path: "options.legend",
    });
  }

  if (
    options.markCatalog !== undefined &&
    (!Array.isArray(options.markCatalog) ||
      options.markCatalog.some(
        (entry) => !entry || typeof entry.type !== "string" || entry.type.trim() === "",
      ))
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "markCatalog" must contain entries with non-empty mark types.`,
      path: "options.markCatalog",
    });
  }

  if (options.readOnly !== undefined && typeof options.readOnly !== "boolean") {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "readOnly" must be a boolean.`,
      path: "options.readOnly",
    });
  }

  if (
    options.locale !== undefined &&
    (typeof options.locale !== "string" || options.locale.trim() === "")
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: 'Option "locale" must be a non-empty language tag.',
      path: "options.locale",
    });
  }

  if (
    options.localeText !== undefined &&
    (!options.localeText ||
      typeof options.localeText !== "object" ||
      Array.isArray(options.localeText) ||
      Object.values(options.localeText).some((message) => typeof message !== "string"))
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: 'Option "localeText" must be an object containing string messages.',
      path: "options.localeText",
    });
  }

  if (options.plugins !== undefined && !Array.isArray(options.plugins)) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "plugins" must be an array of OdontogramPlugin instances.`,
      path: "options.plugins",
    });
  }

  if (
    options.instanceId !== undefined &&
    (typeof options.instanceId !== "string" || options.instanceId.trim() === "")
  ) {
    issues.push({
      ruleId: RULE_OPTIONS_VALIDITY,
      code: VALIDATION_CODES.ERR_INVALID_OPTION,
      severity: "error",
      message: `Option "instanceId" must be a non-empty string.`,
      path: "options.instanceId",
    });
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

/**
 * Validates an OdontogramState against structural coexistence rules,
 * identity constraints, target integrity, and configurable rules.
 */
export function validateOdontogramState(
  state: OdontogramState,
  config: ValidatorConfig = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!state || typeof state !== "object") {
    issues.push({
      ruleId: "state-structure",
      code: VALIDATION_CODES.ERR_INVALID_STATE,
      severity: "error",
      message: "Odontogram state must be an object.",
      path: "state",
    });
    return {
      valid: false,
      issues,
      errors: issues,
      warnings: [],
    };
  }

  const teethOverlay = state.teeth || {};
  const marks = state.marks || [];
  const selection = state.selection || { teeth: [], surfaces: [] };

  // 1. Mark ID Uniqueness & Integrity
  const idRule = getRuleConfig(config, RULE_MARK_ID_UNIQUE, "error");
  if (idRule.enabled) {
    const seenIds = new Set<string>();
    marks.forEach((mark, i) => {
      const markPath = `marks[${i}].id`;
      if (!mark || typeof mark !== "object") {
        issues.push({
          ruleId: RULE_MARK_ID_UNIQUE,
          code: VALIDATION_CODES.ERR_INVALID_MARK_ID,
          severity: idRule.severity,
          message: `Mark at index ${i} must be an object.`,
          path: `marks[${i}]`,
        });
        return;
      }
      if (!mark.id || typeof mark.id !== "string" || mark.id.trim() === "") {
        issues.push({
          ruleId: RULE_MARK_ID_UNIQUE,
          code: VALIDATION_CODES.ERR_INVALID_MARK_ID,
          severity: idRule.severity,
          message: "Mark must have a non-empty string 'id'.",
          path: markPath,
          markId: mark.id,
        });
      } else if (seenIds.has(mark.id)) {
        issues.push({
          ruleId: RULE_MARK_ID_UNIQUE,
          code: VALIDATION_CODES.ERR_DUPLICATE_MARK_ID,
          severity: idRule.severity,
          message: `Duplicate mark id "${mark.id}". Mark identifiers must be unique across the odontogram.`,
          path: markPath,
          markId: mark.id,
        });
      } else {
        seenIds.add(mark.id);
      }
    });
  }

  // 2. Target Integrity & Surface Validity
  const targetRule = getRuleConfig(config, RULE_TARGET_INTEGRITY, "error");
  const isSurfaceApplicableFn = config.isSurfaceApplicable ?? defaultIsSurfaceApplicable;
  const surfaceApplicabilityRule = getRuleConfig(config, RULE_SURFACE_APPLICABILITY, "error");

  marks.forEach((mark, i) => {
    if (!mark || typeof mark !== "object") return;
    const markBasePath = `marks[${i}]`;

    // Type validation
    if (!mark.type || typeof mark.type !== "string" || mark.type.trim() === "") {
      if (targetRule.enabled) {
        issues.push({
          ruleId: RULE_TARGET_INTEGRITY,
          code: VALIDATION_CODES.ERR_INVALID_STATE,
          severity: targetRule.severity,
          message: `Mark "${mark.id || i}" must have a non-empty string 'type'.`,
          path: `${markBasePath}.type`,
          markId: mark.id,
        });
      }
    }

    const { target } = mark;
    if (!target || typeof target !== "object") {
      if (targetRule.enabled) {
        issues.push({
          ruleId: RULE_TARGET_INTEGRITY,
          code: VALIDATION_CODES.ERR_MISSING_TARGET,
          severity: targetRule.severity,
          message: `Mark "${mark.id}" must define a valid target.`,
          path: `${markBasePath}.target`,
          markId: mark.id,
        });
      }
      return;
    }

    if (isSurfaceTarget(target)) {
      if (!target.tooth || typeof target.tooth !== "string" || target.tooth.trim() === "") {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            code: VALIDATION_CODES.ERR_INVALID_TOOTH_ID,
            severity: targetRule.severity,
            message: `Mark "${mark.id}" target has invalid or missing tooth identifier.`,
            path: `${markBasePath}.target.tooth`,
            markId: mark.id,
          });
        }
      }
      if (!Array.isArray(target.surfaces) || target.surfaces.length === 0) {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            code: VALIDATION_CODES.ERR_EMPTY_SURFACES,
            severity: targetRule.severity,
            message: `Surface mark "${mark.id}" on tooth "${target.tooth}" must specify at least one surface.`,
            path: `${markBasePath}.target.surfaces`,
            markId: mark.id,
            toothId: target.tooth,
          });
        }
      } else {
        const seenSurfaces = new Set<SurfaceId>();
        target.surfaces.forEach((surf, surfIdx) => {
          const surfPath = `${markBasePath}.target.surfaces[${surfIdx}]`;
          if (!VALID_SURFACES.has(surf)) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                code: VALIDATION_CODES.ERR_INVALID_SURFACE,
                severity: targetRule.severity,
                message: `Invalid clinical surface code "${surf}" in mark "${mark.id}". Must be one of M, O, I, D, B, L.`,
                path: surfPath,
                markId: mark.id,
                toothId: target.tooth,
                surface: surf,
              });
            }
          } else if (seenSurfaces.has(surf)) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                code: VALIDATION_CODES.ERR_DUPLICATE_SURFACE,
                severity: targetRule.severity,
                message: `Duplicate surface "${surf}" in mark "${mark.id}" for tooth "${target.tooth}".`,
                path: surfPath,
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
              code: VALIDATION_CODES.ERR_INAPPLICABLE_SURFACE,
              severity: surfaceApplicabilityRule.severity,
              message: `Surface "${surf}" is clinically inapplicable for tooth "${target.tooth}".`,
              path: surfPath,
              markId: mark.id,
              toothId: target.tooth,
              surface: surf,
            });
          }
        });
      }
    } else if (isWholeToothTarget(target)) {
      if (!target.tooth || typeof target.tooth !== "string" || target.tooth.trim() === "") {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            code: VALIDATION_CODES.ERR_INVALID_TOOTH_ID,
            severity: targetRule.severity,
            message: `Whole-tooth mark "${mark.id}" must have a valid tooth identifier.`,
            path: `${markBasePath}.target.tooth`,
            markId: mark.id,
          });
        }
      }
    } else if (isMultiToothTarget(target)) {
      if (!Array.isArray(target.teeth) || target.teeth.length === 0) {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            code: VALIDATION_CODES.ERR_EMPTY_TEETH,
            severity: targetRule.severity,
            message: `Multi-tooth mark "${mark.id}" must specify at least one tooth in 'teeth' array.`,
            path: `${markBasePath}.target.teeth`,
            markId: mark.id,
          });
        }
      } else {
        const seenTeeth = new Set<ToothId>();
        target.teeth.forEach((t, tIdx) => {
          const toothPath = `${markBasePath}.target.teeth[${tIdx}]`;
          if (!t || typeof t !== "string" || t.trim() === "") {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                code: VALIDATION_CODES.ERR_INVALID_TOOTH_ID,
                severity: targetRule.severity,
                message: `Invalid tooth ID in multi-tooth mark "${mark.id}".`,
                path: toothPath,
                markId: mark.id,
              });
            }
          } else if (seenTeeth.has(t)) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                code: VALIDATION_CODES.ERR_DUPLICATE_TOOTH,
                severity: targetRule.severity,
                message: `Duplicate tooth "${t}" in multi-tooth mark "${mark.id}".`,
                path: toothPath,
                markId: mark.id,
                toothId: t,
              });
            }
          } else {
            seenTeeth.add(t);
          }
        });
        if (target.targets !== undefined) {
          const entries = target.targets;
          if (
            !Array.isArray(entries) ||
            entries.length !== target.teeth.length ||
            entries.some((entry, idx) => entry?.tooth !== target.teeth[idx])
          ) {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                code: VALIDATION_CODES.ERR_INVALID_TARGET,
                severity: targetRule.severity,
                message: `Ordered targets for multi-tooth mark "${mark.id}" must match target.teeth exactly.`,
                path: `${markBasePath}.target.targets`,
                markId: mark.id,
              });
            }
          }
          (Array.isArray(entries) ? entries : []).forEach((entry, idx) => {
            if (entry?.role !== undefined && typeof entry.role !== "string") {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                severity: targetRule.severity,
                message: `Target role at index ${idx} must be a string.`,
                path: `${markBasePath}.target.targets[${idx}].role`,
                markId: mark.id,
              });
            }
          });
        }
      }
    } else if (isComplexTarget(target)) {
      if (!Array.isArray(target.elements) || target.elements.length === 0) {
        if (targetRule.enabled) {
          issues.push({
            ruleId: RULE_TARGET_INTEGRITY,
            code: VALIDATION_CODES.ERR_EMPTY_ELEMENTS,
            severity: targetRule.severity,
            message: `Complex mark "${mark.id}" must specify at least one element.`,
            path: `${markBasePath}.target.elements`,
            markId: mark.id,
          });
        }
      } else {
        target.elements.forEach((el, elIdx) => {
          const elPath = `${markBasePath}.target.elements[${elIdx}]`;
          if (!el.tooth || typeof el.tooth !== "string" || el.tooth.trim() === "") {
            if (targetRule.enabled) {
              issues.push({
                ruleId: RULE_TARGET_INTEGRITY,
                code: VALIDATION_CODES.ERR_INVALID_TOOTH_ID,
                severity: targetRule.severity,
                message: `Element at index ${elIdx} in complex mark "${mark.id}" must have a valid tooth ID.`,
                path: `${elPath}.tooth`,
                markId: mark.id,
              });
            }
          }
          if (el.surfaces) {
            el.surfaces.forEach((surf, sIdx) => {
              const surfPath = `${elPath}.surfaces[${sIdx}]`;
              if (!VALID_SURFACES.has(surf)) {
                if (targetRule.enabled) {
                  issues.push({
                    ruleId: RULE_TARGET_INTEGRITY,
                    code: VALIDATION_CODES.ERR_INVALID_SURFACE,
                    severity: targetRule.severity,
                    message: `Invalid surface "${surf}" in complex mark "${mark.id}".`,
                    path: surfPath,
                    markId: mark.id,
                    toothId: el.tooth,
                    surface: surf,
                  });
                }
              }
            });
          }
        });
      }
    }
  });

  // 3. Tooth Presence Coexistence & Teeth Overlay Integrity
  const presenceRule = getRuleConfig(config, RULE_TOOTH_PRESENCE_COEXISTENCE, "error");
  const overlayRule = getRuleConfig(config, RULE_TEETH_OVERLAY_INTEGRITY, "error");

  for (const [toothId, toothState] of Object.entries(teethOverlay)) {
    const presencePath = `teeth.${toothId}.presence`;
    if (
      !toothState ||
      typeof toothState !== "object" ||
      !VALID_PRESENCE_VALUES.has(toothState.presence)
    ) {
      if (overlayRule.enabled) {
        issues.push({
          ruleId: RULE_TEETH_OVERLAY_INTEGRITY,
          code: VALIDATION_CODES.ERR_INVALID_PRESENCE,
          severity: overlayRule.severity,
          message: `Invalid presence value "${toothState?.presence}" for tooth "${toothId}". Must be "present", "missing", or "unerupted".`,
          path: presencePath,
          toothId,
        });
      }
      continue;
    }

    if (presenceRule.enabled) {
      if (toothState.presence === "missing" && !config.allowMissingToothMarks) {
        const toothMarks = getMarksForTooth(marks, toothId);
        for (const mark of toothMarks) {
          const surfaces = getMarkTargetSurfaces(mark, toothId);
          if (surfaces.length > 0) {
            issues.push({
              ruleId: RULE_TOOTH_PRESENCE_COEXISTENCE,
              code: VALIDATION_CODES.ERR_PRESENCE_CONFLICT,
              severity: presenceRule.severity,
              message: `Tooth "${toothId}" is marked as missing; recording surface mark "${mark.id}" (${mark.type}) on surfaces [${surfaces.join(", ")}] is structurally incompatible.`,
              path: presencePath,
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
              code: VALIDATION_CODES.ERR_PRESENCE_CONFLICT,
              severity: presenceRule.severity,
              message: `Tooth "${toothId}" is marked as unerupted; recording surface ${mark.type} mark "${mark.id}" is structurally incompatible.`,
              path: presencePath,
              markId: mark.id,
              toothId,
            });
          }
        }
      }
    }
  }

  // 4. Selection State Integrity
  const selectionRule = getRuleConfig(config, RULE_SELECTION_INTEGRITY, "error");
  if (selectionRule.enabled) {
    if (selection.teeth && Array.isArray(selection.teeth)) {
      const seenTeeth = new Set<ToothId>();
      selection.teeth.forEach((t, idx) => {
        const selToothPath = `selection.teeth[${idx}]`;
        if (!t || typeof t !== "string" || t.trim() === "") {
          issues.push({
            ruleId: RULE_SELECTION_INTEGRITY,
            code: VALIDATION_CODES.ERR_INVALID_SELECTION,
            severity: selectionRule.severity,
            message: `Invalid tooth ID in selection.`,
            path: selToothPath,
          });
        } else if (seenTeeth.has(t)) {
          issues.push({
            ruleId: RULE_SELECTION_INTEGRITY,
            code: VALIDATION_CODES.ERR_INVALID_SELECTION,
            severity: selectionRule.severity,
            message: `Duplicate tooth "${t}" in selection.`,
            path: selToothPath,
            toothId: t,
          });
        } else {
          seenTeeth.add(t);
        }
      });
    }

    if (selection.surfaces && Array.isArray(selection.surfaces)) {
      const seenSurfs = new Set<string>();
      selection.surfaces.forEach((s, idx) => {
        const selSurfPath = `selection.surfaces[${idx}]`;
        if (
          !s ||
          typeof s !== "object" ||
          !s.tooth ||
          !s.surface ||
          !VALID_SURFACES.has(s.surface)
        ) {
          issues.push({
            ruleId: RULE_SELECTION_INTEGRITY,
            code: VALIDATION_CODES.ERR_INVALID_SELECTION,
            severity: selectionRule.severity,
            message: `Invalid surface entry in selection.`,
            path: selSurfPath,
          });
        } else {
          const key = `${s.tooth}:${s.surface}`;
          if (seenSurfs.has(key)) {
            issues.push({
              ruleId: RULE_SELECTION_INTEGRITY,
              code: VALIDATION_CODES.ERR_INVALID_SELECTION,
              severity: selectionRule.severity,
              message: `Duplicate surface selection "${key}".`,
              path: selSurfPath,
              toothId: s.tooth,
              surface: s.surface,
            });
          } else {
            seenSurfs.add(key);
          }
        }
      });
    }
  }

  // 5. Mark Coexistence & Incompatible Types
  const coexistenceRule = getRuleConfig(config, RULE_MARK_COEXISTENCE, "warning");
  if (coexistenceRule.enabled && config.incompatibleTypes) {
    for (const [typeA, typeB] of config.incompatibleTypes) {
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
                code: VALIDATION_CODES.WARN_INCOMPATIBLE_MARKS,
                severity: coexistenceRule.severity,
                message: `Incompatible mark types "${typeA}" (mark ${a.id}) and "${typeB}" (mark ${b.id}) coexist on tooth "${toothId}".`,
                path: `marks`,
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

  // 6. Tooth Catalog Validity (if custom isValidTooth provided)
  const catalogRule = getRuleConfig(config, RULE_TOOTH_CATALOG_VALIDITY, "warning");
  if (catalogRule.enabled && config.isValidTooth) {
    marks.forEach((mark, mIdx) => {
      getMarkTargetTeeth(mark).forEach((toothId) => {
        if (!config.isValidTooth!(toothId)) {
          issues.push({
            ruleId: RULE_TOOTH_CATALOG_VALIDITY,
            code: VALIDATION_CODES.WARN_UNRECOGNIZED_TOOTH,
            severity: catalogRule.severity,
            message: `Tooth identifier "${toothId}" in mark "${mark.id}" is not recognized in the active catalog.`,
            path: `marks[${mIdx}]`,
            markId: mark.id,
            toothId,
          });
        }
      });
    });
  }

  // 7. Custom Validation Rules
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
          code: VALIDATION_CODES.ERR_INVALID_STATE,
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
