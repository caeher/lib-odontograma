import type { CatalogManifest } from "./types.js";

/** Shipped catalog manifest (52 FDI teeth → catalog resource). */
import manifest from "../../resources/catalog/manifest.json" with { type: "json" };

const CATALOG_MANIFEST = manifest as unknown as CatalogManifest;

export function getCatalogManifestData(): CatalogManifest {
  return CATALOG_MANIFEST;
}
