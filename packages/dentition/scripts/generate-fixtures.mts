import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMixedTeeth, getTooth, listTeeth } from "../src/catalog.js";
import { mapSurfaceToFace } from "../src/orientation.js";
import { TOOTH_NOTATION_TABLE } from "../src/notation.js";
import type { ClinicalSurface } from "../src/surfaces.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(root, "fixtures");
mkdirSync(fixturesDir, { recursive: true });

const permanent = listTeeth({ dentition: "permanent" }).map((r) => ({
  id: r.id,
  dentition: r.dentition,
  arch: r.arch,
  quadrant: r.quadrant,
  position: r.position,
  toothClass: r.toothClass,
  applicableSurfaces: r.applicableSurfaces,
  ...(r.predecessorId ? { predecessorId: r.predecessorId } : {}),
}));

const primary = listTeeth({ dentition: "primary" }).map((r) => ({
  id: r.id,
  dentition: r.dentition,
  arch: r.arch,
  quadrant: r.quadrant,
  position: r.position,
  toothClass: r.toothClass,
  applicableSurfaces: r.applicableSurfaces,
  ...(r.successorId ? { successorId: r.successorId } : {}),
}));

const notationRecords = TOOTH_NOTATION_TABLE.map((rec) => {
  const tooth = getTooth(rec.fdi);
  return {
    fdi: rec.fdi,
    universal: rec.universal,
    palmerSymbol: rec.palmerSymbol,
    palmerAccessible: rec.palmerAccessible,
    dentition: tooth?.dentition,
    arch: tooth?.arch,
    quadrant: tooth?.quadrant,
    position: tooth?.position,
  };
});

const orientationSamples = (
  [
    { tooth: "16", surface: "M" },
    { tooth: "16", surface: "D" },
    { tooth: "16", surface: "B" },
    { tooth: "16", surface: "L" },
    { tooth: "26", surface: "M" },
    { tooth: "26", surface: "D" },
    { tooth: "36", surface: "B" },
    { tooth: "36", surface: "L" },
    { tooth: "11", surface: "I" },
    { tooth: "16", surface: "O" },
  ] as const
).map((s) => ({ ...s, face: mapSurfaceToFace(s.tooth, s.surface as ClinicalSurface) }));

const mixedCoexistence = {
  description:
    "Primary and permanent successors coexist as independent catalog ids in mixed dentition",
  successorPairs: listTeeth({ dentition: "primary" })
    .map((r) => ({ primary: r.id, permanent: r.successorId }))
    .filter((p): p is { primary: string; permanent: string } => Boolean(p.permanent)),
  mixedCatalogIncludesBoth: [
    {
      primary: "55",
      permanent: "15",
      bothInMixed: getMixedTeeth().includes("55") && getMixedTeeth().includes("15"),
    },
    {
      primary: "85",
      permanent: "45",
      bothInMixed: getMixedTeeth().includes("85") && getMixedTeeth().includes("45"),
    },
  ],
};

writeFileSync(join(fixturesDir, "permanent.json"), JSON.stringify(permanent, null, 2));
writeFileSync(join(fixturesDir, "primary.json"), JSON.stringify(primary, null, 2));
writeFileSync(join(fixturesDir, "notations.json"), JSON.stringify(notationRecords, null, 2));
writeFileSync(
  join(fixturesDir, "orientation.json"),
  JSON.stringify({ samples: orientationSamples }, null, 2),
);
writeFileSync(
  join(fixturesDir, "mixed-coexistence.json"),
  JSON.stringify(mixedCoexistence, null, 2),
);

console.log(
  `Wrote ${permanent.length} permanent, ${primary.length} primary, and ${notationRecords.length} notation fixture records`,
);
