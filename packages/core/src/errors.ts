import type { ValidationIssue } from "./types.js";

/** Error and warning diagnostic codes. */
export const VALIDATION_CODES = {
  // Mark identification and target errors
  ERR_DUPLICATE_MARK_ID: "ERR_DUPLICATE_MARK_ID",
  ERR_INVALID_MARK_ID: "ERR_INVALID_MARK_ID",
  ERR_MISSING_TARGET: "ERR_MISSING_TARGET",
  ERR_INVALID_TARGET: "ERR_INVALID_TARGET",
  ERR_INVALID_TOOTH_ID: "ERR_INVALID_TOOTH_ID",
  ERR_MISSING_TOOTH_ID: "ERR_MISSING_TOOTH_ID",
  ERR_INVALID_SURFACE: "ERR_INVALID_SURFACE",
  ERR_DUPLICATE_SURFACE: "ERR_DUPLICATE_SURFACE",
  ERR_INAPPLICABLE_SURFACE: "ERR_INAPPLICABLE_SURFACE",
  ERR_EMPTY_SURFACES: "ERR_EMPTY_SURFACES",
  ERR_EMPTY_TEETH: "ERR_EMPTY_TEETH",
  ERR_DUPLICATE_TOOTH: "ERR_DUPLICATE_TOOTH",
  ERR_EMPTY_ELEMENTS: "ERR_EMPTY_ELEMENTS",

  // Teeth presence overlay errors
  ERR_INVALID_PRESENCE: "ERR_INVALID_PRESENCE",
  ERR_PRESENCE_CONFLICT: "ERR_PRESENCE_CONFLICT",

  // Selection errors
  ERR_INVALID_SELECTION: "ERR_INVALID_SELECTION",

  // Option errors
  ERR_INVALID_OPTION: "ERR_INVALID_OPTION",
  ERR_IMMUTABLE_OPTION: "ERR_IMMUTABLE_OPTION",
  ERR_INVALID_CONTAINER: "ERR_INVALID_CONTAINER",

  // General state & atomic update errors
  ERR_INVALID_STATE: "ERR_INVALID_STATE",
  ERR_ATOMIC_UPDATE_FAILED: "ERR_ATOMIC_UPDATE_FAILED",
  ERR_MARK_NOT_FOUND: "ERR_MARK_NOT_FOUND",
  ERR_TRANSACTION_FAILED: "ERR_TRANSACTION_FAILED",
  ERR_NO_CONTAINER: "ERR_NO_CONTAINER",
  ERR_CONTROLLED_MUTATION: "ERR_CONTROLLED_MUTATION",
  ERR_REVISION_REGRESSION: "ERR_REVISION_REGRESSION",

  // Warnings
  WARN_UNKNOWN_OPTION: "WARN_UNKNOWN_OPTION",
  WARN_UNKNOWN_MARK_TYPE: "WARN_UNKNOWN_MARK_TYPE",
  WARN_INCOMPATIBLE_MARKS: "WARN_INCOMPATIBLE_MARKS",
  WARN_UNRECOGNIZED_TOOTH: "WARN_UNRECOGNIZED_TOOTH",
} as const;

export type ValidationCode =
  (typeof VALIDATION_CODES)[keyof typeof VALIDATION_CODES] | (string & {});

/** Base error class for all Odontogram library errors. */
export class OdontogramError extends Error {
  readonly code: string;

  constructor(message: string, code: string = "ERR_ODONTOGRAM") {
    super(message);
    this.name = "OdontogramError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when an odontogram operation (such as setState or constructor initialization)
 * fails validation and is rejected atomically.
 */
export class OdontogramValidationError extends OdontogramError {
  readonly issues: ValidationIssue[];
  readonly errors: ValidationIssue[];
  readonly warnings: ValidationIssue[];

  constructor(
    message: string,
    issues: ValidationIssue[] = [],
    code: string = VALIDATION_CODES.ERR_INVALID_STATE,
  ) {
    super(message, code);
    this.name = "OdontogramValidationError";
    this.issues = issues;
    this.errors = issues.filter((i) => i.severity === "error");
    this.warnings = issues.filter((i) => i.severity === "warning");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
