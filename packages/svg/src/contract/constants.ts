/** Semantic version of the normative SVG tooth resource contract. */
export const SVG_CONTRACT_VERSION = "1.0.0";

/** Default schematic tooth cell size (matches `@odontogram/svg` schematic renderer). */
export const DEFAULT_TOOTH_VIEWBOX = {
  minX: 0,
  minY: 0,
  width: 44,
  height: 52,
} as const;

/** Inset from tooth box edge to occlusal/incisal center region (schematic). */
export const SCHEMATIC_SURFACE_INSET = 6;

/** Required top-level layer group ids, in document order. */
export const CONTRACT_LAYER_IDS = [
  "layer-anatomy",
  "layer-interaction",
  "layer-focus",
  "layer-marks",
  "layer-labels",
] as const;

export type ContractLayerId = (typeof CONTRACT_LAYER_IDS)[number];

/** SVG namespace for tooth resources. */
export const SVG_NS = "http://www.w3.org/2000/svg";

/** xlink namespace (legacy href checks). */
export const XLINK_NS = "http://www.w3.org/1999/xlink";

/** Data attributes used for surface binding (clinical codes from dentition). */
export const DATA_SURFACE_ATTR = "data-surface";
export const DATA_FACE_ATTR = "data-face";

/** Required anchor point ids within `layer-anatomy` or dedicated anchor group. */
export const REQUIRED_ANCHOR_IDS = ["anchor-center", "anchor-mesial", "anchor-distal"] as const;

/** Elements and attributes that optimizers must preserve (see docs/svg-contract.md). */
export const OPTIMIZATION_PRESERVE_LIST = [
  "id",
  "class",
  "data-surface",
  "data-face",
  "data-role",
  "aria-label",
  "aria-hidden",
  "role",
  "viewBox",
  ...CONTRACT_LAYER_IDS.map((id) => `#${id}`),
] as const;
