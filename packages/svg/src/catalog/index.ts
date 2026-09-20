export type {
  CatalogFamilyDescriptor,
  CatalogManifest,
  CatalogManifestEntry,
  OrientationKey,
  PatientSide,
  ResolvedToothSvgResource,
} from "./types.js";

export { getOrientationKey } from "./orientation.js";

export {
  assertManifestCoversCatalog,
  getManifest,
  getManifestEntry,
  listCatalogFamilies,
  listCatalogResourceIds,
  listTeethForCatalogResource,
  resolveToothSvgResource,
} from "./resolve.js";

export { resourceIdToRelativePaths } from "./paths.js";
