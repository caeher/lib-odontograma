import { getTooth, type ToothId } from "@odontogram/dentition";
import { getCatalogManifestData } from "./manifest-data.js";
import { getOrientationKey } from "./orientation.js";
import { resourceIdToRelativePaths } from "./paths.js";
import type {
  CatalogFamilyDescriptor,
  CatalogManifest,
  CatalogManifestEntry,
  OrientationKey,
  ResolvedToothSvgResource,
} from "./types.js";

export function getManifest(): CatalogManifest {
  return getCatalogManifestData();
}

export function getManifestEntry(toothId: ToothId): CatalogManifestEntry | undefined {
  return getCatalogManifestData().teeth[toothId];
}

export function resolveToothSvgResource(toothId: ToothId): ResolvedToothSvgResource {
  const entry = getManifestEntry(toothId);
  if (!entry) {
    throw new Error(`No catalog manifest entry for tooth ${toothId}`);
  }
  const paths = resourceIdToRelativePaths(entry.resourceId);
  return {
    toothId,
    ...entry,
    ...paths,
  };
}

export function listCatalogResourceIds(): string[] {
  const seen = new Set<string>();
  for (const entry of Object.values(getCatalogManifestData().teeth)) {
    seen.add(entry.resourceId);
  }
  return [...seen].sort();
}

export function listCatalogFamilies(): readonly CatalogFamilyDescriptor[] {
  return getCatalogManifestData().families;
}

export function listTeethForCatalogResource(resourceId: string): ToothId[] {
  const teeth: ToothId[] = [];
  for (const [id, entry] of Object.entries(getCatalogManifestData().teeth)) {
    if (entry.resourceId === resourceId) {
      teeth.push(id);
    }
  }
  return teeth.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function assertManifestCoversCatalog(toothIds: readonly ToothId[]): void {
  const manifest = getCatalogManifestData();
  for (const id of toothIds) {
    if (!manifest.teeth[id]) {
      throw new Error(`Manifest missing tooth ${id}`);
    }
    const record = getTooth(id);
    if (!record) {
      throw new Error(`Dentition catalog missing tooth ${id}`);
    }
    const entry = manifest.teeth[id];
    if (entry.toothClass !== record.toothClass) {
      throw new Error(`Manifest toothClass mismatch for ${id}`);
    }
    const expectedOrientation = getOrientationKey(id);
    if (entry.orientationKey !== expectedOrientation) {
      throw new Error(
        `Manifest orientationKey mismatch for ${id}: ${entry.orientationKey} vs ${expectedOrientation}`,
      );
    }
  }
}

export type { OrientationKey };
