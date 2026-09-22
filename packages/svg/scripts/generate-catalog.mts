/**
 * Generates occlusal schematic catalog SVG families and manifest.json from the #8 template contract.
 * Run: node --experimental-strip-types packages/svg/scripts/generate-catalog.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllToothRecords,
  mapSurfaceToFace,
  getApplicableSurfacesForClass,
  isPatientRightQuadrant,
  getAnatomicalArch,
  type ArchId,
  type ToothClass,
  type ToothId,
} from "../../dentition/dist/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const catalogRoot = path.resolve(scriptDir, "../resources/catalog");
const contractVersion = "1.0.0";

type PatientSide = "patient-right" | "patient-left";
type OrientationKey = `${PatientSide}.${ArchId}`;

const FACE_PATHS: Record<string, string> = {
  right: "M 0 6 L 6 6 L 6 46 L 0 46 Z",
  left: "M 38 6 L 44 6 L 44 46 L 38 46 Z",
  top: "M 6 0 L 38 0 L 38 6 L 6 6 Z",
  bottom: "M 6 46 L 38 46 L 38 52 L 6 52 Z",
  center: "M 6 6 L 38 6 L 38 46 L 6 46 Z",
};

const SURFACE_LABELS: Record<string, string> = {
  M: "Mesial",
  D: "Distal",
  B: "Buccal",
  L: "Lingual",
  O: "Occlusal",
  I: "Incisal",
};

const TOOTH_CLASSES: ToothClass[] = ["incisor", "canine", "premolar", "molar"];

function orientationKey(patientRight: boolean, arch: ArchId): OrientationKey {
  const side: PatientSide = patientRight ? "patient-right" : "patient-left";
  return `${side}.${arch}`;
}

/** Canonical permanent FDI id per class and orientation (mesial toward midline verified). */
function referenceToothIdForFamily(toothClass: ToothClass, key: OrientationKey): ToothId {
  const [side, arch] = key.split(".") as [PatientSide, ArchId];
  const patientRight = side === "patient-right";
  if (arch === "maxillary") {
    if (patientRight) {
      if (toothClass === "incisor") return "11";
      if (toothClass === "canine") return "13";
      if (toothClass === "premolar") return "14";
      return "16";
    }
    if (toothClass === "incisor") return "21";
    if (toothClass === "canine") return "23";
    if (toothClass === "premolar") return "24";
    return "26";
  }
  if (patientRight) {
    if (toothClass === "incisor") return "41";
    if (toothClass === "canine") return "43";
    if (toothClass === "premolar") return "44";
    return "46";
  }
  if (toothClass === "incisor") return "31";
  if (toothClass === "canine") return "33";
  if (toothClass === "premolar") return "34";
  return "36";
}

function fileStem(key: OrientationKey): string {
  const [side, arch] = key.split(".") as [PatientSide, ArchId];
  return `${side}.${arch}.occlusal`;
}

function resourceId(toothClass: ToothClass, key: OrientationKey): string {
  return `${toothClass}.${fileStem(key)}`;
}

