import type { LayoutArchId, ToothId } from "./ids.js";
import { parseToothId } from "./ids.js";

export type Notation = "fdi" | "universal" | "palmer" | (string & {});

/** Adapter interface for tooth numbering presentation and parsing. */
export interface NotationAdapter {
  /** Unique notation identifier. */
  readonly id: string;
  /** Human-readable notation name. */
  readonly name: string;
  /** Clinical / standard description. */
  readonly description: string;
  /** Format a canonical FDI tooth identifier for display in this notation. */
  format(toothId: ToothId): string;
  /** Format an accessible / screen-reader-friendly text representation. */
  formatAccessible(toothId: ToothId): string;
  /** Parse an input string in this notation to a canonical FDI ToothId, or null if invalid/out-of-catalog. */
  parse(label: string): ToothId | null;
  /** Returns true if the given input is a valid identifier in this notation. */
  isValid(label: string): boolean;
}

export interface ToothNotationRecord {
  fdi: ToothId;
  universal: string;
  palmerSymbol: string;
  palmerAccessible: string;
}

/** Complete 52-tooth mapping table for permanent (32) and primary (20) dentitions. */
export const TOOTH_NOTATION_TABLE: readonly ToothNotationRecord[] = [
  // Permanent Upper Right (Quadrant 1)
  { fdi: "18", universal: "1", palmerSymbol: "8┘", palmerAccessible: "UR8" },
  { fdi: "17", universal: "2", palmerSymbol: "7┘", palmerAccessible: "UR7" },
  { fdi: "16", universal: "3", palmerSymbol: "6┘", palmerAccessible: "UR6" },
  { fdi: "15", universal: "4", palmerSymbol: "5┘", palmerAccessible: "UR5" },
  { fdi: "14", universal: "5", palmerSymbol: "4┘", palmerAccessible: "UR4" },
  { fdi: "13", universal: "6", palmerSymbol: "3┘", palmerAccessible: "UR3" },
  { fdi: "12", universal: "7", palmerSymbol: "2┘", palmerAccessible: "UR2" },
  { fdi: "11", universal: "8", palmerSymbol: "1┘", palmerAccessible: "UR1" },

  // Permanent Upper Left (Quadrant 2)
  { fdi: "21", universal: "9", palmerSymbol: "└1", palmerAccessible: "UL1" },
  { fdi: "22", universal: "10", palmerSymbol: "└2", palmerAccessible: "UL2" },
  { fdi: "23", universal: "11", palmerSymbol: "└3", palmerAccessible: "UL3" },
  { fdi: "24", universal: "12", palmerSymbol: "└4", palmerAccessible: "UL4" },
  { fdi: "25", universal: "13", palmerSymbol: "└5", palmerAccessible: "UL5" },
  { fdi: "26", universal: "14", palmerSymbol: "└6", palmerAccessible: "UL6" },
  { fdi: "27", universal: "15", palmerSymbol: "└7", palmerAccessible: "UL7" },
  { fdi: "28", universal: "16", palmerSymbol: "└8", palmerAccessible: "UL8" },

  // Permanent Lower Left (Quadrant 3)
  { fdi: "31", universal: "24", palmerSymbol: "┌1", palmerAccessible: "LL1" },
  { fdi: "32", universal: "23", palmerSymbol: "┌2", palmerAccessible: "LL2" },
  { fdi: "33", universal: "22", palmerSymbol: "┌3", palmerAccessible: "LL3" },
  { fdi: "34", universal: "21", palmerSymbol: "┌4", palmerAccessible: "LL4" },
  { fdi: "35", universal: "20", palmerSymbol: "┌5", palmerAccessible: "LL5" },
  { fdi: "36", universal: "19", palmerSymbol: "┌6", palmerAccessible: "LL6" },
  { fdi: "37", universal: "18", palmerSymbol: "┌7", palmerAccessible: "LL7" },
  { fdi: "38", universal: "17", palmerSymbol: "┌8", palmerAccessible: "LL8" },

  // Permanent Lower Right (Quadrant 4)
  { fdi: "41", universal: "25", palmerSymbol: "1┐", palmerAccessible: "LR1" },
  { fdi: "42", universal: "26", palmerSymbol: "2┐", palmerAccessible: "LR2" },
  { fdi: "43", universal: "27", palmerSymbol: "3┐", palmerAccessible: "LR3" },
  { fdi: "44", universal: "28", palmerSymbol: "4┐", palmerAccessible: "LR4" },
  { fdi: "45", universal: "29", palmerSymbol: "5┐", palmerAccessible: "LR5" },
  { fdi: "46", universal: "30", palmerSymbol: "6┐", palmerAccessible: "LR6" },
  { fdi: "47", universal: "31", palmerSymbol: "7┐", palmerAccessible: "LR7" },
  { fdi: "48", universal: "32", palmerSymbol: "8┐", palmerAccessible: "LR8" },

  // Primary Upper Right (Quadrant 5)
  { fdi: "55", universal: "A", palmerSymbol: "E┘", palmerAccessible: "URE" },
  { fdi: "54", universal: "B", palmerSymbol: "D┘", palmerAccessible: "URD" },
  { fdi: "53", universal: "C", palmerSymbol: "C┘", palmerAccessible: "URC" },
  { fdi: "52", universal: "D", palmerSymbol: "B┘", palmerAccessible: "URB" },
  { fdi: "51", universal: "E", palmerSymbol: "A┘", palmerAccessible: "URA" },

  // Primary Upper Left (Quadrant 6)
  { fdi: "61", universal: "F", palmerSymbol: "└A", palmerAccessible: "ULA" },
  { fdi: "62", universal: "G", palmerSymbol: "└B", palmerAccessible: "ULB" },
  { fdi: "63", universal: "H", palmerSymbol: "└C", palmerAccessible: "ULC" },
  { fdi: "64", universal: "I", palmerSymbol: "└D", palmerAccessible: "ULD" },
  { fdi: "65", universal: "J", palmerSymbol: "└E", palmerAccessible: "ULE" },

  // Primary Lower Left (Quadrant 7)
  { fdi: "71", universal: "O", palmerSymbol: "┌A", palmerAccessible: "LLA" },
  { fdi: "72", universal: "N", palmerSymbol: "┌B", palmerAccessible: "LLB" },
  { fdi: "73", universal: "M", palmerSymbol: "┌C", palmerAccessible: "LLC" },
  { fdi: "74", universal: "L", palmerSymbol: "┌D", palmerAccessible: "LLD" },
  { fdi: "75", universal: "K", palmerSymbol: "┌E", palmerAccessible: "LLE" },

  // Primary Lower Right (Quadrant 8)
  { fdi: "81", universal: "P", palmerSymbol: "A┐", palmerAccessible: "LRA" },
  { fdi: "82", universal: "Q", palmerSymbol: "B┐", palmerAccessible: "LRB" },
  { fdi: "83", universal: "R", palmerSymbol: "C┐", palmerAccessible: "LRC" },
  { fdi: "84", universal: "S", palmerSymbol: "D┐", palmerAccessible: "LRD" },
  { fdi: "85", universal: "T", palmerSymbol: "E┐", palmerAccessible: "LRE" },
];

