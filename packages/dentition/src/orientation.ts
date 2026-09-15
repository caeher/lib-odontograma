import { getQuadrant, getTooth } from "./catalog.js";
import { getArchFromQuadrant, isPatientRightQuadrant, type ToothId } from "./ids.js";
import type { ClinicalSurface } from "./surfaces.js";

/** Schematic five-face projection used by the default SVG renderer. */
export type GraphicProjection = "occlusal";

/** Graphic region within a schematic tooth box. */
export type GraphicFace = "left" | "right" | "top" | "bottom" | "center";

/**
 * Map a clinical surface to a graphic face for the occlusal schematic projection.
 *
 * Patient faces the viewer; patient's right appears on screen left.
 * Mesial/distal flip by quadrant side; buccal/lingual flip by arch.
 */
export function mapSurfaceToFace(
  toothId: ToothId,
  surface: ClinicalSurface,
  projection: GraphicProjection = "occlusal",
): GraphicFace {
  if (projection !== "occlusal") {
    throw new Error(`Unsupported graphic projection: ${projection}`);
  }

  if (surface === "O" || surface === "I") {
    return "center";
  }

  const tooth = getTooth(toothId);
  if (!tooth) {
    throw new Error(`Unknown tooth id: ${toothId}`);
  }

  const quadrant = getQuadrant(toothId) ?? tooth.quadrant;
  const arch = getArchFromQuadrant(quadrant);
  const patientRight = isPatientRightQuadrant(quadrant);

  switch (surface) {
    case "M":
      return patientRight ? "right" : "left";
    case "D":
      return patientRight ? "left" : "right";
    case "B":
      return arch === "maxillary" ? "top" : "bottom";
    case "L":
      return arch === "maxillary" ? "bottom" : "top";
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

/** Inverse lookup: which clinical surface occupies a graphic face for a tooth. */
export function mapFaceToSurface(
  toothId: ToothId,
  face: GraphicFace,
  projection: GraphicProjection = "occlusal",
): ClinicalSurface | undefined {
  const tooth = getTooth(toothId);
  if (!tooth) return undefined;

  for (const surface of tooth.applicableSurfaces) {
    if (mapSurfaceToFace(toothId, surface, projection) === face) {
      return surface;
    }
  }
  return undefined;
}
