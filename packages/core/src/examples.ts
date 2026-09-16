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

/** Standard dictionary of all Stage 02 serialization examples. */
export const SERIALIZATION_EXAMPLES = {
  multiSurfaceRestorations: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
  wholeToothMarks: WHOLE_TOOTH_MARKS_EXAMPLE,
  multiToothAnnotations: MULTI_TOOTH_ANNOTATIONS_EXAMPLE,
  multiMarkCoexistence: MULTI_MARK_COEXISTENCE_EXAMPLE,
  unknownMarkPreservation: UNKNOWN_MARK_PRESERVATION_EXAMPLE,
} as const;
