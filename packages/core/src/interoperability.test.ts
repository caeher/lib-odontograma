import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DOCUMENT_SCHEMA_URI,
  compareSemver,
  isSemver,
  migrateOdontogramDocument,
  validateOdontogramDocument,
} from "./interoperability.js";
import {
  DOCUMENT_DECIDUOUS_PULPOTOMY_EXAMPLE,
  DOCUMENT_INTEROPERABILITY_EXAMPLES,
  DOCUMENT_MIXED_DENTITION_EXAMPLE,
  DOCUMENT_MULTI_TOOTH_BRIDGE_EXAMPLE,
  DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE,
  DOCUMENT_WITH_EXTENSIONS_EXAMPLE,
} from "./examples.js";
import { OdontogramValidationError, VALIDATION_CODES } from "./errors.js";
import type { OdontogramDocument } from "./types.js";

describe("Stage 07 · Interoperability & Document Serialization", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("Semver utilities & Schema Versioning", () => {
    it("validates semantic version strings correctly", () => {
      expect(isSemver("1.0.0")).toBe(true);
      expect(isSemver("0.1.0")).toBe(true);
      expect(isSemver("2.1.4-beta.1")).toBe(true);
      expect(isSemver("v1.0.0")).toBe(true);
      expect(isSemver("1.0")).toBe(false);
      expect(isSemver("invalid")).toBe(false);
      expect(isSemver("")).toBe(false);
    });

    it("compares semantic versions accurately", () => {
      expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
      expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
      expect(compareSemver("1.1.0", "1.0.0")).toBe(1);
      expect(compareSemver("1.0.1", "1.0.0")).toBe(1);
      expect(compareSemver("0.9.0", "1.0.0")).toBe(-1);
      expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
    });

    it("exports documents with canonical CURRENT_SCHEMA_VERSION (1.0.0)", () => {
      const odontogram = new Odontogram(container);
      const doc = odontogram.exportDocument();
      expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(doc.$schema).toBe(DEFAULT_DOCUMENT_SCHEMA_URI);
    });
  });

  describe("Exclusion by Default & Optional Visual Presentation Settings", () => {
    it("excludes DOM elements, functions, listeners, and transient selection by default", () => {
      let _clicked = false;
      const odontogram = new Odontogram(container, {
        toothClick: () => {
          _clicked = true;
        },
        surfaceClick: () => {},
        notation: "universal",
      });
      odontogram.render();

      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      odontogram.selectTooth("16");
      odontogram.selectSurface("16", "O", "add");

      expect(odontogram.getSelection().teeth).toHaveLength(1);

      const exported = odontogram.exportDocument();

      // Verify no DOM or function leakage
      const json = JSON.stringify(exported);
      expect(json).not.toContain("toothClick");
      expect(json).not.toContain("surfaceClick");
      expect(json).not.toContain("odontogram-host");
      expect(json).not.toContain("odontogram-view");

      // Transient selection is omitted by default
      expect(exported.selection).toBeUndefined();

      // Visual settings omitted by default
      expect(exported.visualSettings).toBeUndefined();

      // Verify domain payload is intact
      expect(exported.view).toBe("permanent");
      expect(exported.marks).toHaveLength(1);
      expect(exported.marks[0].id).toBeDefined();
      expect(exported.marks[0].type).toBe("caries");
      expect(exported.marks[0].target).toEqual({
        kind: "surface",
        tooth: "16",
        surfaces: ["O"],
      });
    });

    it("supports optional export of transient selection when explicitly requested", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMark({ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" });
      odontogram.selectTooth("16");
      odontogram.selectSurface("16", "O", "add");

      const exported = odontogram.exportDocument({ includeSelection: true });
      expect(exported.selection).toBeDefined();
      expect(exported.selection?.teeth).toEqual(["16"]);
      expect(exported.selection?.surfaces).toEqual([{ tooth: "16", surface: "O" }]);
    });

    it("supports optional export and restore of serializable visual presentation settings", () => {
      const odontogram = new Odontogram(container, {
        notation: "palmer",
        locale: "es",
        showOrientationLabels: true,
        showMidline: true,
        toothColor: "#fafafa",
        surfaceColor: "#f0f0f0",
        selectionColor: "#bbdefb",
        markColors: { caries: "#e53935" },
        statusColors: { completed: "#43a047" },
        minZoom: 1,
        maxZoom: 3,
      });

      const exported = odontogram.exportDocument({ includeVisualSettings: true });
      expect(exported.visualSettings).toBeDefined();
      expect(exported.visualSettings?.notation).toBe("palmer");
      expect(exported.visualSettings?.locale).toBe("es");
      expect(exported.visualSettings?.toothColor).toBe("#fafafa");
      expect(exported.visualSettings?.surfaceColor).toBe("#f0f0f0");
      expect(exported.visualSettings?.markColors).toEqual({ caries: "#e53935" });
      expect(exported.visualSettings?.statusColors).toEqual({ completed: "#43a047" });

      // Import into a fresh instance and verify visual settings application
      const targetOdontogram = new Odontogram(container, { notation: "fdi", locale: "en" });
      targetOdontogram.render();

      const importResult = targetOdontogram.importDocument(exported);
      expect(importResult.ok).toBe(true);
      expect(targetOdontogram.getOption("notation")).toBe("palmer");
      expect(targetOdontogram.getOption("locale")).toBe("es");
      expect(targetOdontogram.getOption("toothColor")).toBe("#fafafa");
      expect(targetOdontogram.getOption("statusColors")).toEqual({ completed: "#43a047" });
    });

    it("implements toJSON() for seamless JSON.stringify(odontogram) export", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMark({ tooth: "21", surfaces: ["M", "I", "D"], type: "restoration" });

      const jsonStr = JSON.stringify(odontogram);
      const parsed = JSON.parse(jsonStr) as OdontogramDocument;

      expect(parsed.schemaVersion).toBe("1.0.0");
      expect(parsed.view).toBe("permanent");
      expect(parsed.marks).toHaveLength(1);
      expect(parsed.marks[0].type).toBe("restoration");
      expect(parsed.marks[0].target).toEqual({
        kind: "surface",
        tooth: "21",
        surfaces: ["M", "I", "D"],
      });
    });
  });

  describe("Validation & Atomic State Replacement", () => {
    it("validates valid document examples successfully", () => {
      for (const [name, doc] of Object.entries(DOCUMENT_INTEROPERABILITY_EXAMPLES)) {
        const validation = validateOdontogramDocument(doc);
        expect(
          validation.valid,
          `Example ${name} should be valid, but had errors: ${JSON.stringify(validation.errors)}`,
        ).toBe(true);
      }
    });

    it("rejects future schema versions with ERR_UNSUPPORTED_FUTURE_VERSION", () => {
      const futureDoc = {
        $schema: DEFAULT_DOCUMENT_SCHEMA_URI,
        schemaVersion: "2.0.0",
        view: "permanent",
        teeth: {},
        marks: [],
      };

      const validation = validateOdontogramDocument(futureDoc);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].code).toBe(VALIDATION_CODES.ERR_UNSUPPORTED_FUTURE_VERSION);
      expect(validation.errors[0].ruleId).toBe("document-schema-version");

      const odontogram = new Odontogram(container);
      expect(() => odontogram.importDocument(futureDoc)).toThrow(OdontogramValidationError);
    });

    it("rejects invalid document structure, invalid presence values, and missing fields with detailed issues", () => {
      const invalidDoc = {
        schemaVersion: "1.0.0",
        view: "",
        teeth: {
          "16": { presence: "alien-presence" },
        },
        marks: [
          {
            id: "m1",
            type: "caries",
            target: { tooth: "16", surfaces: ["INVALID_SURFACE"] },
          },
          {
            id: "m1", // duplicate id
            type: "crown",
            target: { tooth: "16" },
          },
        ],
      };

      const validation = validateOdontogramDocument(invalidDoc);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(3);

      const codes = validation.errors.map((e) => e.code);
      expect(codes).toContain(VALIDATION_CODES.ERR_INVALID_PRESENCE);
      expect(codes).toContain(VALIDATION_CODES.ERR_INVALID_SURFACE);
      expect(codes).toContain(VALIDATION_CODES.ERR_DUPLICATE_MARK_ID);
    });

    it("guarantees atomic rollback: state and revision remain untouched if import fails", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMark({ id: "initial-mark", tooth: "11", surfaces: ["M"], type: "caries" });
      odontogram.setToothState("18", "missing");

      const stateBefore = odontogram.getState();
      const revBefore = odontogram.getRevision();

      const corruptDoc = {
        schemaVersion: "1.0.0",
        view: "permanent",
        teeth: {
          "16": { presence: "missing" },
        },
        marks: [
          // Surface mark on tooth declared missing -> presence conflict error
          { id: "bad-mark", type: "caries", target: { tooth: "16", surfaces: ["O"] } },
        ],
      };

      let threw = false;
      try {
        odontogram.importDocument(corruptDoc);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(OdontogramValidationError);
        const valErr = err as OdontogramValidationError;
        expect(valErr.errors.some((e) => e.code === VALIDATION_CODES.ERR_PRESENCE_CONFLICT)).toBe(
          true,
        );
      }

      expect(threw).toBe(true);

      // State and revision MUST be 100% unchanged
      expect(odontogram.getState()).toEqual(stateBefore);
      expect(odontogram.getRevision()).toBe(revBefore);
      expect(odontogram.hasMark("initial-mark")).toBe(true);
      expect(odontogram.getToothPresence("18")).toBe("missing");
      expect(odontogram.getToothPresence("16")).toBe("present");
    });

    it("atomically replaces state on successful import and notifies subscribers", () => {
      const odontogram = new Odontogram(container);
      odontogram.addMark({ id: "old-mark", tooth: "11", surfaces: ["M"], type: "caries" });

      let stateChanged = false;
      let editChanged = false;
      odontogram.setOption("stateDidChange", () => {
        stateChanged = true;
      });
      odontogram.setOption("editDidChange", () => {
        editChanged = true;
      });

      const newDoc: OdontogramDocument = {
        schemaVersion: "1.0.0",
        view: "permanent",
        teeth: {
          "18": { presence: "missing" },
          "28": { presence: "unerupted" },
        },
        marks: [
          {
            id: "imported-mod-16",
            type: "restoration",
            status: "completed",
            target: { tooth: "16", surfaces: ["M", "O", "D"] },
            metadata: { shade: "A2" },
          },
        ],
      };

      const result = odontogram.importDocument(newDoc);
      expect(result.ok).toBe(true);
      expect(stateChanged).toBe(true);
      expect(editChanged).toBe(true);

      expect(odontogram.hasMark("old-mark")).toBe(false);
      expect(odontogram.hasMark("imported-mod-16")).toBe(true);
      expect(odontogram.getToothPresence("18")).toBe("missing");
      expect(odontogram.getToothPresence("28")).toBe("unerupted");
      expect(odontogram.getToothPresence("16")).toBe("present");
    });
  });

  describe("Migrations & Unknown Extensions", () => {
    it("migrates legacy / unversioned raw state snapshots to schemaVersion 1.0.0", () => {
      const legacyRaw = {
        view: "permanent",
        marks: [
          {
            id: "legacy-1",
            type: "caries",
            tooth: "16",
            surfaces: ["O"],
          },
        ],
        teeth: {
          "38": { presence: "missing" },
        },
      };

      const result = migrateOdontogramDocument(legacyRaw);
      expect(result.migrated).toBe(true);
      expect(result.document.schemaVersion).toBe("1.0.0");
      expect(result.document.marks).toHaveLength(1);
      expect((result.document.marks as any)[0].target).toEqual({
        kind: "surface",
        tooth: "16",
        surfaces: ["O"],
      });

      const validation = validateOdontogramDocument(result.document);
      expect(validation.valid).toBe(true);
    });

    it("executes custom registered document migrations", () => {
      const customMigration = {
        fromVersion: "0.5.0",
        toVersion: "1.0.0",
        migrate: (doc: Record<string, unknown>) => {
          const next = { ...doc };
          if (Array.isArray(next.marks)) {
            next.marks = next.marks.map((m: any) => ({
              ...m,
              type: m.legacyType || m.type,
            }));
          }
          return next;
        },
      };

      const legacyDoc = {
        schemaVersion: "0.5.0",
        view: "permanent",
        teeth: {},
        marks: [
          {
            id: "migrated-mark-1",
            legacyType: "composite-restoration",
            target: { tooth: "16", surfaces: ["O"] },
          },
        ],
      };

      const result = migrateOdontogramDocument(legacyDoc, "1.0.0", [customMigration]);
      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe("0.5.0");
      expect(result.document.schemaVersion).toBe("1.0.0");
      expect((result.document.marks as any)[0].type).toBe("composite-restoration");
    });

    it("strictly preserves unknown extension properties and custom metadata across save/restore cycles", () => {
      const docWithExtensions = DOCUMENT_WITH_EXTENSIONS_EXAMPLE;

      const odontogram = new Odontogram(container);
      const importResult = odontogram.importDocument(docWithExtensions);

      expect(importResult.ok).toBe(true);
      expect(importResult.metadata).toEqual({
        integrationSystem: "CustomEHR-v4",
        encounterId: "enc-89471",
      });
      expect(importResult.extensions).toEqual({
        customTelemetryExtension: {
          sessionKey: "sess-abc-123",
          diagnosticLevel: "research",
        },
      });

      // Export with preserved extensions and metadata
      const reExported = odontogram.exportDocument({
        metadata: importResult.metadata,
        extensions: importResult.extensions,
      });

      expect(reExported.metadata).toEqual(docWithExtensions.metadata);
      expect((reExported as any).customTelemetryExtension).toEqual(
        docWithExtensions.customTelemetryExtension,
      );

      // Verify mark-level custom metadata & custom vendor payload preservation
      const mark = reExported.marks.find((m) => m.id === "mark-custom-sensor-46");
      expect(mark).toBeDefined();
      expect(mark?.metadata).toEqual(docWithExtensions.marks[0].metadata);
      expect((mark as any).customSensorVendorPayload).toEqual(
        docWithExtensions.marks[0].customSensorVendorPayload,
      );
    });
  });

  describe("Dentition Round-Trips (Permanent, Primary, Mixed, Multi-Surface & Multi-Tooth)", () => {
    it("performs lossless round trip for permanent dentition with multi-surface marks and tooth overlay", () => {
      const original = DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE;
      const odontogram = new Odontogram(container);

      odontogram.importDocument(original);
      const exported = odontogram.exportDocument({
        metadata: original.metadata,
      });

      expect(exported.schemaVersion).toBe(original.schemaVersion);
      expect(exported.view).toBe(original.view);
      expect(exported.teeth).toEqual(original.teeth);
      expect(exported.marks).toEqual(original.marks);
      expect(exported.metadata).toEqual(original.metadata);
    });

    it("performs lossless round trip for deciduous / primary dentition (pulpotomy & SSC)", () => {
      const original = DOCUMENT_DECIDUOUS_PULPOTOMY_EXAMPLE;
      const odontogram = new Odontogram(container, { initialView: "deciduous" });

      odontogram.importDocument(original);
      const exported = odontogram.exportDocument();

      expect(exported.view).toBe("deciduous");
      expect(exported.teeth).toEqual(original.teeth);
      expect(exported.marks).toEqual(original.marks);
    });

    it("performs lossless round trip for 52-tooth mixed dentition layout", () => {
      const original = DOCUMENT_MIXED_DENTITION_EXAMPLE;
      const odontogram = new Odontogram(container, { initialView: "mixed" });

      odontogram.importDocument(original);
      const exported = odontogram.exportDocument();

      expect(exported.view).toBe("mixed");
      expect(exported.teeth).toEqual(original.teeth);
      expect(exported.marks).toHaveLength(2);
      expect(exported.marks[0].target).toEqual({
        kind: "surface",
        tooth: "16",
        surfaces: ["O"],
      });
      expect(exported.marks[1].target).toEqual({
        kind: "surface",
        tooth: "55",
        surfaces: ["M"],
      });
    });

    it("performs lossless round trip for multi-tooth annotations (bridges with support & pontic targets)", () => {
      const original = DOCUMENT_MULTI_TOOTH_BRIDGE_EXAMPLE;
      const odontogram = new Odontogram(container);

      odontogram.importDocument(original);
      const exported = odontogram.exportDocument();

      expect(exported.marks).toHaveLength(1);
      const bridge = exported.marks[0];
      expect(bridge.type).toBe("bridge");
      expect(bridge.status).toBe("planned");
      expect(bridge.target).toEqual(original.marks[0].target);
      expect(bridge.metadata).toEqual(original.marks[0].metadata);
      expect(bridge.style).toEqual(original.marks[0].style);
    });

    it("is strictly limited to the odontogram domain without requiring patient data or storage", () => {
      const odontogram = new Odontogram(container);
      const doc = odontogram.exportDocument();

      expect((doc as any).patientId).toBeUndefined();
      expect((doc as any).patientName).toBeUndefined();
      expect((doc as any).billingCode).toBeUndefined();
      expect((doc as any).storageProvider).toBeUndefined();
    });
  });
});
