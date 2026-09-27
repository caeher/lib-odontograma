import type { OdontogramState } from "./types.js";

/** Serialization example: Multi-surface restorations on permanent teeth. */
export const MULTI_SURFACE_RESTORATIONS_EXAMPLE: OdontogramState = {
  view: "permanent",
  selection: { teeth: [], surfaces: [] },
  teeth: {},
  marks: [
    {
      id: "restoration-16-mod",
      type: "restoration",
      status: "completed",
      target: {
        tooth: "16",
        surfaces: ["M", "O", "D"],
      },
      text: "MOD light-cured composite resin restoration",
      metadata: {
        material: "composite-resin",
        shade: "A2",
        bondingAgent: "universal-adhesive",
        date: "2026-03-15",
        providerId: "dr-smith",
      },
      style: {
        fill: "#42a5f5",
        stroke: "#1e88e5",
      },
      tooth: "16",
      surfaces: ["M", "O", "D"],
    },
    {
      id: "restoration-24-do",
      type: "restoration",
      status: "planned",
      target: {
        tooth: "24",
        surfaces: ["D", "O"],
      },
      text: "DO amalgam restoration planned",
      metadata: {
        material: "amalgam",
        estimatedDurationMinutes: 30,
      },
      style: {
        fill: "#ffb74d",
        stroke: "#f57c00",
      },
      tooth: "24",
      surfaces: ["D", "O"],
    },
    {
      id: "restoration-21-mid",
      type: "restoration",
      status: "existing",
      target: {
        tooth: "21",
        surfaces: ["M", "I", "D"],
      },
      text: "MID composite restoration on anterior central incisor",
      metadata: {
        material: "microhybrid-composite",
        shade: "B1",
      },
      tooth: "21",
      surfaces: ["M", "I", "D"],
    },
  ],
};

/** Serialization example: Whole-tooth marks (crowns, implants, extractions). */
export const WHOLE_TOOTH_MARKS_EXAMPLE: OdontogramState = {
  view: "permanent",
  selection: { teeth: [], surfaces: [] },
  teeth: {
    "18": { presence: "missing" },
    "28": { presence: "unerupted" },
  },
  marks: [
    {
      id: "crown-36",
      type: "crown",
      status: "existing",
      target: {
        tooth: "36",
      },
      text: "Porcelain-fused-to-metal (PFM) crown",
      metadata: {
        material: "PFM",
        cementType: "resin-modified-glass-ionomer",
        placedDate: "2024-11-20",
      },
      tooth: "36",
      surfaces: [],
    },
    {
      id: "implant-46",
      type: "implant",
      status: "completed",
      target: {
        tooth: "46",
      },
      text: "Endosseous titanium implant fixture with screw-retained ceramic crown",
      metadata: {
        fixtureSystem: "Straumann",
        diameterMm: 4.1,
        lengthMm: 10.0,
        torqueNcm: 35,
      },
      tooth: "46",
      surfaces: [],
    },
    {
      id: "extraction-48",
      type: "extraction",
      status: "planned",
      target: {
        tooth: "48",
      },
      text: "Surgical extraction indicated due to horizontal bone impaction",
      metadata: {
        urgency: "elective",
      },
      tooth: "48",
      surfaces: [],
    },
  ],
};

/** Serialization example: Multi-tooth annotations (fixed bridges, retainers, splints). */
export const MULTI_TOOTH_ANNOTATIONS_EXAMPLE: OdontogramState = {
  view: "permanent",
  selection: { teeth: [], surfaces: [] },
  teeth: {
    "15": { presence: "missing" },
  },
  marks: [
    {
      id: "bridge-14-15-16",
      type: "bridge",
      status: "planned",
      target: {
        teeth: ["14", "15", "16"],
      },
      text: "3-unit fixed partial denture (14-Abutment, 15-Pontic, 16-Abutment)",
      metadata: {
        retainers: ["14", "16"],
        pontics: ["15"],
        material: "monolithic-zirconia",
        shade: "A3",
        labName: "Precision Dental Lab",
      },
      style: {
        fill: "#ab47bc",
        stroke: "#7b1fa2",
      },
    },
    {
      id: "splint-mandibular-anterior",
      type: "splint",
      status: "completed",
      target: {
        teeth: ["43", "42", "41", "31", "32", "33"],
      },
      text: "Periodontal flexible braided stainless steel wire splint bonded lingually",
      metadata: {
        arch: "mandibular",
        wireType: "0.0175 braided stainless steel",
        bondingType: "flowable composite",
      },
    },
  ],
};

