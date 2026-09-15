/** Standard surface codes used across the library. */
export const SURFACE_CODES = ["M", "O", "D", "B", "L"] as const;

export type SurfaceCode = (typeof SURFACE_CODES)[number];

/** Human-readable labels for each surface code. */
export const SURFACE_LABELS: Record<SurfaceCode, string> = {
  M: "Mesial",
  O: "Occlusal / Incisal",
  D: "Distal",
  B: "Buccal / Vestibular",
  L: "Lingual / Palatal",
};

export function isValidSurface(code: string): code is SurfaceCode {
  return (SURFACE_CODES as readonly string[]).includes(code);
}
