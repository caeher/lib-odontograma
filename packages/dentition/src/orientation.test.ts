import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { mapSurfaceToFace } from "./orientation.js";
import type { ClinicalSurface } from "./surfaces.js";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, "../fixtures/orientation.json"), "utf-8"),
) as {
  samples: Array<{ tooth: string; surface: ClinicalSurface; face: string }>;
};

describe("clinical surface orientation", () => {
  it("matches reviewed orientation fixture", () => {
    for (const sample of fixture.samples) {
      expect(mapSurfaceToFace(sample.tooth, sample.surface)).toBe(sample.face);
    }
  });

  it("preserves mesial toward midline when quadrants are mirrored", () => {
    expect(mapSurfaceToFace("16", "M")).toBe("right");
    expect(mapSurfaceToFace("26", "M")).toBe("left");
    expect(mapSurfaceToFace("46", "M")).toBe("right");
    expect(mapSurfaceToFace("36", "M")).toBe("left");
  });

  it("preserves buccal toward vestibule by arch", () => {
    expect(mapSurfaceToFace("16", "B")).toBe("top");
    expect(mapSurfaceToFace("16", "L")).toBe("bottom");
    expect(mapSurfaceToFace("46", "B")).toBe("bottom");
    expect(mapSurfaceToFace("46", "L")).toBe("top");
  });

  it("maps occlusal and incisal to center", () => {
    expect(mapSurfaceToFace("16", "O")).toBe("center");
    expect(mapSurfaceToFace("11", "I")).toBe("center");
  });
});