/** Serialization example: Multiple coexisting marks on a single tooth preserving identifiers. */
export const MULTI_MARK_COEXISTENCE_EXAMPLE: OdontogramState = {
  view: "permanent",
  selection: { teeth: [], surfaces: [] },
  teeth: {},
  marks: [
    {
      id: "mark-16-endo",
      type: "endodontic",
      status: "completed",
      target: { tooth: "16" },
      text: "Root canal therapy completed on 4 canals (MB1, MB2, DB, P)",
      metadata: {
        canals: 4,
        obturationMethod: "warm-vertical-condensation",
        sealer: "bioceramic",
      },
      tooth: "16",
      surfaces: [],
    },
    {
      id: "mark-16-post-core",
      type: "post-and-core",
      status: "completed",
      target: { tooth: "16" },
      text: "Glass fiber post cemented in palatal canal with composite core buildup",
      metadata: {
        postMaterial: "glass-fiber",
        coreMaterial: "dual-cure-composite",
      },
      tooth: "16",
      surfaces: [],
    },
    {
      id: "mark-16-crown",
      type: "crown",
      status: "completed",
      target: { tooth: "16" },
      text: "Full monolithic zirconia crown",
      metadata: {
        material: "zirconia",
        shade: "A2",
      },
      tooth: "16",
      surfaces: [],
    },
    {
      id: "mark-46-caries-b",
      type: "caries",
      status: "existing",
      target: { tooth: "46", surfaces: ["B"] },
      text: "Buccal pit enamel caries (ICDAS 2)",
      metadata: {
        depth: "enamel",
      },
      tooth: "46",
      surfaces: ["B"],
    },
    {
      id: "mark-46-sealant-o",
      type: "sealant",
      status: "existing",
      target: { tooth: "46", surfaces: ["O"] },
      text: "Intact resin-based fissure sealant",
      metadata: {
        intact: true,
      },
      tooth: "46",
      surfaces: ["O"],
    },
  ],
};

/** Serialization example: Unknown/custom mark types preserved with full metadata without loss. */
export const UNKNOWN_MARK_PRESERVATION_EXAMPLE: OdontogramState = {
  view: "permanent",
  selection: { teeth: [], surfaces: [] },
  teeth: {},
  marks: [
    {
      id: "custom-intraoral-scan-16",
      type: "intraoral-mesh-scan",
      status: "completed",
      target: {
        tooth: "16",
        surfaces: ["M", "O", "D"],
      },
      text: "High-resolution 3D optical mesh impression",
      metadata: {
        scannerModel: "Trios-5",
        pointCount: 45000,
        meshUri: "storage://scans/2026-09-15/mesh-16.ply",
        acquisitionTimestamp: "2026-09-15T10:30:00Z",
      },
      style: {
        fill: "#7e57c2",
        stroke: "#512da8",
        opacity: 0.85,
      },
      tooth: "16",
      surfaces: ["M", "O", "D"],
    },
    {
      id: "custom-plugin-sensor-46",
      type: "periodontal-probing-sensor",
      status: "existing",
      target: {
        tooth: "46",
      },
      text: "Periodontal pocket depth multi-point telemetry",
      metadata: {
        pocketDepthsMm: { MB: 3, B: 2, DB: 4, ML: 3, L: 3, DL: 5 },
        bleedingOnProbing: true,
        furcationGrade: 1,
      },
      tooth: "46",
      surfaces: [],
    },
  ],
};

/** Initial host-owned state for controlled-mode integrations. */
export const CONTROLLED_MODE_INITIAL_STATE: OdontogramState = {
  view: "permanent",
  selection: { teeth: [], surfaces: [] },
  teeth: {},
  marks: [
    {
      id: "host-mark-16",
      type: "caries",
      target: { kind: "surface", tooth: "16", surfaces: ["O"] },
      tooth: "16",
      surfaces: ["O"],
    },
  ],
};

/** Example state after the host applies a tooth click (revision 3). */
export const CONTROLLED_MODE_AFTER_CLICK_STATE: OdontogramState = {
  view: "permanent",
  selection: { teeth: ["16"], surfaces: [] },
  teeth: {},
  marks: [
    {
      id: "host-mark-16",
      type: "caries",
      target: { kind: "surface", tooth: "16", surfaces: ["O"] },
      tooth: "16",
      surfaces: ["O"],
    },
  ],
};

/**
 * Controlled-mode integration sample: host-owned state with explicit revisions.
 * The host applies clicks by calling setState with `source: "external"`.
 */
export const CONTROLLED_MODE_EXAMPLE = {
  initialState: CONTROLLED_MODE_INITIAL_STATE,
  afterToothClickRevision: 3,
  afterToothClickState: CONTROLLED_MODE_AFTER_CLICK_STATE,
};

