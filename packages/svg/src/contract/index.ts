export {
  SVG_CONTRACT_VERSION,
  DEFAULT_TOOTH_VIEWBOX,
  SCHEMATIC_SURFACE_INSET,
  CONTRACT_LAYER_IDS,
  REQUIRED_ANCHOR_IDS,
  OPTIMIZATION_PRESERVE_LIST,
  DATA_SURFACE_ATTR,
  DATA_FACE_ATTR,
  SVG_NS,
  XLINK_NS,
} from "./constants.js";
export type { ContractLayerId } from "./constants.js";

export type {
  ToothSvgMetadata,
  ToothSvgValidationOptions,
  ToothSvgRuleId,
  ToothSvgValidationIssue,
  ToothSvgValidationResult,
  SurfaceRegionBinding,
} from "./types.js";

export {
  surfaceElementId,
  faceElementId,
  expectedSurfacesForToothClass,
  validateSurfaceSetForClass,
  verifySurfaceFaceBinding,
  extractSurfaceBindings,
} from "./surface-binding.js";

export {
  prefixElementIds,
  parseSvgMarkup,
  serializeSvgElement,
  type PrefixElementIdsOptions,
} from "./instance-ids.js";

export {
  parseToothSvgMetadata,
  parseToothSvgMetadataJson,
  isMetadataVersionCompatible,
  ToothSvgMetadataError,
} from "./parse-metadata.js";

export { validateToothSvg } from "./validate-tooth-svg.js";
