import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { OdontogramValidationError, VALIDATION_CODES } from "./errors.js";
import { validateOdontogramState, validateMarks } from "./validation.js";
import type { OdontogramState, SurfaceId, ToothId } from "./types.js";

describe("Robustness, Boundary, Mutation, and Scale Tests", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("Consumer Object Mutation Protection", () => {
    it("protects internal state against mutation of input mark objects after setState", () => {
      const odontogram = new Odontogram(container);
      const inputMark = {
        id: "m-orig",
        tooth: "16",
        surfaces: ["O"] as SurfaceId[],
        type: "caries",
        metadata: { depth: "enamel", notes: { priority: 1 } },
      };
      const inputMarks = [inputMark];

      odontogram.setState({ marks: inputMarks });

      // Mutate the original consumer object and arrays
      inputMark.type = "restoration";
      inputMark.surfaces.push("M");
      inputMark.metadata.depth = "dentin";
      inputMark.metadata.notes.priority = 2;
      inputMarks.push({
        id: "m-injected",
        tooth: "26",
        surfaces: ["B"] as SurfaceId[],
        type: "sealant",
        metadata: { depth: "surface", notes: { priority: 1 } },
      });

      const state = odontogram.getState();
      expect(state.marks).toHaveLength(1);
      expect(state.marks[0].id).toBe("m-orig");
      expect(state.marks[0].type).toBe("caries");
      expect(state.marks[0].surfaces).toEqual(["O"]);
      expect(state.marks[0].metadata).toEqual({ depth: "enamel", notes: { priority: 1 } });
    });

    it("protects internal state against mutation of objects returned by getState", () => {
      const odontogram = new Odontogram(container);
      odontogram.setState({
        marks: [
          {
            id: "m1",
            tooth: "16",
            surfaces: ["O"],
            type: "caries",
            metadata: { score: 10 },
          },
        ],
        selection: { teeth: ["16"], surfaces: [{ tooth: "16", surface: "O" }] },
        teeth: { "18": { presence: "missing" } },
      });

      // Get snapshot and mutate all nested fields
      const state1 = odontogram.getState();
      state1.marks[0].type = "mutated-type";
      state1.marks[0].surfaces?.push("M");
      state1.marks[0].metadata!.score = 999;
      state1.selection.teeth.push("99");
      state1.selection.surfaces.push({ tooth: "99", surface: "B" });
      state1.teeth["18"].presence = "present";

      // Verify second snapshot is completely unaffected
      const state2 = odontogram.getState();
      expect(state2.marks[0].type).toBe("caries");
      expect(state2.marks[0].surfaces).toEqual(["O"]);
      expect(state2.marks[0].metadata?.score).toBe(10);
      expect(state2.selection.teeth).toEqual(["16"]);
      expect(state2.selection.surfaces).toEqual([{ tooth: "16", surface: "O" }]);
      expect(state2.teeth["18"].presence).toBe("missing");
    });
  });

  describe("Incomplete and Malformed Input Handling", () => {
    it("rejects null or non-object state inputs with OdontogramValidationError", () => {
      const odontogram = new Odontogram(container);
      expect(() => odontogram.setState(null as unknown as OdontogramState)).toThrow(
        OdontogramValidationError,
      );
      expect(() => odontogram.setState("invalid-string" as unknown as OdontogramState)).toThrow(
        OdontogramValidationError,
      );
      expect(() => odontogram.setState(123 as unknown as OdontogramState)).toThrow(
        OdontogramValidationError,
      );
    });

    it("rejects marks with missing IDs or whitespace-only IDs", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "   ",
            type: "caries",
            target: { tooth: "16", surfaces: ["O"] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_CODES.ERR_INVALID_MARK_ID)).toBe(true);
    });

    it("rejects marks with missing or whitespace-only type", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "m-1",
            type: "   ",
            target: { tooth: "16", surfaces: ["O"] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "marks[0].type")).toBe(true);
    });

    it("rejects malformed selection arrays containing non-strings", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [],
        selection: {
          teeth: [null as unknown as ToothId, ""],
          surfaces: [{ tooth: "", surface: "invalid" as unknown as SurfaceId }],
        },
        teeth: {},
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_CODES.ERR_INVALID_SELECTION)).toBe(
        true,
      );
    });

    it("rejects malformed teeth presence records", () => {
      const state: OdontogramState = {
        view: "permanent",
        marks: [],
        selection: { teeth: [], surfaces: [] },
        teeth: {
          "16": { presence: "partially-present" as unknown as "present" },
        },
      };
      const result = validateOdontogramState(state);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_CODES.ERR_INVALID_PRESENCE);
      expect(result.errors[0].path).toBe("teeth.16.presence");
    });
  });

  describe("Boundary Value Tests", () => {
    it("handles all 5 surfaces on anterior teeth (M, I, D, B, L) and posterior teeth (M, O, D, B, L)", () => {
      const marks = [
        {
          id: "m-anterior-all",
          type: "restoration",
          target: { tooth: "11", surfaces: ["M", "I", "D", "B", "L"] as SurfaceId[] },
        },
        {
          id: "m-posterior-all",
          type: "restoration",
          target: { tooth: "16", surfaces: ["M", "O", "D", "B", "L"] as SurfaceId[] },
        },
      ];
      const result = validateMarks(marks);
      expect(result.valid).toBe(true);
    });

    it("handles all standard FDI permanent teeth (11-18, 21-28, 31-38, 41-48) and primary teeth (51-55, 61-65, 71-75, 81-85)", () => {
      const permanentTeeth: ToothId[] = [
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "21",
        "22",
        "23",
        "24",
        "25",
        "26",
        "27",
        "28",
        "31",
        "32",
        "33",
        "34",
        "35",
        "36",
        "37",
        "38",
        "41",
        "42",
        "43",
        "44",
        "45",
        "46",
        "47",
        "48",
      ];
      const primaryTeeth: ToothId[] = [
        "51",
        "52",
        "53",
        "54",
        "55",
        "61",
        "62",
        "63",
        "64",
        "65",
        "71",
        "72",
        "73",
        "74",
        "75",
        "81",
        "82",
        "83",
        "84",
        "85",
      ];

      const allTeeth = [...permanentTeeth, ...primaryTeeth];
      const marks = allTeeth.map((tooth, idx) => ({
        id: `mark-${tooth}-${idx}`,
        type: "evaluation",
        target: { tooth },
      }));

      const result = validateMarks(marks);
      expect(result.valid).toBe(true);
    });

    it("handles completely empty state gracefully", () => {
      const emptyState: OdontogramState = {
        view: "permanent",
        marks: [],
        selection: { teeth: [], surfaces: [] },
        teeth: {},
      };
      const result = validateOdontogramState(emptyState);
      expect(result.valid).toBe(true);
    });
  });

  describe("Large Dataset & Performance Scalability", () => {
    it("validates and manages 1,000 marks efficiently within acceptable threshold", () => {
      const odontogram = new Odontogram(container);
      const largeMarks = [];

      for (let i = 0; i < 1000; i++) {
        const quadrant = (i % 4) + 1;
        const position = (i % 8) + 1;
        const tooth = `${quadrant}${position}`;
        const isAnterior = position <= 3;
        const surface: SurfaceId = isAnterior ? "I" : "O";

        largeMarks.push({
          id: `stress-mark-${i}`,
          tooth,
          surfaces: [surface],
          type: i % 2 === 0 ? "caries" : "restoration",
          metadata: { iteration: i, payload: "test-data" },
        });
      }

      const start = performance.now();
      odontogram.setState({ marks: largeMarks });
      const durationMs = performance.now() - start;

      const state = odontogram.getState();
      expect(state.marks).toHaveLength(1000);
      expect(durationMs).toBeLessThan(500); // 1000 marks should process smoothly in sub-500ms
    });

    it("handles complex multi-tooth annotations spanning multiple teeth", () => {
      const bridgeTeeth: ToothId[] = ["13", "14", "15", "16", "17"];
      const state: OdontogramState = {
        view: "permanent",
        marks: [
          {
            id: "large-bridge-1",
            type: "bridge",
            target: { teeth: bridgeTeeth },
            metadata: { retainers: ["13", "17"], pontics: ["14", "15", "16"] },
          },
        ],
        selection: { teeth: [], surfaces: [] },
        teeth: {
          "14": { presence: "missing" },
          "15": { presence: "missing" },
          "16": { presence: "missing" },
        },
      };

      const result = validateOdontogramState(state);
      expect(result.valid).toBe(true);
    });
  });
});
