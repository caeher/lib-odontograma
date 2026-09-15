/** Canonical tooth identifier (FDI two-digit string, e.g. "16"). */
export type ToothId = string;

/** Dentition classification. */
export type DentitionId = "permanent" | "primary";

/** Anatomical arch identifier. */
export type ArchId = "maxillary" | "mandibular";

/** Layout alias used by schematic renderers (maps to {@link ArchId}). */
export type LayoutArchId = "upper" | "lower";

/** FDI quadrant (1–4 permanent, 5–8 primary). */
export type QuadrantId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Tooth position within a quadrant (1–8 permanent, 1–5 primary). */
export type PositionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Tooth morphological class. */
export type ToothClass = "incisor" | "canine" | "premolar" | "molar";

const PERMANENT_QUADRANTS: readonly QuadrantId[] = [1, 2, 3, 4];
const PRIMARY_QUADRANTS: readonly QuadrantId[] = [5, 6, 7, 8];

export function isPermanentQuadrant(quadrant: number): quadrant is QuadrantId {
  return (PERMANENT_QUADRANTS as readonly number[]).includes(quadrant);
}

export function isPrimaryQuadrant(quadrant: number): quadrant is QuadrantId {
  return (PRIMARY_QUADRANTS as readonly number[]).includes(quadrant);
}

export function parseToothId(id: string): {
  quadrant: QuadrantId;
  position: PositionId;
} | null {
  if (!/^\d{2}$/.test(id)) return null;
  const quadrant = parseInt(id.charAt(0), 10);
  const position = parseInt(id.charAt(1), 10);
  if (!isPermanentQuadrant(quadrant) && !isPrimaryQuadrant(quadrant)) return null;
  if (isPermanentQuadrant(quadrant) && (position < 1 || position > 8)) return null;
  if (isPrimaryQuadrant(quadrant) && (position < 1 || position > 5)) return null;
  return { quadrant: quadrant as QuadrantId, position: position as PositionId };
}

export function getDentitionFromQuadrant(quadrant: QuadrantId): DentitionId {
  return isPermanentQuadrant(quadrant) ? "permanent" : "primary";
}

export function getArchFromQuadrant(quadrant: QuadrantId): ArchId {
  return quadrant <= 2 || quadrant === 5 || quadrant === 6 ? "maxillary" : "mandibular";
}

export function toLayoutArch(arch: ArchId): LayoutArchId {
  return arch === "maxillary" ? "upper" : "lower";
}

export function fromLayoutArch(layout: LayoutArchId): ArchId {
  return layout === "upper" ? "maxillary" : "mandibular";
}

/** Patient-right quadrants (screen-left side when facing the patient). */
export function isPatientRightQuadrant(quadrant: QuadrantId): boolean {
  return quadrant === 1 || quadrant === 4 || quadrant === 5 || quadrant === 8;
}
