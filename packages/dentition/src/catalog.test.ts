import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  getAllToothRecords,
  getApplicableSurfaces,
  getMixedTeeth,
  getPermanentTeeth,
  getPrimaryTeeth,
  getSuccessor,
  getTooth,
  listTeeth,
} from "./catalog.js";

const fixturesDir = join(import.meta.dirname, "../fixtures");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf-8")) as T;
}

interface FixtureRecord {
  id: string;
  dentition: string;
  arch: string;
  quadrant: number;
  position: number;
  toothClass: string;
  applicableSurfaces: string[];
  successorId?: string;
  predecessorId?: string;
}

describe("tooth catalog", () => {
  it("permanent catalog matches fixture (32 teeth)", () => {
    const fixture = loadJson<FixtureRecord[]>("permanent.json");
    const catalog = listTeeth({ dentition: "permanent" }).map((r) => ({
      id: r.id,
      dentition: r.dentition,
      arch: r.arch,
      quadrant: r.quadrant,
      position: r.position,
      toothClass: r.toothClass,
      applicableSurfaces: r.applicableSurfaces,
      ...(r.predecessorId ? { predecessorId: r.predecessorId } : {}),
    }));
    expect(catalog).toEqual(fixture);
    expect(getPermanentTeeth()).toHaveLength(32);
  });

  it("primary catalog matches fixture (20 teeth)", () => {
    const fixture = loadJson<FixtureRecord[]>("primary.json");
    const catalog = listTeeth({ dentition: "primary" }).map((r) => ({
      id: r.id,
      dentition: r.dentition,
      arch: r.arch,
      quadrant: r.quadrant,
      position: r.position,
      toothClass: r.toothClass,
      applicableSurfaces: r.applicableSurfaces,
      ...(r.successorId ? { successorId: r.successorId } : {}),
    }));
    expect(catalog).toEqual(fixture);
    expect(getPrimaryTeeth()).toHaveLength(20);
  });

  it("mixed catalog is union without replacement", () => {
    const mixed = loadJson<{ mixedCatalogIncludesBoth: Array<{ bothInMixed: boolean }> }>(
      "mixed-coexistence.json",
    );
    expect(getMixedTeeth()).toHaveLength(52);
    for (const entry of mixed.mixedCatalogIncludesBoth) {
      expect(entry.bothInMixed).toBe(true);
    }
    expect(getSuccessor("55")).toBe("15");
    expect(getTooth("55")?.successorId).toBe("15");
    expect(getTooth("15")?.predecessorId).toBe("55");
  });

  it("assigns applicable surfaces by tooth class", () => {
    expect(getApplicableSurfaces("11")).toEqual(["M", "I", "D", "B", "L"]);
    expect(getApplicableSurfaces("16")).toEqual(["M", "O", "D", "B", "L"]);
    expect(getApplicableSurfaces("55")).toEqual(["M", "O", "D", "B", "L"]);
  });

  it("catalog ids are unique", () => {
    const ids = getAllToothRecords().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("isValidToothId and isSurfaceApplicableToTooth check catalog validity", async () => {
    const { isValidToothId, isSurfaceApplicableToTooth } = await import("./catalog.js");
    expect(isValidToothId("16")).toBe(true);
    expect(isValidToothId("55")).toBe(true);
    expect(isValidToothId("99")).toBe(false);

    expect(isSurfaceApplicableToTooth("11", "I")).toBe(true);
    expect(isSurfaceApplicableToTooth("11", "O")).toBe(false);
    expect(isSurfaceApplicableToTooth("16", "O")).toBe(true);
    expect(isSurfaceApplicableToTooth("16", "I")).toBe(false);
  });
});
