import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  getAllToothRecords,
  getApplicableSurfacesForClass,
  mapSurfaceToFace,
} from "@odontogram/dentition";
import {
  parseToothSvgMetadataJson,
  validateToothSvg,
  verifySurfaceFaceBinding,
} from "../contract/index.js";
import {
  assertManifestCoversCatalog,
  getManifest,
  listCatalogFamilies,
  listCatalogResourceIds,
  resolveToothSvgResource,
} from "./index.js";
import { resolveAbsoluteResourcePath } from "./paths-node.js";

beforeAll(() => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
});

describe("svg catalog manifest", () => {
  it("covers all 52 FDI teeth", () => {
    const ids = getAllToothRecords().map((r) => r.id);
    expect(ids).toHaveLength(52);
    assertManifestCoversCatalog(ids);
    expect(Object.keys(getManifest().teeth)).toHaveLength(52);
  });

  it("maps each tooth to an existing svg + sidecar", () => {
    for (const record of getAllToothRecords()) {
      const resolved = resolveToothSvgResource(record.id);
      const svgPath = resolveAbsoluteResourcePath(resolved.relativeSvgPath);
      const jsonPath = resolveAbsoluteResourcePath(resolved.relativeMetadataPath);
      expect(fs.existsSync(svgPath)).toBe(true);
      expect(fs.existsSync(jsonPath)).toBe(true);
      expect(resolved.referenceToothId).toBe(record.id);
    }
  });

  it("exposes 16 catalog families", () => {
    expect(listCatalogResourceIds()).toHaveLength(16);
    expect(listCatalogFamilies()).toHaveLength(16);
  });
});

describe("svg catalog orientation bindings", () => {
  it("aligns each family sidecar reference tooth with data-face", () => {
    for (const family of listCatalogFamilies()) {
      const svg = fs.readFileSync(resolveAbsoluteResourcePath(family.relativeSvgPath), "utf8");
      const metadata = parseToothSvgMetadataJson(
        fs.readFileSync(resolveAbsoluteResourcePath(family.relativeMetadataPath), "utf8"),
      );
      const result = validateToothSvg(svg, { metadata });
      expect(result.valid).toBe(true);
      expect(metadata.referenceToothId).toBe(family.referenceToothId);
    }
  });

  it("uses incisal (I) for anterior classes and occlusal (O) for posteriors", () => {
    for (const family of listCatalogFamilies()) {
      const svg = fs.readFileSync(resolveAbsoluteResourcePath(family.relativeSvgPath), "utf8");
      const isAnterior = family.toothClass === "incisor" || family.toothClass === "canine";
      if (isAnterior) {
        expect(svg).toContain('data-surface="I"');
        expect(svg).not.toContain('data-surface="O"');
      } else {
        expect(svg).toContain('data-surface="O"');
        expect(svg).not.toContain('data-surface="I"');
      }
    }
  });

  it("matches dentition mapSurfaceToFace for every manifest tooth", () => {
    for (const record of getAllToothRecords()) {
      const resolved = resolveToothSvgResource(record.id);
      const svg = fs.readFileSync(resolveAbsoluteResourcePath(resolved.relativeSvgPath), "utf8");
      for (const surface of getApplicableSurfacesForClass(record.toothClass)) {
        const face = mapSurfaceToFace(record.id, surface);
        expect(svg).toContain(`data-surface="${surface}" data-face="${face}"`);
        expect(verifySurfaceFaceBinding(record.id, surface, face)).toBe(true);
      }
    }
  });
});
