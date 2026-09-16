import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  getPermanentTeeth,
  getDeciduousTeeth,
  getMixedTeeth,
  getTeethForView,
  toNotation,
  toAccessibleNotation,
  fromNotation,
  getNotationAdapter,
  listSupportedNotations,
  isValidNotation,
  fdiAdapter,
  universalAdapter,
  palmerAdapter,
  getArch,
  isPermanentTooth,
  isDeciduousTooth,
  type ToothNotationRecord,
  type Notation,
} from "./notation.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf-8")) as T;
}

describe("dentition notation", () => {
  const allTeeth = getMixedTeeth();

  it("permanent dentition has 32 teeth", () => {
    expect(getPermanentTeeth()).toHaveLength(32);
  });

  it("deciduous dentition has 20 teeth", () => {
    expect(getDeciduousTeeth()).toHaveLength(20);
  });

  it("mixed dentition has 52 teeth", () => {
    expect(getMixedTeeth()).toHaveLength(52);
  });

  it("getTeethForView returns correct sets", () => {
    expect(getTeethForView("permanent")).toHaveLength(32);
    expect(getTeethForView("deciduous")).toHaveLength(20);
    expect(getTeethForView("mixed")).toHaveLength(52);
  });

  it("lists supported notations", () => {
    expect(listSupportedNotations()).toEqual(["fdi", "universal", "palmer"]);
    expect(isValidNotation("fdi")).toBe(true);
    expect(isValidNotation("universal")).toBe(true);
    expect(isValidNotation("palmer")).toBe(true);
    expect(isValidNotation("unknown")).toBe(false);
  });

  it("gets notation adapters correctly", () => {
    expect(getNotationAdapter("fdi")).toBe(fdiAdapter);
    expect(getNotationAdapter("universal")).toBe(universalAdapter);
    expect(getNotationAdapter("palmer")).toBe(palmerAdapter);
    expect(() => getNotationAdapter("invalid" as unknown as Notation)).toThrowError();
  });

  it("matches reviewed notations fixture exactly for all 52 teeth", () => {
    const fixture = loadJson<
      Array<
        ToothNotationRecord & {
          dentition: string;
          arch: string;
          quadrant: number;
          position: number;
        }
      >
    >("notations.json");
    expect(fixture).toHaveLength(52);

    for (const entry of fixture) {
      expect(toNotation(entry.fdi, "fdi")).toBe(entry.fdi);
      expect(toNotation(entry.fdi, "universal")).toBe(entry.universal);
      expect(toNotation(entry.fdi, "palmer")).toBe(entry.palmerSymbol);
      expect(toAccessibleNotation(entry.fdi, "palmer")).toBe(entry.palmerAccessible);
    }
  });

  describe("roundtrip conversion across all 52 teeth", () => {
    for (const toothId of allTeeth) {
      it(`roundtrips tooth ${toothId} through FDI, Universal, and Palmer`, () => {
        // FDI roundtrip
        const fdiLabel = toNotation(toothId, "fdi");
        expect(fdiAdapter.format(toothId)).toBe(toothId);
        expect(fromNotation(fdiLabel, "fdi")).toBe(toothId);
        expect(fdiAdapter.parse(fdiLabel)).toBe(toothId);
        expect(fdiAdapter.isValid(fdiLabel)).toBe(true);

        // Universal roundtrip
        const univLabel = toNotation(toothId, "universal");
        expect(universalAdapter.format(toothId)).toBe(univLabel);
        expect(fromNotation(univLabel, "universal")).toBe(toothId);
        expect(universalAdapter.parse(univLabel)).toBe(toothId);
        expect(universalAdapter.isValid(univLabel)).toBe(true);

        // Palmer symbol roundtrip
        const palmerSymbol = toNotation(toothId, "palmer");
        expect(palmerAdapter.format(toothId)).toBe(palmerSymbol);
        expect(fromNotation(palmerSymbol, "palmer")).toBe(toothId);
        expect(palmerAdapter.parse(palmerSymbol)).toBe(toothId);
        expect(palmerAdapter.isValid(palmerSymbol)).toBe(true);

        // Palmer accessible text roundtrip
        const palmerAccessible = toAccessibleNotation(toothId, "palmer");
        expect(palmerAdapter.formatAccessible(toothId)).toBe(palmerAccessible);
        expect(fromNotation(palmerAccessible, "palmer")).toBe(toothId);
        expect(palmerAdapter.parse(palmerAccessible)).toBe(toothId);
      });
    }
  });

  describe("Universal numbering system", () => {
    it("parses lowercase letters for primary dentition", () => {
      expect(fromNotation("a", "universal")).toBe("55");
      expect(fromNotation("j", "universal")).toBe("65");
      expect(fromNotation("k", "universal")).toBe("75");
      expect(fromNotation("t", "universal")).toBe("85");
    });

    it("rejects out-of-range numbers and invalid letters", () => {
      expect(fromNotation("0", "universal")).toBeNull();
      expect(fromNotation("33", "universal")).toBeNull();
      expect(fromNotation("34", "universal")).toBeNull();
      expect(fromNotation("100", "universal")).toBeNull();
      expect(fromNotation("-1", "universal")).toBeNull();
      expect(fromNotation("U", "universal")).toBeNull();
      expect(fromNotation("Z", "universal")).toBeNull();
      expect(fromNotation("AA", "universal")).toBeNull();
      expect(fromNotation("1A", "universal")).toBeNull();
      expect(fromNotation("", "universal")).toBeNull();
      expect(fromNotation("   ", "universal")).toBeNull();
    });
  });

  describe("Palmer notation parsing and formatting", () => {
    it("formats standard Palmer symbols with quadrant corners", () => {
      expect(toNotation("18", "palmer")).toBe("8┘");
      expect(toNotation("11", "palmer")).toBe("1┘");
      expect(toNotation("21", "palmer")).toBe("└1");
      expect(toNotation("28", "palmer")).toBe("└8");
      expect(toNotation("31", "palmer")).toBe("┌1");
      expect(toNotation("38", "palmer")).toBe("┌8");
      expect(toNotation("41", "palmer")).toBe("1┐");
      expect(toNotation("48", "palmer")).toBe("8┐");

      // Primary teeth
      expect(toNotation("55", "palmer")).toBe("E┘");
      expect(toNotation("61", "palmer")).toBe("└A");
      expect(toNotation("71", "palmer")).toBe("┌A");
      expect(toNotation("85", "palmer")).toBe("E┐");
    });

    it("parses quadrant glyph position variants (prefix and suffix)", () => {
      expect(fromNotation("8┘", "palmer")).toBe("18");
      expect(fromNotation("┘8", "palmer")).toBe("18");
      expect(fromNotation("└1", "palmer")).toBe("21");
      expect(fromNotation("1└", "palmer")).toBe("21");
      expect(fromNotation("┌1", "palmer")).toBe("31");
      expect(fromNotation("1┌", "palmer")).toBe("31");
      expect(fromNotation("1┐", "palmer")).toBe("41");
      expect(fromNotation("┐1", "palmer")).toBe("41");
    });

    it("parses alternate Unicode corner bracket symbols", () => {
      expect(fromNotation("8⏌", "palmer")).toBe("18");
      expect(fromNotation("⎿1", "palmer")).toBe("21");
      expect(fromNotation("⎾1", "palmer")).toBe("31");
      expect(fromNotation("1⏋", "palmer")).toBe("41");
    });

    it("parses accessible text format (e.g. UR1, LL6, LRE)", () => {
      expect(fromNotation("UR1", "palmer")).toBe("11");
      expect(fromNotation("UR8", "palmer")).toBe("18");
      expect(fromNotation("UL1", "palmer")).toBe("21");
      expect(fromNotation("LL6", "palmer")).toBe("36");
      expect(fromNotation("LR4", "palmer")).toBe("44");
      expect(fromNotation("URE", "palmer")).toBe("55");
      expect(fromNotation("ULA", "palmer")).toBe("61");
      expect(fromNotation("LLA", "palmer")).toBe("71");
      expect(fromNotation("LRE", "palmer")).toBe("85");
    });

    it("parses case-insensitive and spaced accessible text", () => {
      expect(fromNotation("ur 1", "palmer")).toBe("11");
      expect(fromNotation("ur-1", "palmer")).toBe("11");
      expect(fromNotation("[UR] 1", "palmer")).toBe("11");
      expect(fromNotation("lla", "palmer")).toBe("71");
      expect(fromNotation("[LR] E", "palmer")).toBe("85");
    });

    it("rejects ambiguous Palmer input without quadrant context", () => {
      expect(fromNotation("1", "palmer")).toBeNull();
      expect(fromNotation("8", "palmer")).toBeNull();
      expect(fromNotation("A", "palmer")).toBeNull();
      expect(fromNotation("E", "palmer")).toBeNull();
    });

    it("rejects out-of-catalog Palmer inputs", () => {
      expect(fromNotation("UR9", "palmer")).toBeNull();
      expect(fromNotation("UL0", "palmer")).toBeNull();
      expect(fromNotation("LLF", "palmer")).toBeNull();
      expect(fromNotation("LRZ", "palmer")).toBeNull();
      expect(fromNotation("9┘", "palmer")).toBeNull();
      expect(fromNotation("└0", "palmer")).toBeNull();
      expect(fromNotation("┌F", "palmer")).toBeNull();
      expect(fromNotation("invalid", "palmer")).toBeNull();
      expect(fromNotation("", "palmer")).toBeNull();
    });
  });

  describe("FDI notation parsing and rejection", () => {
    it("rejects out-of-catalog FDI ids", () => {
      expect(fromNotation("0", "fdi")).toBeNull();
      expect(fromNotation("9", "fdi")).toBeNull();
      expect(fromNotation("10", "fdi")).toBeNull();
      expect(fromNotation("19", "fdi")).toBeNull();
      expect(fromNotation("29", "fdi")).toBeNull();
      expect(fromNotation("39", "fdi")).toBeNull();
      expect(fromNotation("49", "fdi")).toBeNull();
      expect(fromNotation("50", "fdi")).toBeNull();
      expect(fromNotation("56", "fdi")).toBeNull();
      expect(fromNotation("86", "fdi")).toBeNull();
      expect(fromNotation("99", "fdi")).toBeNull();
      expect(fromNotation("1A", "fdi")).toBeNull();
      expect(fromNotation("", "fdi")).toBeNull();
    });
  });

  describe("Arch and Classification helpers", () => {
    it("getArch identifies upper and lower teeth", () => {
      expect(getArch("11")).toBe("upper");
      expect(getArch("41")).toBe("lower");
      expect(getArch("51")).toBe("upper");
      expect(getArch("71")).toBe("lower");
    });

    it("isPermanentTooth and isDeciduousTooth classify correctly", () => {
      expect(isPermanentTooth("16")).toBe(true);
      expect(isDeciduousTooth("55")).toBe(true);
      expect(isPermanentTooth("55")).toBe(false);
      expect(isDeciduousTooth("16")).toBe(false);
    });
  });
});
