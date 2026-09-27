import { OdontogramValidationError, VALIDATION_CODES } from "./errors.js";
import { deepClone, validateOdontogramState } from "./validation.js";
import { normalizeMarks } from "./marks.js";
import type {
  DocumentMigration,
  ExportDocumentOptions,
  ImportDocumentOptions,
  OdontogramDocument,
  OdontogramImportResult,
  OdontogramOptions,
  OdontogramState,
  OdontogramVisualSettings,
  SelectionState,
  ToothId,
  ToothState,
  ValidationIssue,
  ValidationResult,
  ValidatorConfig,
} from "./types.js";

/** Current canonical schema version for Odontogram interoperability documents. */
export const CURRENT_SCHEMA_VERSION = "1.0.0";

/** Default public JSON schema URI for document validation. */
export const DEFAULT_DOCUMENT_SCHEMA_URI =
  "https://lib-odontograma.dev/schemas/odontogram-document.schema.json";

const KNOWN_DOCUMENT_ROOT_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "view",
  "dentition",
  "viewOptions",
  "teeth",
  "marks",
  "visualSettings",
  "selection",
  "metadata",
]);

const SERIALIZABLE_OPTION_KEYS: Array<keyof OdontogramVisualSettings> = [
  "notation",
  "locale",
  "showOrientationLabels",
  "showMidline",
  "toothColor",
  "surfaceColor",
  "selectionColor",
  "markColors",
  "statusColors",
  "fitToContainer",
  "minZoom",
  "maxZoom",
];

/**
 * Compare two semantic version strings (e.g. "1.0.0", "1.2.0").
 * Returns:
 *  - 1 if v1 > v2
 *  - -1 if v1 < v2
 *  - 0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const cleanV1 = v1.trim().replace(/^v/, "");
  const cleanV2 = v2.trim().replace(/^v/, "");

  const base1 = cleanV1.split("-")[0] ?? "";
  const base2 = cleanV2.split("-")[0] ?? "";

  const parts1 = base1.split(".").map(Number);
  const parts2 = base2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (isNaN(num1) || isNaN(num2)) return 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/** Check whether a version string matches basic semver pattern. */
export function isSemver(version: string): boolean {
  if (typeof version !== "string") return false;
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version.trim().replace(/^v/, ""));
}

/** Global migration registry */
const globalMigrations: DocumentMigration[] = [];

/** Register a custom document migration in the global registry. */
export function registerDocumentMigration(migration: DocumentMigration): void {
  if (!migration || typeof migration.migrate !== "function") {
    throw new Error("Invalid document migration definition.");
  }
  globalMigrations.push(migration);
}

/**
 * Built-in migration for legacy / unversioned / 0.x state snapshots into schemaVersion 1.0.0.
 */
function migrateLegacyToV1(raw: Record<string, unknown>): Record<string, unknown> {
  const migrated = deepClone(raw);
  migrated.schemaVersion = "1.0.0";

  // Ensure view is present
  if (!migrated.view || typeof migrated.view !== "string") {
    migrated.view = (migrated.dentition as string) || "permanent";
  }

  // Ensure teeth overlay is an object
  if (!migrated.teeth || typeof migrated.teeth !== "object") {
    migrated.teeth = {};
  }

  // Ensure marks is an array and marks are normalized
  if (Array.isArray(migrated.marks)) {
    migrated.marks = normalizeMarks(migrated.marks as any[]);
  } else {
    migrated.marks = [];
  }

  return migrated;
}

/**
 * Execute document migrations to bring an older document up to the target version.
 */
