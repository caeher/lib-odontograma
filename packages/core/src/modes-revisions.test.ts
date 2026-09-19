import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { OdontogramError, VALIDATION_CODES } from "./errors.js";
import { createPlugin } from "./plugin.js";
import type { StateChangeArg, ToothStateChangeArg, ViewRenderContext } from "./types.js";

function createNoopView(type = "permanent") {
  return {
    type,
    render: (ctx: ViewRenderContext) => {
      const div = document.createElement("div");
      ctx.el.appendChild(div);
    },
  };
}

describe("Controlled vs Internal Modes & Revisions (Stage 02)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("Mode Configuration", () => {
    it("defaults to 'internal' mode", () => {
      const odontogram = new Odontogram(container);
      expect(odontogram.getMode()).toBe("internal");
    });

    it("respects 'controlled' mode configuration", () => {
      const odontogram = new Odontogram(container, { mode: "controlled" });
      expect(odontogram.getMode()).toBe("controlled");
    });
  });

  describe("Revision Tracking", () => {
    it("starts at revision 0 and increments on discrete state updates", () => {
      const odontogram = new Odontogram(container);
      expect(odontogram.getRevision()).toBe(0);

      odontogram.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      expect(odontogram.getRevision()).toBe(1);

      odontogram.setToothState("18", "missing");
      expect(odontogram.getRevision()).toBe(2);

      odontogram.selectTooth("16");
      expect(odontogram.getRevision()).toBe(3);

      odontogram.clearMarks();
      expect(odontogram.getRevision()).toBe(4);
    });

    it("does not increment revision or fire callbacks on identical idempotent setState", () => {
      const marksSetSpy = vi.fn();
      const stateChangeSpy = vi.fn();

      const odontogram = new Odontogram(container, {
        marksSet: marksSetSpy,
        stateDidChange: stateChangeSpy,
      });

      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      });

      expect(odontogram.getRevision()).toBe(1);
      expect(marksSetSpy).toHaveBeenCalledTimes(1);
      expect(stateChangeSpy).toHaveBeenCalledTimes(1);

      // Call setState with identical structure
      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      });

      // Must remain at revision 1 and not fire duplicate callbacks
      expect(odontogram.getRevision()).toBe(1);
      expect(marksSetSpy).toHaveBeenCalledTimes(1);
      expect(stateChangeSpy).toHaveBeenCalledTimes(1);
    });

    it("synchronizes explicit revision passed in SetStateOptions", () => {
      const odontogram = new Odontogram(container);
      expect(odontogram.getRevision()).toBe(0);

      odontogram.setState(
        {
          marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
        },
        { revision: 105, source: "external" },
      );

      expect(odontogram.getRevision()).toBe(105);
    });
  });

  describe("State Change Callbacks & Diffs", () => {
    it("dispatches stateDidChange with accurate changedProperties and previousState", () => {
      let capturedArg: StateChangeArg | null = null;
      const odontogram = new Odontogram(container, {
        stateDidChange: (arg) => {
          capturedArg = arg;
        },
      });

      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
        teeth: { "18": { presence: "missing" } },
      });

      expect(capturedArg).toBeTruthy();
      expect(capturedArg!.revision).toBe(1);
      expect(capturedArg!.source).toBe("internal");
      expect(capturedArg!.changedProperties).toEqual(expect.arrayContaining(["marks", "teeth"]));
      expect(capturedArg!.previousState.marks).toEqual([]);
      expect(capturedArg!.state.marks).toHaveLength(1);
      expect(capturedArg!.state.teeth["18"]?.presence).toBe("missing");
    });

    it("dispatches toothStateDidChange for changed tooth overlay entries", () => {
      const capturedChanges: ToothStateChangeArg[] = [];
      const odontogram = new Odontogram(container, {
        toothStateDidChange: (arg) => {
          capturedChanges.push(arg);
        },
      });

      odontogram.setToothState("16", "missing");
      odontogram.setToothState("26", "unerupted");
      odontogram.setToothState("16", "present");

      expect(capturedChanges).toHaveLength(3);

      expect(capturedChanges[0]).toEqual({
        toothId: "16",
        state: { presence: "missing" },
        previousState: { presence: "present" },
      });

      expect(capturedChanges[1]).toEqual({
        toothId: "26",
        state: { presence: "unerupted" },
        previousState: { presence: "present" },
      });

      expect(capturedChanges[2]).toEqual({
        toothId: "16",
        state: { presence: "present" },
        previousState: { presence: "missing" },
      });
    });
  });

  describe("Controlled mode mutations", () => {
    const imperativeCases: Array<{ label: string; run: (o: Odontogram) => void }> = [
      { label: "addMark", run: (o) => o.addMark({ tooth: "16", surfaces: ["O"], type: "caries" }) },
      { label: "updateMark", run: (o) => o.updateMark("m1", { type: "caries" }) },
      { label: "removeMark", run: (o) => o.removeMark("m1") },
      { label: "setToothState", run: (o) => o.setToothState("16", "missing") },
      { label: "selectTooth", run: (o) => o.selectTooth("16") },
      { label: "clearSelection", run: (o) => o.clearSelection() },
      { label: "batch", run: (o) => o.batch(() => undefined) },
      { label: "pruneOrphanedMarks", run: (o) => o.pruneOrphanedMarks() },
      { label: "changeView", run: (o) => o.changeView("deciduous") },
    ];

    for (const { label, run } of imperativeCases) {
      it(`blocks ${label} with ERR_CONTROLLED_MUTATION`, () => {
        const odontogram = new Odontogram(container, { mode: "controlled" });
        odontogram.setState(
          {
            marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
          },
          { source: "external", revision: 1 },
        );

        expect(() => run(odontogram)).toThrow(OdontogramError);
        try {
          run(odontogram);
        } catch (err) {
          expect(err).toBeInstanceOf(OdontogramError);
          expect((err as OdontogramError).code).toBe(VALIDATION_CODES.ERR_CONTROLLED_MUTATION);
        }
      });
    }

    it("allows setState and reset from the host in controlled mode", () => {
      const stateChangeSpy = vi.fn();
      const odontogram = new Odontogram(container, {
        mode: "controlled",
        stateDidChange: stateChangeSpy,
      });

      odontogram.setState(
        { marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }] },
        { source: "external", revision: 2 },
      );
      expect(odontogram.getMarks()).toHaveLength(1);
      expect(odontogram.getRevision()).toBe(2);

      odontogram.reset();
      expect(odontogram.getMarks()).toHaveLength(0);
      expect(stateChangeSpy).toHaveBeenCalled();
    });

    it("does not change selection on view interaction helpers in controlled mode", () => {
      const plugin = createPlugin({ name: "test", views: [createNoopView()] });
      const odontogram = new Odontogram(container, {
        mode: "controlled",
        selectable: true,
        plugins: [plugin],
        initialView: "permanent",
      });
      odontogram.setState(
        { selection: { teeth: ["11"], surfaces: [] } },
        { source: "external", revision: 1 },
      );

      odontogram.render();
      const ctx = (odontogram as unknown as { viewContext: ViewRenderContext }).viewContext;
      ctx.selectTooth("16");
      expect(odontogram.getSelection().teeth).toEqual(["11"]);
    });
  });

  describe("Revision regression", () => {
    it("throws ERR_REVISION_REGRESSION when incoming revision is lower than current", () => {
      const odontogram = new Odontogram(container);
      odontogram.setState(
        { marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }] },
        { revision: 10, source: "external" },
      );

      expect(() =>
        odontogram.setState(
          { marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }] },
          { revision: 9, source: "external" },
        ),
      ).toThrow(OdontogramError);

      try {
        odontogram.setState({}, { revision: 5, source: "external" });
      } catch (err) {
        expect((err as OdontogramError).code).toBe(VALIDATION_CODES.ERR_REVISION_REGRESSION);
      }
    });
  });

  describe("getMarks filter", () => {
    it("returns marks matching MarkFilter criteria", () => {
      const odontogram = new Odontogram(container);
      odontogram.setState({
        marks: [
          { id: "a", tooth: "16", surfaces: ["O"], type: "caries", status: "existing" },
          { id: "b", tooth: "26", surfaces: ["M"], type: "restoration", status: "planned" },
        ],
      });

      expect(odontogram.getMarks({ tooth: "16" })).toHaveLength(1);
      expect(odontogram.getMarks({ type: "restoration" })[0]?.id).toBe("b");
      expect(odontogram.getMarks({ status: "planned" })).toHaveLength(1);
    });
  });

  describe("batch return value", () => {
    it("returns the value produced by the batch function", () => {
      const odontogram = new Odontogram(container);
      const value = odontogram.batch(() => 42);
      expect(value).toBe(42);
    });
  });

  describe("ViewRenderContext state isolation", () => {
    it("exposes a deep-cloned state snapshot that cannot mutate the store", () => {
      const plugin = createPlugin({ name: "test", views: [createNoopView()] });
      const odontogram = new Odontogram(container, {
        plugins: [plugin],
        initialView: "permanent",
      });
      odontogram.setState({
        marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      });
      odontogram.render();

      const ctx = (odontogram as unknown as { viewContext: ViewRenderContext }).viewContext;
      ctx.state.marks.push({
        id: "evil",
        type: "caries",
        target: { tooth: "11", surfaces: ["O"] },
      });
      expect(odontogram.getMarks()).toHaveLength(1);
    });
  });
});