function buildSvg(toothClass: ToothClass, referenceToothId: ToothId, title: string): string {
  const surfaces = getApplicableSurfacesForClass(toothClass);
  const surfaceRegions = surfaces
    .map((surface) => {
      const face = mapSurfaceToFace(referenceToothId, surface);
      const label = SURFACE_LABELS[surface] ?? surface;
      const fill = face === "center" ? "#e0e0e0" : "#e8e8e8";
      return `    <g id="surface-${surface}" data-surface="${surface}" data-face="${face}" role="button" tabindex="-1" aria-label="${label}">
      <path d="${FACE_PATHS[face]}" fill="${fill}" stroke="#bbb" stroke-width="0.5"/>
    </g>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 52" role="img" aria-label="${title}">
  <title>${title}</title>
  <desc>Contract v1 occlusal schematic catalog resource (${toothClass}). Reference orientation tooth ${referenceToothId}.</desc>
  <g id="layer-anatomy" data-role="anatomy">
    <rect id="tooth-outline" x="0" y="0" width="44" height="52" rx="4" fill="#f5f5f5" stroke="#999" stroke-width="1"/>
    <circle id="anchor-center" cx="22" cy="26" r="1.5" fill="#666" opacity="0.35"/>
    <circle id="anchor-mesial" cx="8" cy="26" r="1.5" fill="#666" opacity="0.35"/>
    <circle id="anchor-distal" cx="36" cy="26" r="1.5" fill="#666" opacity="0.35"/>
  </g>
  <g id="layer-interaction" data-role="interaction">
${surfaceRegions.replace(/fill="#e8e8e8"/g, (match, offset, whole) => {
  const line = whole.slice(Math.max(0, offset - 80), offset);
  return line.includes("surface-O") || line.includes("surface-I") ? `fill="${centerFill}"` : match;
})}
  </g>
  <g id="layer-focus" data-role="focus" aria-hidden="true"/>
  <g id="layer-marks" data-role="marks" aria-hidden="true"/>
  <g id="layer-labels" data-role="labels">
    <text id="label-notation" x="22" y="50" text-anchor="middle" font-size="8" fill="#333" aria-hidden="true">${referenceToothId}</text>
  </g>
</svg>
`;
  return svg;
}

function buildMetadata(
  toothClass: ToothClass,
  key: OrientationKey,
  referenceToothId: ToothId,
): Record<string, unknown> {
  const id = resourceId(toothClass, key);
  const [side, arch] = key.split(".") as [PatientSide, ArchId];
  const title = `${toothClass} · ${side.replace("-", " ")} · ${arch} (occlusal)`;
  return {
    contractVersion,
    resourceId: id,
    title,
    toothClass,
    projection: "occlusal",
    orientationKey: key,
    referenceToothId,
    viewBox: { minX: 0, minY: 0, width: 44, height: 52 },
    anchors: {
      "anchor-center": { x: 22, y: 26 },
      "anchor-mesial": { x: 8, y: 26 },
      "anchor-distal": { x: 36, y: 26 },
    },
    attribution: {
      author: "lib-odontograma contributors",
      license: "Apache-2.0",
      notice:
        "Schematic occlusal catalog geometry derived from tooth-occlusal-schematic.template (#8). Surface faces aligned to mapSurfaceToFace for referenceToothId.",
    },
    editor: {
      tool: "generate-catalog.mts",
      template: "tooth-occlusal-schematic.template.svg",
    },
  };
}

function resolveCatalogKeyForTooth(toothId: ToothId): {
  toothClass: ToothClass;
  orientationKey: OrientationKey;
  resourceId: string;
  referenceToothId: ToothId;
} {
  const record = getAllToothRecords().find((r) => r.id === toothId);
  if (!record) {
    throw new Error(`Unknown tooth ${toothId}`);
  }
  const patientRight = isPatientRightQuadrant(record.quadrant);
  const arch = getAnatomicalArch(toothId) ?? record.arch;
  const key = orientationKey(patientRight, arch);
  return {
    toothClass: record.toothClass,
    orientationKey: key,
    resourceId: resourceId(record.toothClass, key),
    referenceToothId: toothId,
  };
}

const orientationKeys: OrientationKey[] = [
  "patient-right.maxillary",
  "patient-left.maxillary",
  "patient-right.mandibular",
  "patient-left.mandibular",
];

for (const toothClass of TOOTH_CLASSES) {
  const classDir = path.join(catalogRoot, toothClass);
  fs.mkdirSync(classDir, { recursive: true });
  for (const key of orientationKeys) {
    const ref = referenceToothIdForFamily(toothClass, key);
    const stem = fileStem(key);
    const meta = buildMetadata(toothClass, key, ref);
    const title = meta.title as string;
    const svg = buildSvg(toothClass, ref, title);
    fs.writeFileSync(path.join(classDir, `${stem}.svg`), svg, "utf8");
    fs.writeFileSync(
      path.join(classDir, `${stem}.json`),
      `${JSON.stringify(meta, null, 2)}\n`,
      "utf8",
    );
  }
}

const manifestTeeth: Record<
  string,
  {
    resourceId: string;
    referenceToothId: string;
    toothClass: ToothClass;
    orientationKey: OrientationKey;
  }
> = {};

for (const record of getAllToothRecords()) {
  const entry = resolveCatalogKeyForTooth(record.id);
  manifestTeeth[record.id] = {
    resourceId: entry.resourceId,
    referenceToothId: entry.referenceToothId,
    toothClass: entry.toothClass,
    orientationKey: entry.orientationKey,
  };
}

const manifestFamilies: Array<{
  resourceId: string;
  toothClass: ToothClass;
  orientationKey: OrientationKey;
  referenceToothId: ToothId;
  relativeSvgPath: string;
  relativeMetadataPath: string;
}> = [];

for (const toothClass of TOOTH_CLASSES) {
  for (const key of orientationKeys) {
    const id = resourceId(toothClass, key);
    const stem = fileStem(key);
    manifestFamilies.push({
      resourceId: id,
      toothClass,
      orientationKey: key,
      referenceToothId: referenceToothIdForFamily(toothClass, key),
      relativeSvgPath: `catalog/${toothClass}/${stem}.svg`,
      relativeMetadataPath: `catalog/${toothClass}/${stem}.json`,
    });
  }
}

const manifest = {
  contractVersion,
  catalogVersion: "1.0.0",
  projection: "occlusal",
  familyCount: manifestFamilies.length,
  families: manifestFamilies,
  teeth: manifestTeeth,
};

fs.writeFileSync(
  path.join(catalogRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(`Wrote catalog under ${catalogRoot} (${Object.keys(manifestTeeth).length} teeth).`);
