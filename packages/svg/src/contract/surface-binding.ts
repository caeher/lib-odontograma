import {
  getApplicableSurfacesForClass,
  mapSurfaceToFace,
  type ClinicalSurface,
  type GraphicFace,
  type ToothClass,
} from "@odontogram/dentition";
import { DATA_FACE_ATTR, DATA_SURFACE_ATTR } from "./constants.js";
import type { SurfaceRegionBinding } from "./types.js";

/** Canonical element id for a clinical surface within a template (before instance prefixing). */
export function surfaceElementId(surface: ClinicalSurface): string {
  return `surface-${surface}`;
}

/** Canonical element id for a graphic face helper region. */
export function faceElementId(face: GraphicFace): string {
  return `face-${face}`;
}

/**
 * Expected clinical surfaces for a tooth class per `@odontogram/dentition`.
 * Incisors/canines use incisal (`I`) in the center face; posteriors use occlusal (`O`).
 */
export function expectedSurfacesForToothClass(toothClass: ToothClass): readonly ClinicalSurface[] {
  return getApplicableSurfacesForClass(toothClass);
}

/**
 * Validate that interaction-layer elements declare clinical surfaces matching tooth class.
 * Uses dentition as source of truth (not hard-coded surface lists in svg).
 */
export function validateSurfaceSetForClass(
  declaredSurfaces: readonly ClinicalSurface[],
  toothClass: ToothClass,
): { ok: true } | { ok: false; missing: ClinicalSurface[]; extra: ClinicalSurface[] } {
  const expected = new Set(expectedSurfacesForToothClass(toothClass));
  const declared = new Set(declaredSurfaces);
  const missing = [...expected].filter((s) => !declared.has(s));
  const extra = [...declared].filter((s) => !expected.has(s));
  if (missing.length === 0 && extra.length === 0) {
    return { ok: true };
  }
  return { ok: false, missing, extra };
}

/**
 * For a catalog tooth id, verify data-face aligns with mapSurfaceToFace (patient perspective).
 * Template resources use a reference tooth id per quadrant family when checking orientation.
 */
export function verifySurfaceFaceBinding(
  referenceToothId: string,
  surface: ClinicalSurface,
  face: GraphicFace,
): boolean {
  return mapSurfaceToFace(referenceToothId, surface) === face;
}

/** Read surface bindings from parsed SVG interaction layer elements. */
export function extractSurfaceBindings(root: ParentNode): SurfaceRegionBinding[] {
  const nodes = root.querySelectorAll(
    `#layer-interaction [${DATA_SURFACE_ATTR}]`,
  ) as NodeListOf<Element>;
  const bindings: SurfaceRegionBinding[] = [];
  for (const el of nodes) {
    const surface = el.getAttribute(DATA_SURFACE_ATTR);
    const face = el.getAttribute(DATA_FACE_ATTR);
    const id = el.getAttribute("id");
    if (!surface || !face || !id) continue;
    if (!isClinicalSurface(surface) || !isGraphicFace(face)) continue;
    bindings.push({ surface, face: face as GraphicFace, elementId: id });
  }
  return bindings;
}

function isClinicalSurface(value: string): value is ClinicalSurface {
  return ["M", "O", "I", "D", "B", "L"].includes(value);
}

function isGraphicFace(value: string): value is GraphicFace {
  return ["left", "right", "top", "bottom", "center"].includes(value);
}
