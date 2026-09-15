/** Clinical surface codes (Black's designations plus incisal). */
export const CLINICAL_SURFACE_CODES = ["M", "O", "I", "D", "B", "L"] as const;

export type ClinicalSurface = (typeof CLINICAL_SURFACE_CODES)[number];

/** Standard surface codes used in marks and selection (includes incisal). */
export const SURFACE_CODES = ["M", "O", "I", "D", "B", "L"] as const;

export type SurfaceCode = (typeof SURFACE_CODES)[number];

/** Human-readable labels for each clinical surface code. */
export const SURFACE_LABELS: Record<ClinicalSurface, string> = {
  M: "Mesial",
  O: "Occlusal",
  I: "Incisal",
  D: "Distal",
  B: "Buccal / Vestibular",
  L: "Lingual / Palatal",
};

/** Applicable surfaces for anterior teeth (incisors and canines). */
export const ANTERIOR_SURFACES: readonly ClinicalSurface[] = ["M", "I", "D", "B", "L"];

/** Applicable surfaces for posterior teeth (premolars and molars). */
export const POSTERIOR_SURFACES: readonly ClinicalSurface[] = ["M", "O", "D", "B", "L"];

export function isValidSurface(code: string): code is ClinicalSurface {
  return (CLINICAL_SURFACE_CODES as readonly string[]).includes(code);
}

export function getApplicableSurfacesForClass(
  toothClass: "incisor" | "canine" | "premolar" | "molar",
): readonly ClinicalSurface[] {
  return toothClass === "premolar" || toothClass === "molar"
    ? POSTERIOR_SURFACES
    : ANTERIOR_SURFACES;
}