const FDI_MAP = new Map<ToothId, ToothNotationRecord>();
const UNIVERSAL_TO_FDI = new Map<string, ToothId>();
const PALMER_TO_FDI = new Map<string, ToothId>();

for (const rec of TOOTH_NOTATION_TABLE) {
  FDI_MAP.set(rec.fdi, rec);

  // Universal lookup (exact and uppercase normalized)
  UNIVERSAL_TO_FDI.set(rec.universal, rec.fdi);
  UNIVERSAL_TO_FDI.set(rec.universal.toUpperCase(), rec.fdi);

  // Palmer canonical symbol
  PALMER_TO_FDI.set(rec.palmerSymbol, rec.fdi);

  // Palmer accessible code (UR8, etc.)
  PALMER_TO_FDI.set(rec.palmerAccessible, rec.fdi);
  PALMER_TO_FDI.set(rec.palmerAccessible.toUpperCase(), rec.fdi);

  // Tolerant variants for Palmer symbols (e.g. bracket prefix/suffix variations or Unicode box vs corner brackets)
  const glyph = rec.palmerSymbol.replace(/[0-9A-E]/g, "");
  const toothChar = rec.palmerSymbol.replace(/[^0-9A-E]/g, "");

  PALMER_TO_FDI.set(`${glyph}${toothChar}`, rec.fdi);
  PALMER_TO_FDI.set(`${toothChar}${glyph}`, rec.fdi);

  // Alternate corner symbols (Unicode U+23CC .. U+23CF)
  const altGlyphMap: Record<string, string> = {
    "┘": "⏌",
    "└": "⎿",
    "┌": "⎾",
    "┐": "⏋",
  };
  const altGlyph = altGlyphMap[glyph];
  if (altGlyph) {
    PALMER_TO_FDI.set(`${altGlyph}${toothChar}`, rec.fdi);
    PALMER_TO_FDI.set(`${toothChar}${altGlyph}`, rec.fdi);
  }
}

/** FDI World Dental Federation notation adapter (ISO 3950). Canonical identity. */
export const fdiAdapter: NotationAdapter = {
  id: "fdi",
  name: "FDI Two-Digit (ISO 3950)",
  description: "Two-digit tooth designation standard (quadrants 1–4 permanent, 5–8 primary)",
  format(toothId: ToothId): string {
    return toothId;
  },
  formatAccessible(toothId: ToothId): string {
    const rec = FDI_MAP.get(toothId);
    return rec ? `FDI ${rec.fdi}` : `FDI ${toothId}`;
  },
  parse(label: string): ToothId | null {
    if (typeof label !== "string") return null;
    const trimmed = label.trim();
    if (!parseToothId(trimmed)) return null;
    return FDI_MAP.has(trimmed) ? trimmed : null;
  },
  isValid(label: string): boolean {
    return this.parse(label) !== null;
  },
};

