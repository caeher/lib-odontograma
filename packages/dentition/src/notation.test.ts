import { describe, it, expect } from "vitest";
import {
  getPermanentTeeth,
  getDeciduousTeeth,
  getMixedTeeth,
  getTeethForView,
  toNotation,
  fromNotation,
  getArch,
  isPermanentTooth,
  isDeciduousTooth,
} from "./notation.js";

describe("dentition notation", () => {
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

  it("toNotation converts FDI to universal", () => {
    expect(toNotation("11", "universal")).toBe("8");
    expect(toNotation("18", "universal")).toBe("1");
  });

  it("fromNotation converts universal back to FDI", () => {
    expect(fromNotation("8", "universal")).toBe("11");
    expect(fromNotation("1", "universal")).toBe("18");
  });

  it("toNotation returns FDI when notation is fdi", () => {
    expect(toNotation("16", "fdi")).toBe("16");
  });

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