export function migrateOdontogramDocument(
  rawDoc: unknown,
  targetVersion: string = CURRENT_SCHEMA_VERSION,
  customMigrations: DocumentMigration[] = [],
): { document: Record<string, unknown>; migrated: boolean; fromVersion?: string } {
  if (!rawDoc || typeof rawDoc !== "object") {
    throw new OdontogramValidationError(
      "Cannot migrate non-object document.",
      [
        {
          ruleId: "document-structure",
          code: VALIDATION_CODES.ERR_INVALID_DOCUMENT,
          severity: "error",
          message: "Document must be a non-null object.",
          path: "document",
        },
      ],
      VALIDATION_CODES.ERR_INVALID_DOCUMENT,
    );
  }

  const doc = deepClone(rawDoc) as Record<string, unknown>;
  const rawVersion = doc.schemaVersion;

  // Unversioned or legacy document
  if (!rawVersion || typeof rawVersion !== "string" || !isSemver(rawVersion)) {
    const fromVersion = typeof rawVersion === "string" ? rawVersion : "0.0.0";
    const migrated = migrateLegacyToV1(doc);
    return {
      document: migrated,
      migrated: true,
      fromVersion,
    };
  }

  const comparison = compareSemver(rawVersion, targetVersion);

  // Future version: MUST be rejected
  if (comparison > 0) {
    throw new OdontogramValidationError(
      `Document schemaVersion "${rawVersion}" is newer than supported schema version "${targetVersion}". Please upgrade the library to import this document.`,
      [
        {
          ruleId: "document-schema-version",
          code: VALIDATION_CODES.ERR_UNSUPPORTED_FUTURE_VERSION,
          severity: "error",
          message: `Unsupported future document schemaVersion "${rawVersion}". Supported version is "${targetVersion}".`,
          path: "schemaVersion",
          details: {
            documentVersion: rawVersion,
            supportedVersion: targetVersion,
          },
        },
      ],
      VALIDATION_CODES.ERR_UNSUPPORTED_FUTURE_VERSION,
    );
  }

  // Already target version
  if (comparison === 0) {
    return {
      document: doc,
      migrated: false,
      fromVersion: rawVersion,
    };
  }

  // Older version: execute available migration steps
  let currentDoc = doc;
  let currentVersion = rawVersion;
  let hasMigrated = false;

  const allMigrations = [...globalMigrations, ...customMigrations];

  // Try migrating step-by-step
  let progress = true;
  while (compareSemver(currentVersion, targetVersion) < 0 && progress) {
    const nextMigration = allMigrations.find((m) => m.fromVersion === currentVersion);
    if (nextMigration) {
      try {
        currentDoc = nextMigration.migrate(currentDoc);
        currentVersion = nextMigration.toVersion;
        currentDoc.schemaVersion = currentVersion;
        hasMigrated = true;
      } catch (err) {
        throw new OdontogramValidationError(
          `Document migration from ${nextMigration.fromVersion} to ${nextMigration.toVersion} failed: ${err instanceof Error ? err.message : String(err)}`,
          [
            {
              ruleId: "document-migration",
              code: VALIDATION_CODES.ERR_MIGRATION_FAILED,
              severity: "error",
              message: `Migration from ${nextMigration.fromVersion} to ${nextMigration.toVersion} failed: ${err instanceof Error ? err.message : String(err)}`,
              path: "schemaVersion",
            },
          ],
          VALIDATION_CODES.ERR_MIGRATION_FAILED,
        );
      }
    } else {
      // If version is 0.x, apply built-in legacy to v1
      if (compareSemver(currentVersion, "1.0.0") < 0) {
        currentDoc = migrateLegacyToV1(currentDoc);
        currentVersion = "1.0.0";
        hasMigrated = true;
      } else {
        progress = false;
      }
    }
  }

  if (compareSemver(currentVersion, targetVersion) < 0) {
    throw new OdontogramValidationError(
      `No migration path available from schemaVersion "${rawVersion}" to "${targetVersion}".`,
      [
        {
          ruleId: "document-schema-version",
          code: VALIDATION_CODES.ERR_UNSUPPORTED_SCHEMA_VERSION,
          severity: "error",
          message: `No migration available for schemaVersion "${rawVersion}".`,
          path: "schemaVersion",
          details: {
            documentVersion: rawVersion,
            targetVersion,
          },
        },
      ],
      VALIDATION_CODES.ERR_UNSUPPORTED_SCHEMA_VERSION,
    );
  }

  return {
    document: currentDoc,
    migrated: hasMigrated,
    fromVersion: rawVersion,
  };
}

/**
 * Validate an Odontogram document against structural schema, versioning, and clinical rules.
 */
