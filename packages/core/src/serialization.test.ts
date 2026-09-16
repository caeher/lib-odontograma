import { describe, it, expect } from "vitest";
import {
  MULTI_MARK_COEXISTENCE_EXAMPLE,
  MULTI_SURFACE_RESTORATIONS_EXAMPLE,
  MULTI_TOOTH_ANNOTATIONS_EXAMPLE,
  SERIALIZATION_EXAMPLES,
  WHOLE_TOOTH_MARKS_EXAMPLE,
} from "./examples.js";
import { validateOdontogramState } from "./validation.js";
import type { OdontogramState } from "./types.js";

describe("Serialization Examples & Data Round-trip", () => {
  it("serializes and deserializes multi-surface restorations without loss", () => {
    const original = MULTI_SURFACE_RESTORATIONS_EXAMPLE;
    const jsonString = JSON.stringify(original, null, 2);
    const parsed = JSON.parse(jsonString) as OdontogramState;

    expect(parsed).toEqual(original);
    expect(parsed.marks).toHaveLength(3);

    // MOD on 16
    const mod16 = parsed.marks.find((m) => m.id === "restoration-16-mod");
    expect(mod16).toBeDefined();
    expect(mod16?.type).toBe("restoration");
    expect(mod16?.status).toBe("completed");
    expect(mod16?.target).toEqual({
      tooth: "16",
      surfaces: ["M", "O", "D"],
    });
    expect(mod16?.metadata).toEqual({
      material: "composite-resin",
      shade: "A2",
      bondingAgent: "universal-adhesive",
      date: "2026-03-15",
      providerId: "dr-smith",
    });

    const validation = validateOdontogramState(parsed);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("serializes and deserializes whole-tooth marks without loss", () => {
    const original = WHOLE_TOOTH_MARKS_EXAMPLE;
    const jsonString = JSON.stringify(original);
    const parsed = JSON.parse(jsonString) as OdontogramState;

    expect(parsed).toEqual(original);

    // Separates tooth presence overlay from mark finding
    expect(parsed.teeth["18"]?.presence).toBe("missing");
    expect(parsed.teeth["28"]?.presence).toBe("unerupted");

    const crown36 = parsed.marks.find((m) => m.id === "crown-36");
    expect(crown36?.type).toBe("crown");
    expect(crown36?.status).toBe("existing");
    expect(crown36?.target).toEqual({ tooth: "36" });

    const implant46 = parsed.marks.find((m) => m.id === "implant-46");
    expect(implant46?.metadata).toEqual({
      fixtureSystem: "Straumann",
      diameterMm: 4.1,
      lengthMm: 10.0,
      torqueNcm: 35,
    });

    const validation = validateOdontogramState(parsed);
    expect(validation.valid).toBe(true);
  });

  it("serializes and deserializes multi-tooth annotations (bridges and splints)", () => {
    const original = MULTI_TOOTH_ANNOTATIONS_EXAMPLE;
    const jsonString = JSON.stringify(original);
    const parsed = JSON.parse(jsonString) as OdontogramState;

    expect(parsed).toEqual(original);

    // Bridge 14-15-16
    const bridge = parsed.marks.find((m) => m.id === "bridge-14-15-16");
    expect(bridge?.type).toBe("bridge");
    expect(bridge?.status).toBe("planned");
    expect(bridge?.target).toEqual({ teeth: ["14", "15", "16"] });
    expect(bridge?.metadata).toEqual({
      retainers: ["14", "16"],
      pontics: ["15"],
      material: "monolithic-zirconia",
      shade: "A3",
      labName: "Precision Dental Lab",
    });

    // Splint 33-43
    const splint = parsed.marks.find((m) => m.id === "splint-mandibular-anterior");
    expect(splint?.target).toEqual({
      teeth: ["43", "42", "41", "31", "32", "33"],
    });

    const validation = validateOdontogramState(parsed);
    expect(validation.valid).toBe(true);
  });

  it("serializes multiple marks on a single tooth preserving distinct identities", () => {
    const original = MULTI_MARK_COEXISTENCE_EXAMPLE;
    const jsonString = JSON.stringify(original);
    const parsed = JSON.parse(jsonString) as OdontogramState;

    expect(parsed).toEqual(original);
    const tooth16Marks = parsed.marks.filter((m) => {
      const target = m.target as { tooth?: string };
      return target.tooth === "16" || m.tooth === "16";
    });

    expect(tooth16Marks).toHaveLength(3);
    const markIds = tooth16Marks.map((m) => m.id);
    expect(markIds).toEqual(["mark-16-endo", "mark-16-post-core", "mark-16-crown"]);

    const validation = validateOdontogramState(parsed);
    expect(validation.valid).toBe(true);
  });

  it("all SERIALIZATION_EXAMPLES pass state validation", () => {
    for (const [name, example] of Object.entries(SERIALIZATION_EXAMPLES)) {
      const result = validateOdontogramState(example);
      expect(
        result.valid,
        `Example "${name}" should be valid, but had errors: ${JSON.stringify(result.errors)}`,
      ).toBe(true);
    }
  });
});