/** Universal Numbering System adapter (ADA). 1–32 for permanent, A–T for primary. */
export const universalAdapter: NotationAdapter = {
  id: "universal",
  name: "Universal Numbering System (ADA)",
  description: "Sequential numbering: 1–32 for permanent dentition, A–T for primary dentition",
  format(toothId: ToothId): string {
    const rec = FDI_MAP.get(toothId);
    return rec ? rec.universal : toothId;
  },
  formatAccessible(toothId: ToothId): string {
    const rec = FDI_MAP.get(toothId);
    return rec ? `Universal ${rec.universal}` : `Universal ${toothId}`;
  },
  parse(label: string): ToothId | null {
    if (typeof label !== "string") return null;
    const trimmed = label.trim();
    if (!trimmed) return null;

    // Reject multi-character non-letter tokens or non-digit numbers
    const normalized = trimmed.toUpperCase();
    return UNIVERSAL_TO_FDI.get(normalized) ?? null;
  },
  isValid(label: string): boolean {
    return this.parse(label) !== null;
  },
};

/** Palmer Notation Method adapter. Quadrant symbols and accessible text codes (e.g. UR1). */
export const palmerAdapter: NotationAdapter = {
  id: "palmer",
  name: "Palmer Notation Method",
  description: "Quadrant grid symbols (┘, └, ┌, ┐) with tooth positions (1–8 / A–E)",
  format(toothId: ToothId): string {
    const rec = FDI_MAP.get(toothId);
    return rec ? rec.palmerSymbol : toothId;
  },
  formatAccessible(toothId: ToothId): string {
    const rec = FDI_MAP.get(toothId);
    return rec ? rec.palmerAccessible : toothId;
  },
  parse(label: string): ToothId | null {
    if (typeof label !== "string") return null;
    const trimmed = label.trim();
    if (!trimmed) return null;

    // Direct lookup in fast normalized index
    const directMatch = PALMER_TO_FDI.get(trimmed) ?? PALMER_TO_FDI.get(trimmed.toUpperCase());
    if (directMatch) return directMatch;

    // Normalize spacing and formatting: e.g. "UR 1", "UR-1", "[UR] 1", "[UR]1"
    const cleaned = trimmed
      .toUpperCase()
      .replace(/[()[\]_-]/g, " ")
      .replace(/\s+/g, "")
      .trim();

    return PALMER_TO_FDI.get(cleaned) ?? null;
  },
  isValid(label: string): boolean {
    return this.parse(label) !== null;
  },
};

const NOTATION_ADAPTERS: Record<string, NotationAdapter> = {
  fdi: fdiAdapter,
  universal: universalAdapter,
  palmer: palmerAdapter,
};

export const SUPPORTED_NOTATIONS: readonly Notation[] = ["fdi", "universal", "palmer"];

/** Register a custom tooth numbering / notation adapter. */
export function registerNotation(adapter: NotationAdapter): void {
  if (!adapter || typeof adapter.id !== "string" || !adapter.id.trim()) {
    throw new Error("Notation adapter must have a non-empty id string.");
  }
  if (typeof adapter.format !== "function") {
    throw new Error(`Notation adapter "${adapter.id}" must provide a format function.`);
  }
  NOTATION_ADAPTERS[adapter.id] = adapter;
}

/** Unregister a custom notation adapter. Built-in notations cannot be removed. */
export function unregisterNotation(id: string): boolean {
  if (id === "fdi" || id === "universal" || id === "palmer") {
    return false;
  }
  if (id in NOTATION_ADAPTERS) {
    delete NOTATION_ADAPTERS[id];
    return true;
  }
  return false;
}

export function listSupportedNotations(): string[] {
  return Object.keys(NOTATION_ADAPTERS);
}

export function isValidNotation(notation: string): notation is Notation {
  return notation in NOTATION_ADAPTERS;
}

export function getNotationAdapter(notation: string): NotationAdapter {
  const adapter = NOTATION_ADAPTERS[notation];
  if (!adapter) {
    throw new Error(
      `Unsupported notation: "${notation}". Expected one of: ${listSupportedNotations().join(", ")}.`,
    );
  }
  return adapter;
}

export function toNotation(fdi: string, notation: Notation): string {
  const adapter = NOTATION_ADAPTERS[notation];
  return adapter ? adapter.format(fdi) : fdi;
}

export function toAccessibleNotation(fdi: string, notation: Notation): string {
  const adapter = NOTATION_ADAPTERS[notation];
  return adapter ? adapter.formatAccessible(fdi) : fdi;
}

export function fromNotation(label: string, notation: Notation): string | null {
  const adapter = NOTATION_ADAPTERS[notation];
  return adapter ? adapter.parse(label) : null;
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

export { toLayoutArch } from "./ids.js";