export function validateOdontogramDocument(
  doc: unknown,
  config: ValidatorConfig = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!doc || typeof doc !== "object") {
    issues.push({
      ruleId: "document-structure",
      code: VALIDATION_CODES.ERR_INVALID_DOCUMENT,
      severity: "error",
      message: "Document must be a non-null object.",
      path: "document",
    });
    return {
      valid: false,
      issues,
      errors: issues,
      warnings: [],
    };
  }

  const raw = doc as Record<string, unknown>;

  // 1. Validate schemaVersion
  if (
    !raw.schemaVersion ||
    typeof raw.schemaVersion !== "string" ||
    raw.schemaVersion.trim() === ""
  ) {
    issues.push({
      ruleId: "document-schema-version",
      code: VALIDATION_CODES.ERR_INVALID_SCHEMA_VERSION,
      severity: "error",
      message: "Document missing required string 'schemaVersion'.",
      path: "schemaVersion",
    });
  } else if (!isSemver(raw.schemaVersion)) {
    issues.push({
      ruleId: "document-schema-version",
      code: VALIDATION_CODES.ERR_INVALID_SCHEMA_VERSION,
      severity: "error",
      message: `Invalid schemaVersion "${raw.schemaVersion}". Must follow semantic version format (e.g. "1.0.0").`,
      path: "schemaVersion",
    });
  } else if (compareSemver(raw.schemaVersion, CURRENT_SCHEMA_VERSION) > 0) {
    issues.push({
      ruleId: "document-schema-version",
      code: VALIDATION_CODES.ERR_UNSUPPORTED_FUTURE_VERSION,
      severity: "error",
      message: `Unsupported future document schemaVersion "${raw.schemaVersion}". Supported version is "${CURRENT_SCHEMA_VERSION}".`,
      path: "schemaVersion",
      details: {
        documentVersion: raw.schemaVersion,
        supportedVersion: CURRENT_SCHEMA_VERSION,
      },
    });
  }

  // 2. Validate view descriptor
  if (!raw.view || typeof raw.view !== "string" || raw.view.trim() === "") {
    issues.push({
      ruleId: "document-view",
      code: VALIDATION_CODES.ERR_INVALID_STATE,
      severity: "error",
      message: "Document must define a valid non-empty 'view' string.",
      path: "view",
    });
  }

  // 3. Validate teeth overlay structure
  if (
    raw.teeth !== undefined &&
    (typeof raw.teeth !== "object" || raw.teeth === null || Array.isArray(raw.teeth))
  ) {
    issues.push({
      ruleId: "document-teeth",
      code: VALIDATION_CODES.ERR_INVALID_STATE,
      severity: "error",
      message: "Document property 'teeth' must be a record object.",
      path: "teeth",
    });
  }

  // 4. Validate marks array
  if (raw.marks !== undefined && !Array.isArray(raw.marks)) {
    issues.push({
      ruleId: "document-marks",
      code: VALIDATION_CODES.ERR_INVALID_STATE,
      severity: "error",
      message: "Document property 'marks' must be an array.",
      path: "marks",
    });
  }

  // 5. Validate visualSettings if present
  if (raw.visualSettings !== undefined) {
    if (
      typeof raw.visualSettings !== "object" ||
      raw.visualSettings === null ||
      Array.isArray(raw.visualSettings)
    ) {
      issues.push({
        ruleId: "document-visual-settings",
        code: VALIDATION_CODES.ERR_INVALID_OPTION,
        severity: "error",
        message: "Property 'visualSettings' must be an object.",
        path: "visualSettings",
      });
    }
  }

  // 6. Check for non-serializable elements (DOM nodes, functions)
  try {
    JSON.stringify(raw, (key, value) => {
      if (typeof value === "function") {
        issues.push({
          ruleId: "document-serializability",
          code: VALIDATION_CODES.ERR_INVALID_DOCUMENT,
          severity: "error",
          message: `Document property "${key}" contains a non-serializable function.`,
          path: key,
        });
      }
      if (
        value !== null &&
        typeof value === "object" &&
        typeof (value as any).nodeType === "number"
      ) {
        issues.push({
          ruleId: "document-serializability",
          code: VALIDATION_CODES.ERR_INVALID_DOCUMENT,
          severity: "error",
          message: `Document property "${key}" contains a DOM Element node.`,
          path: key,
        });
      }
      return value;
    });
  } catch (err) {
    issues.push({
      ruleId: "document-serializability",
      code: VALIDATION_CODES.ERR_INVALID_DOCUMENT,
      severity: "error",
      message: `Document serialization error: ${err instanceof Error ? err.message : String(err)}`,
      path: "document",
    });
  }

  // 7. Clinical & Structural validation on state
  const state: OdontogramState = {
    view: typeof raw.view === "string" ? (raw.view as any) : "permanent",
    teeth: (raw.teeth as Record<ToothId, ToothState>) || {},
    marks: Array.isArray(raw.marks) ? normalizeMarks(raw.marks as any[]) : [],
    selection: { teeth: [], surfaces: [] },
  };

  const stateValidation = validateOdontogramState(state, config);
  issues.push(...stateValidation.issues);

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
 * Extract serializable visual settings from an OdontogramOptions object.
 */
export function extractVisualSettings(options: OdontogramOptions): OdontogramVisualSettings {
  const settings: OdontogramVisualSettings = {};
  for (const key of SERIALIZABLE_OPTION_KEYS) {
    if (options[key as keyof OdontogramOptions] !== undefined) {
      (settings as any)[key] = deepClone(options[key as keyof OdontogramOptions]);
    }
  }
  return settings;
}

/**
 * Export an OdontogramState snapshot to a clean, standard OdontogramDocument.
 * Excludes DOM nodes, event listeners, callbacks, and transient selection by default.
 */
