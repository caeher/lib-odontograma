import type { LayoutArchId, ToothId } from "./ids.js";

export type Notation = "fdi" | "universal" | "palmer";

/** Universal numbering for permanent dentition (1-32). */
const PERMANENT_UNIVERSAL: Record<string, string> = {
  "18": "1",
  "17": "2",
  "16": "3",
  "15": "4",
  "14": "5",
  "13": "6",
  "12": "7",
  "11": "8",
  "21": "9",
  "22": "10",
  "23": "11",
  "24": "12",
  "25": "13",
  "26": "14",
  "27": "15",
  "28": "16",
  "48": "32",
  "47": "31",
  "46": "30",
  "45": "29",
  "44": "28",
  "43": "27",
  "42": "26",
  "41": "25",
  "31": "24",
  "32": "23",
  "33": "22",
  "34": "21",
  "35": "20",
  "36": "19",
  "37": "18",
  "38": "17",
};

/** Universal numbering for deciduous dentition (A-T). */
const DECIDUOUS_UNIVERSAL: Record<string, string> = {
  "55": "A",
  "54": "B",
  "53": "C",
  "52": "D",
  "51": "E",
  "61": "F",
  "62": "G",
  "63": "H",
  "64": "I",
  "65": "J",
  "85": "T",
  "84": "S",
  "83": "R",
  "82": "Q",
  "81": "P",
  "71": "O",
  "72": "N",
  "73": "M",
  "74": "L",
  "75": "K",
};

/** Palmer notation symbols for permanent teeth. */
const PERMANENT_PALMER: Record<string, string> = {
  "18": "┘8",
  "17": "┘7",
  "16": "┘6",
  "15": "┘5",
  "14": "┘4",
  "13": "┘3",
  "12": "┘2",
  "11": "┘1",
  "21": "1└",
  "22": "2└",
  "23": "3└",
  "24": "4└",
  "25": "5└",
  "26": "6└",
  "27": "7└",
  "28": "8└",
  "48": "8┐",
  "47": "7┐",
  "46": "6┐",
  "45": "5┐",
  "44": "4┐",
  "43": "3┐",
  "42": "2┐",
  "41": "1┐",
  "31": "1┌",
  "32": "2┌",
  "33": "3┌",
  "34": "4┌",
  "35": "5┌",
  "36": "6┌",
  "37": "7┌",
  "38": "8┌",
};

/** Palmer notation symbols for deciduous teeth. */
const DECIDUOUS_PALMER: Record<string, string> = {
  "55": "┘E",
  "54": "┘D",
  "53": "┘C",
  "52": "┘B",
  "51": "┘A",
  "61": "A└",
  "62": "B└",
  "63": "C└",
  "64": "D└",
  "65": "E└",
  "85": "E┐",
  "84": "D┐",
  "83": "C┐",
  "82": "B┐",
  "81": "A┐",
  "71": "A┌",
  "72": "B┌",
  "73": "C┌",
  "74": "D┌",
  "75": "E┌",
};

const UNIVERSAL_TO_FDI: Record<string, string> = {
  ...invertMap(PERMANENT_UNIVERSAL),
  ...invertMap(DECIDUOUS_UNIVERSAL),
};

function invertMap(map: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const [fdi, label] of Object.entries(map)) {
    inverted[label] = fdi;
  }
  return inverted;
}

export {
  getDeciduousTeeth,
  getMixedTeeth,
  getPermanentTeeth,
  getPrimaryTeeth,
  getTeethForView,
  isDeciduousTooth,
  isPermanentTooth,
  isPrimaryTooth,
} from "./catalog.js";

export function getQuadrant(fdi: ToothId): number {
  return parseInt(fdi.charAt(0), 10);
}

/** Returns layout arch alias used by schematic renderers. */
export function getLayoutArch(fdi: ToothId): LayoutArchId {
  const q = getQuadrant(fdi);
  return q <= 2 || q === 5 || q === 6 ? "upper" : "lower";
}

/** @deprecated Use {@link getLayoutArch} or catalog {@link getArch}. */
export function getArch(fdi: ToothId): LayoutArchId {
  return getLayoutArch(fdi);
}

export function toNotation(fdi: string, notation: Notation): string {
  if (notation === "fdi") return fdi;
  if (notation === "universal") {
    return PERMANENT_UNIVERSAL[fdi] ?? DECIDUOUS_UNIVERSAL[fdi] ?? fdi;
  }
  return PERMANENT_PALMER[fdi] ?? DECIDUOUS_PALMER[fdi] ?? fdi;
}

export function fromNotation(label: string, notation: Notation): string | null {
  if (notation === "fdi") return label;
  if (notation === "universal") return UNIVERSAL_TO_FDI[label] ?? null;
  const allPalmer = { ...PERMANENT_PALMER, ...DECIDUOUS_PALMER };
  for (const [fdi, palmer] of Object.entries(allPalmer)) {
    if (palmer === label) return fdi;
  }
  return null;
}

export { toLayoutArch } from "./ids.js";
