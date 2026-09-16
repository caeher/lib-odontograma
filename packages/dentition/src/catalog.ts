import {
  getArchFromQuadrant,
  getDentitionFromQuadrant,
  type ArchId,
  type DentitionId,
  type PositionId,
  type QuadrantId,
  type ToothClass,
  type ToothId,
} from "./ids.js";
import { getApplicableSurfacesForClass, type ClinicalSurface } from "./surfaces.js";

/** Canonical catalog entry for a tooth (identity, not chart state). */
export interface ToothRecord {
  id: ToothId;
  dentition: DentitionId;
  arch: ArchId;
  quadrant: QuadrantId;
  position: PositionId;
  toothClass: ToothClass;
  applicableSurfaces: readonly ClinicalSurface[];
  successorId?: ToothId;
  predecessorId?: ToothId;
}

/** Primary → permanent successor map (ISO 3950). */
const SUCCESSOR_MAP: Record<string, string> = {
  "51": "11",
  "52": "12",
  "53": "13",
  "54": "14",
  "55": "15",
  "61": "21",
  "62": "22",
  "63": "23",
  "64": "24",
  "65": "25",
  "71": "31",
  "72": "32",
  "73": "33",
  "74": "34",
  "75": "35",
  "81": "41",
  "82": "42",
  "83": "43",
  "84": "44",
  "85": "45",
};

const PERMANENT_QUADRANT_POSITIONS: Record<1 | 2 | 3 | 4, readonly PositionId[]> = {
  1: [8, 7, 6, 5, 4, 3, 2, 1],
  2: [1, 2, 3, 4, 5, 6, 7, 8],
  3: [1, 2, 3, 4, 5, 6, 7, 8],
  4: [8, 7, 6, 5, 4, 3, 2, 1],
};

const PRIMARY_QUADRANT_POSITIONS: Record<5 | 6 | 7 | 8, readonly PositionId[]> = {
  5: [5, 4, 3, 2, 1],
  6: [1, 2, 3, 4, 5],
  7: [1, 2, 3, 4, 5],
  8: [5, 4, 3, 2, 1],
};

function getToothClass(dentition: DentitionId, position: PositionId): ToothClass {
  if (dentition === "primary") {
    if (position <= 2) return "incisor";
    if (position === 3) return "canine";
    return "molar";
  }
  if (position <= 2) return "incisor";
  if (position === 3) return "canine";
  if (position <= 5) return "premolar";
  return "molar";
}

function buildToothRecord(quadrant: QuadrantId, position: PositionId): ToothRecord {
  const id = `${quadrant}${position}`;
  const dentition = getDentitionFromQuadrant(quadrant);
  const arch = getArchFromQuadrant(quadrant);
  const toothClass = getToothClass(dentition, position);
  const applicableSurfaces = getApplicableSurfacesForClass(toothClass);

  const record: ToothRecord = {
    id,
    dentition,
    arch,
    quadrant,
    position,
    toothClass,
    applicableSurfaces,
  };

  if (dentition === "primary") {
    const successorId = SUCCESSOR_MAP[id];
    if (successorId) {
      record.successorId = successorId;
    }
  } else {
    const predecessorEntry = Object.entries(SUCCESSOR_MAP).find(([, perm]) => perm === id);
    if (predecessorEntry) {
      record.predecessorId = predecessorEntry[0];
    }
  }

  return record;
}

function buildCatalog(): Map<ToothId, ToothRecord> {
  const catalog = new Map<ToothId, ToothRecord>();

  for (const quadrant of [1, 2, 3, 4] as const) {
    for (const position of PERMANENT_QUADRANT_POSITIONS[quadrant]) {
      const record = buildToothRecord(quadrant, position);
      catalog.set(record.id, record);
    }
  }

  for (const quadrant of [5, 6, 7, 8] as const) {
    for (const position of PRIMARY_QUADRANT_POSITIONS[quadrant]) {
      const record = buildToothRecord(quadrant, position);
      catalog.set(record.id, record);
    }
  }

  return catalog;
}

const CATALOG = buildCatalog();

export function getTooth(id: ToothId): ToothRecord | undefined {
  return CATALOG.get(id);
}

export function getPosition(id: ToothId): PositionId | undefined {
  return CATALOG.get(id)?.position;
}

export function getQuadrant(id: ToothId): QuadrantId | undefined {
  return CATALOG.get(id)?.quadrant;
}

export function getArch(id: ToothId): ArchId | undefined {
  return CATALOG.get(id)?.arch;
}

export function getDentition(id: ToothId): DentitionId | undefined {
  return CATALOG.get(id)?.dentition;
}

export function getApplicableSurfaces(id: ToothId): readonly ClinicalSurface[] {
  return CATALOG.get(id)?.applicableSurfaces ?? [];
}

export function getSuccessor(id: ToothId): ToothId | undefined {
  return CATALOG.get(id)?.successorId;
}

export function getPredecessor(id: ToothId): ToothId | undefined {
  return CATALOG.get(id)?.predecessorId;
}

export interface ListTeethOptions {
  dentition?: DentitionId;
  arch?: ArchId;
  quadrant?: QuadrantId;
}

export function listTeeth(options: ListTeethOptions = {}): readonly ToothRecord[] {
  let records = [...CATALOG.values()];

  if (options.dentition) {
    records = records.filter((r) => r.dentition === options.dentition);
  }
  if (options.arch) {
    records = records.filter((r) => r.arch === options.arch);
  }
  if (options.quadrant !== undefined) {
    records = records.filter((r) => r.quadrant === options.quadrant);
  }

  return records;
}

export function getPermanentTeeth(): readonly ToothId[] {
  return listTeeth({ dentition: "permanent" }).map((r) => r.id);
}

export function getPrimaryTeeth(): readonly ToothId[] {
  return listTeeth({ dentition: "primary" }).map((r) => r.id);
}

/** Alias for primary dentition (deciduous view name). */
export function getDeciduousTeeth(): readonly ToothId[] {
  return getPrimaryTeeth();
}

export function getMixedTeeth(): readonly ToothId[] {
  return [...getPermanentTeeth(), ...getPrimaryTeeth()];
}

export type DentitionView = "permanent" | "deciduous" | "primary" | "mixed";

export function getTeethForView(view: DentitionView): readonly ToothId[] {
  switch (view) {
    case "permanent":
      return getPermanentTeeth();
    case "deciduous":
    case "primary":
      return getPrimaryTeeth();
    case "mixed":
      return getMixedTeeth();
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export function isPermanentTooth(id: ToothId): boolean {
  return CATALOG.get(id)?.dentition === "permanent";
}

export function isPrimaryTooth(id: ToothId): boolean {
  return CATALOG.get(id)?.dentition === "primary";
}

/** Alias for primary dentition. */
export function isDeciduousTooth(id: ToothId): boolean {
  return isPrimaryTooth(id);
}

/** Check if a string is a recognized canonical ToothId in the catalog. */
export function isValidToothId(id: string): id is ToothId {
  return CATALOG.has(id);
}

/** Check if a clinical surface is applicable to a specific tooth. */
export function isSurfaceApplicableToTooth(
  toothId: ToothId,
  surface: ClinicalSurface | string,
): boolean {
  const surfaces = getApplicableSurfaces(toothId);
  return (surfaces as readonly string[]).includes(surface);
}

/** Export full catalog for fixtures and tests. */
export function getAllToothRecords(): readonly ToothRecord[] {
  return [...CATALOG.values()];
}