/** Programmatic operations sample state for demonstrating CRUD methods. */
export const PROGRAMMATIC_OPERATIONS_EXAMPLE: OdontogramState = {
  view: "permanent",
  selection: {
    teeth: ["16"],
    surfaces: [{ tooth: "16", surface: "O" }],
  },
  teeth: {
    "18": { presence: "missing" },
    "28": { presence: "unerupted" },
  },
  marks: [
    {
      id: "demo-mark-1",
      type: "caries",
      status: "existing",
      target: { tooth: "16", surfaces: ["O"] },
      text: "Occlusal fissure caries",
      metadata: { score: 2 },
      tooth: "16",
      surfaces: ["O"],
    },
    {
      id: "demo-mark-2",
      type: "restoration",
      status: "completed",
      target: { tooth: "26", surfaces: ["M", "O", "D"] },
      text: "MOD composite",
      tooth: "26",
      surfaces: ["M", "O", "D"],
    },
  ],
};

/** Standard dictionary of all Stage 02 serialization examples. */
export const SERIALIZATION_EXAMPLES = {
  multiSurfaceRestorations: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
  wholeToothMarks: WHOLE_TOOTH_MARKS_EXAMPLE,
  multiToothAnnotations: MULTI_TOOTH_ANNOTATIONS_EXAMPLE,
  multiMarkCoexistence: MULTI_MARK_COEXISTENCE_EXAMPLE,
  unknownMarkPreservation: UNKNOWN_MARK_PRESERVATION_EXAMPLE,
  programmaticOperations: PROGRAMMATIC_OPERATIONS_EXAMPLE,
  controlledMode: CONTROLLED_MODE_EXAMPLE,
} as const;

/** Stage 07 Interoperability Example: Standard Permanent Dentition Document. */
export const DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE = {
  $schema: "https://lib-odontograma.dev/schemas/odontogram-document.schema.json",
  schemaVersion: "1.0.0",
  view: "permanent",
  dentition: "permanent",
  teeth: {
    "18": { presence: "missing" },
    "28": { presence: "missing" },
    "38": { presence: "unerupted" },
    "48": { presence: "unerupted" },
  },
  marks: [
    {
      id: "restoration-16-mod",
      type: "restoration",
      status: "completed",
      target: {
        kind: "surface",
        tooth: "16",
        surfaces: ["M", "O", "D"],
      },
      text: "MOD composite resin",
      metadata: {
        material: "composite-resin",
        shade: "A2",
      },
      style: {
        fill: "#42a5f5",
        stroke: "#1e88e5",
      },
      tooth: "16",
      surfaces: ["M", "O", "D"],
    },
    {
      id: "caries-26-o",
      type: "caries",
      status: "planned",
      target: {
        kind: "surface",
        tooth: "26",
        surfaces: ["O"],
      },
      text: "Occlusal pit caries",
      metadata: {
        icdasScore: 3,
      },
      tooth: "26",
      surfaces: ["O"],
    },
  ],
  metadata: {
    exportDate: "2026-09-27T00:00:00Z",
    chartingClinicId: "clinic-central",
  },
} as const;

/** Stage 07 Interoperability Example: Deciduous / Primary Dentition Document. */
export const DOCUMENT_DECIDUOUS_PULPOTOMY_EXAMPLE = {
  $schema: "https://lib-odontograma.dev/schemas/odontogram-document.schema.json",
  schemaVersion: "1.0.0",
  view: "deciduous",
  dentition: "deciduous",
  teeth: {
    "51": { presence: "missing" },
    "61": { presence: "missing" },
  },
  marks: [
    {
      id: "pulpotomy-54",
      type: "pulpotomy",
      status: "completed",
      target: {
        kind: "tooth",
        tooth: "54",
      },
      text: "Primary molar ferric sulfate pulpotomy",
      metadata: {
        medicament: "MTA",
      },
      tooth: "54",
      surfaces: [],
    },
    {
      id: "ssc-54",
      type: "crown",
      status: "completed",
      target: {
        kind: "tooth",
        tooth: "54",
      },
      text: "Stainless steel crown (SSC)",
      metadata: {
        crownType: "stainless-steel",
        size: "4",
      },
      tooth: "54",
      surfaces: [],
    },
  ],
} as const;