export function exportOdontogramDocument(
  state: OdontogramState,
  options: ExportDocumentOptions = {},
  currentOptions?: OdontogramOptions,
): OdontogramDocument {
  const schemaVersion = options.schemaVersion || CURRENT_SCHEMA_VERSION;
  const clonedState = deepClone(state);

  const document: OdontogramDocument = {
    $schema: options.schemaUrl || DEFAULT_DOCUMENT_SCHEMA_URI,
    schemaVersion,
    view: clonedState.view,
    teeth: clonedState.teeth || {},
    marks: normalizeMarks(clonedState.marks || []),
  };

  // Optional visual settings
  if (options.includeVisualSettings && currentOptions) {
    const visualSettings = extractVisualSettings(currentOptions);
    if (Object.keys(visualSettings).length > 0) {
      document.visualSettings = visualSettings;
    }
  }

  // Optional transient selection
  if (options.includeSelection && clonedState.selection) {
    document.selection = {
      teeth: [...(clonedState.selection.teeth || [])],
      surfaces: [...(clonedState.selection.surfaces || [])],
      ...(clonedState.selection.annotations?.length
        ? { annotations: [...clonedState.selection.annotations] }
        : {}),
    };
  }

  // Attach optional document metadata
  if (options.metadata && Object.keys(options.metadata).length > 0) {
    document.metadata = deepClone(options.metadata);
  }

  // Preserve any custom root extensions
  if (options.extensions) {
    for (const [key, val] of Object.entries(options.extensions)) {
      if (!KNOWN_DOCUMENT_ROOT_KEYS.has(key)) {
        (document as any)[key] = deepClone(val);
      }
    }
  }

  return document;
}

/**
 * Parse and import an OdontogramDocument, validating and migrating as necessary.
 */
export function importOdontogramDocument(
  rawDoc: unknown,
  options: ImportDocumentOptions = {},
): OdontogramImportResult {
  if (!rawDoc || typeof rawDoc !== "object") {
    throw new OdontogramValidationError(
      "Cannot import non-object document.",
      [
        {
          ruleId: "document-structure",
          code: VALIDATION_CODES.ERR_INVALID_DOCUMENT,
          severity: "error",
          message: "Document must be a non-null object.",
          path: "document",
        },
      ],
      VALIDATION_CODES.ERR_INVALID_DOCUMENT,
    );
  }

  // 1. Run migrations if necessary
  const migrationResult = migrateOdontogramDocument(
    rawDoc,
    CURRENT_SCHEMA_VERSION,
    options.migrations,
  );
  const migratedDoc = migrationResult.document;

  // 2. Validate document
  const validatorConfig: ValidatorConfig = {
    strict: options.strict,
    ...(typeof options.validator === "object" ? options.validator : {}),
  };

  const validation = validateOdontogramDocument(migratedDoc, validatorConfig);
  if (!validation.valid) {
    throw new OdontogramValidationError(
      `Document import failed validation: ${validation.errors[0]?.message}`,
      validation.issues,
      validation.errors[0]?.code || VALIDATION_CODES.ERR_INVALID_DOCUMENT,
    );
  }

  // 3. Extract unknown extensions so they are never silently dropped
  const extensions: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(migratedDoc)) {
    if (!KNOWN_DOCUMENT_ROOT_KEYS.has(key)) {
      extensions[key] = deepClone(val);
    }
  }

  // 4. Build clean restored state
  const rawTeeth = (migratedDoc.teeth as Record<ToothId, ToothState>) || {};
  const rawMarks = Array.isArray(migratedDoc.marks) ? (migratedDoc.marks as any[]) : [];

  const restoredSelection: SelectionState =
    options.preserveSelection && migratedDoc.selection && typeof migratedDoc.selection === "object"
      ? {
          teeth: Array.isArray((migratedDoc.selection as any).teeth)
            ? [...(migratedDoc.selection as any).teeth]
            : [],
          surfaces: Array.isArray((migratedDoc.selection as any).surfaces)
            ? [...(migratedDoc.selection as any).surfaces]
            : [],
          ...((migratedDoc.selection as any).annotations
            ? { annotations: [...(migratedDoc.selection as any).annotations] }
            : {}),
        }
      : { teeth: [], surfaces: [] };

  const restoredState: OdontogramState = {
    view: (migratedDoc.view as any) || "permanent",
    teeth: deepClone(rawTeeth),
    marks: normalizeMarks(rawMarks),
    selection: restoredSelection,
  };

  const visualSettings =
    migratedDoc.visualSettings && typeof migratedDoc.visualSettings === "object"
      ? (deepClone(migratedDoc.visualSettings) as OdontogramVisualSettings)
      : undefined;

  const metadata =
    migratedDoc.metadata && typeof migratedDoc.metadata === "object"
      ? (deepClone(migratedDoc.metadata) as Record<string, unknown>)
      : undefined;

  return {
    ok: true,
    state: restoredState,
    schemaVersion: (migratedDoc.schemaVersion as string) || CURRENT_SCHEMA_VERSION,
    migrated: migrationResult.migrated,
    migratedFromVersion: migrationResult.fromVersion,
    visualSettings,
    metadata,
    extensions: Object.keys(extensions).length > 0 ? extensions : undefined,
    validation,
  };
}
