import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { JSDOM } from "jsdom";
import {
  parseToothSvgMetadataJson,
  prefixElementIds,
  validateToothSvg,
  SVG_CONTRACT_VERSION,
  expectedSurfacesForToothClass,
} from "./index.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/contract",
);

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

beforeAll(() => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
});

describe("validateToothSvg", () => {
  it("accepts valid molar fixture with metadata", () => {
    const svg = readFixture("valid-molar-occlusal.svg");
    const metadata = parseToothSvgMetadataJson(readFixture("valid-molar-occlusal.json"));
    const result = validateToothSvg(svg, { metadata });
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("rejects script tags", () => {
    const result = validateToothSvg(readFixture("invalid-script.svg"));
    expect(result.valid).toBe(false);
    expect(result.ruleIds).toContain("contract.security.no-script");
  });

  it("rejects wrong viewBox", () => {
    const result = validateToothSvg(readFixture("invalid-viewbox.svg"));
    expect(result.valid).toBe(false);
    expect(result.ruleIds).toContain("contract.viewbox");
  });

  it("reports missing occlusal surface for molar metadata", () => {
    const svg = readFixture("invalid-missing-occlusal.svg");
    const metadata = parseToothSvgMetadataJson(readFixture("valid-molar-occlusal.json"));
    const result = validateToothSvg(svg, { metadata });
    expect(result.valid).toBe(false);
    expect(result.ruleIds).toContain("contract.surfaces.match-class");
  });

  it("validates shipped template resource", () => {
    const templateDir = path.resolve(fixturesDir, "../../resources/template");
    const svg = fs.readFileSync(
      path.join(templateDir, "tooth-occlusal-schematic.template.svg"),
      "utf8",
    );
    const metadata = parseToothSvgMetadataJson(
      fs.readFileSync(path.join(templateDir, "tooth-occlusal-schematic.template.json"), "utf8"),
    );
    const result = validateToothSvg(svg, { metadata });
    expect(result.valid).toBe(true);
  });
});

describe("prefixElementIds", () => {
  it("prefixes ids and href references", () => {
    const svg = readFixture("valid-molar-occlusal.svg");
    const prefixed = prefixElementIds(svg, { prefix: "t16-" });
    expect(prefixed).toContain('id="t16-surface-M"');
    expect(prefixed).not.toMatch(/\sid="surface-M"/);
  });
});

describe("dentition surface binding", () => {
  it("uses incisal for anterior classes", () => {
    expect(expectedSurfacesForToothClass("incisor")).toContain("I");
    expect(expectedSurfacesForToothClass("incisor")).not.toContain("O");
    expect(expectedSurfacesForToothClass("molar")).toContain("O");
    expect(expectedSurfacesForToothClass("molar")).not.toContain("I");
  });

  it("documents contract version", () => {
    expect(SVG_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