/** Stage 07 Interoperability Example: Mixed Dentition 4-Row Document. */
export const DOCUMENT_MIXED_DENTITION_EXAMPLE = {
  $schema: "https://lib-odontograma.dev/schemas/odontogram-document.schema.json",
  schemaVersion: "1.0.0",
  view: "mixed",
  dentition: "mixed",
  teeth: {
    "16": { presence: "present" },
    "55": { presence: "present" },
    "54": { presence: "missing" },
    "14": { presence: "unerupted" },
  },
  marks: [
    {
      id: "sealant-16-o",
      type: "sealant",
      status: "completed",
      target: {
        kind: "surface",
        tooth: "16",
        surfaces: ["O"],
      },
      text: "Pit and fissure sealant on first permanent molar",
      tooth: "16",
      surfaces: ["O"],
    },
    {
      id: "caries-55-m",
      type: "caries",
      status: "existing",
      target: {
        kind: "surface",
        tooth: "55",
        surfaces: ["M"],
      },
      text: "Interproximal caries on second primary molar",
      tooth: "55",
      surfaces: ["M"],
    },
  ],
} as const;

/** Stage 07 Interoperability Example: Multi-Tooth Bridge & Splint Document. */
export const DOCUMENT_MULTI_TOOTH_BRIDGE_EXAMPLE = {
  $schema: "https://lib-odontograma.dev/schemas/odontogram-document.schema.json",
  schemaVersion: "1.0.0",
  view: "permanent",
  teeth: {
    "15": { presence: "missing" },
  },
  marks: [
    {
      id: "bridge-14-15-16",
      type: "bridge",
      status: "planned",
      target: {
        teeth: ["14", "15", "16"],
        targets: [
          { tooth: "14", role: "support", anchor: "anchor-center" },
          { tooth: "15", role: "pontic", anchor: "anchor-center" },
          { tooth: "16", role: "support", anchor: "anchor-center" },
        ],
      },
      text: "Fixed partial denture 14-16",
      metadata: {
        retainers: ["14", "16"],
        pontics: ["15"],
        material: "zirconia",
      },
      style: {
        fill: "#ab47bc",
        stroke: "#7b1fa2",
      },
    },
  ],
} as const;

/** Stage 07 Interoperability Example: Document with Visual Settings. */
export const DOCUMENT_WITH_VISUAL_SETTINGS_EXAMPLE = {
  $schema: "https://lib-odontograma.dev/schemas/odontogram-document.schema.json",
  schemaVersion: "1.0.0",
  view: "permanent",
  teeth: {},
  marks: [
    {
      id: "mark-11-mid",
      type: "restoration",
      status: "completed",
      target: {
        tooth: "11",
        surfaces: ["M", "I", "D"],
      },
    },
  ],
  visualSettings: {
    notation: "palmer",
    locale: "es",
    showOrientationLabels: true,
    showMidline: true,
    toothColor: "#f8f9fa",
    surfaceColor: "#e9ecef",
    selectionColor: "#cfe2ff",
    markColors: {
      caries: "#dc3545",
      restoration: "#0d6efd",
    },
    statusColors: {
      completed: "#198754",
      planned: "#fd7e14",
    },
    fitToContainer: true,
    minZoom: 1,
    maxZoom: 4,
  },
} as const;

/** Stage 07 Interoperability Example: Document with Unknown Extensions & Custom Metadata. */
export const DOCUMENT_WITH_EXTENSIONS_EXAMPLE = {
  $schema: "https://lib-odontograma.dev/schemas/odontogram-document.schema.json",
  schemaVersion: "1.0.0",
  view: "permanent",
  teeth: {},
  marks: [
    {
      id: "mark-custom-sensor-46",
      type: "periodontal-probing-telemetry",
      status: "existing",
      target: {
        tooth: "46",
      },
      metadata: {
        sensorId: "perio-probe-9000",
        depths: [3, 2, 4, 3, 3, 5],
        calibratedAt: "2026-09-20T08:00:00Z",
      },
      customSensorVendorPayload: {
        rawVoltage: [1.2, 0.9, 1.4],
      },
    },
  ],
  metadata: {
    integrationSystem: "CustomEHR-v4",
    encounterId: "enc-89471",
  },
  customTelemetryExtension: {
    sessionKey: "sess-abc-123",
    diagnosticLevel: "research",
  },
} as const;

export const DOCUMENT_INTEROPERABILITY_EXAMPLES = {
  permanentRestorations: DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE,
  deciduousPulpotomy: DOCUMENT_DECIDUOUS_PULPOTOMY_EXAMPLE,
  mixedDentition: DOCUMENT_MIXED_DENTITION_EXAMPLE,
  multiToothBridge: DOCUMENT_MULTI_TOOTH_BRIDGE_EXAMPLE,
  withVisualSettings: DOCUMENT_WITH_VISUAL_SETTINGS_EXAMPLE,
  withExtensions: DOCUMENT_WITH_EXTENSIONS_EXAMPLE,
} as const;
