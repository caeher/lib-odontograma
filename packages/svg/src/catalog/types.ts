import type { ArchId, ToothClass, ToothId } from "@odontogram/dentition";

export type PatientSide = "patient-right" | "patient-left";

/** Catalog orientation family key (arch + patient side). */
export type OrientationKey = `${PatientSide}.${ArchId}`;

export interface CatalogManifestEntry {
  resourceId: string;
  referenceToothId: ToothId;
  toothClass: ToothClass;
  orientationKey: OrientationKey;
}

export interface CatalogManifest {
  contractVersion: string;
  catalogVersion: string;
  projection: "occlusal";
  familyCount: number;
  families: readonly CatalogFamilyDescriptor[];
  teeth: Record<ToothId, CatalogManifestEntry>;
}

export interface CatalogFamilyDescriptor {
  resourceId: string;
  toothClass: ToothClass;
  orientationKey: OrientationKey;
  referenceToothId: ToothId;
  /** Path relative to `packages/svg/resources/` */
  relativeSvgPath: string;
  relativeMetadataPath: string;
}

export interface ResolvedToothSvgResource extends CatalogManifestEntry {
  toothId: ToothId;
  relativeSvgPath: string;
  relativeMetadataPath: string;
}
