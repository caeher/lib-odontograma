import { describe, expect, it, vi } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import { VALIDATION_CODES } from "./errors.js";
import type { ViewRenderContext } from "./types.js";

describe("selection mark commands", () => {
  it("applies type and status to the full selection in one commit", () => {
    const stateChanges = vi.fn();
    const odontogram = new Odontogram(null, { stateDidChange: stateChanges });
    odontogram.setSelection({
      surfaces: [
        { tooth: "16", surface: "O" },
        { tooth: "26", surface: "M" },
      ],
    });
    stateChanges.mockClear();
    const revision = odontogram.getRevision();

    const result = odontogram.executeCommand({
      type: "apply-mark",
      mark: { type: "restoration", status: "planned", text: "Composite" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.marks).toHaveLength(1);
    expect(result.marks[0]).toMatchObject({
      type: "restoration",
      status: "planned",
      target: {
        kind: "complex",
        elements: [
          { tooth: "16", surfaces: ["O"] },
          { tooth: "26", surfaces: ["M"] },
        ],
      },
    });
    expect(odontogram.getRevision()).toBe(revision + 1);
    expect(stateChanges).toHaveBeenCalledTimes(1);
  });

  it("edits and deletes only the requested mark", () => {
    const odontogram = new Odontogram();
    odontogram.addMarks([
      { id: "m1", tooth: "16", surfaces: ["O"], type: "caries" },
      { id: "m2", tooth: "26", type: "crown" },
    ]);
    odontogram.setSelection({ annotations: ["m1"] });

    const edited = odontogram.executeCommand({
      type: "edit-mark",
      markId: "m2",
      patch: { status: "completed", text: "Fitted" },
    });
    expect(edited.ok).toBe(true);
    expect(odontogram.getMark("m2")).toMatchObject({ status: "completed", text: "Fitted" });
    expect(odontogram.getMark("m1")?.type).toBe("caries");

    const deleted = odontogram.executeCommand({ type: "delete-mark", markId: "m1" });
    expect(deleted.ok).toBe(true);
    expect(odontogram.hasMark("m1")).toBe(false);
    expect(odontogram.getSelection().annotations ?? []).toEqual([]);
  });

  it("rejects invalid, vetoed, and locked multi-target actions without partial commits", () => {
    const veto = vi.fn(() => false);
    const odontogram = new Odontogram(null, { beforeMarkCommand: veto });
    odontogram.setSelection({ teeth: ["16", "26"] });
    let revision = odontogram.getRevision();
    const vetoed = odontogram.executeCommand({ type: "apply-mark", mark: { type: "crown" } });
    expect(vetoed).toMatchObject({
      ok: false,
      cancelled: true,
      code: VALIDATION_CODES.ERR_COMMAND_CANCELLED,
    });
    expect(odontogram.getMarks()).toHaveLength(0);
    expect(odontogram.getRevision()).toBe(revision);

    odontogram.setOption("beforeMarkCommand", undefined);
    odontogram.setOption("lockedTeeth", ["26"]);
    revision = odontogram.getRevision();
    const locked = odontogram.executeCommand({ type: "apply-mark", mark: { type: "crown" } });
    expect(locked).toMatchObject({
      ok: false,
      cancelled: true,
      code: VALIDATION_CODES.ERR_COMMAND_LOCKED_TARGET,
    });
    expect(odontogram.getMarks()).toHaveLength(0);
    expect(odontogram.getRevision()).toBe(revision);

    odontogram.setOption("lockedTeeth", []);
    odontogram.addMark({ id: "locked-mark", tooth: "16", type: "crown" });
    odontogram.setOption("lockedTeeth", ["16"]);
    const lockedDelete = odontogram.executeCommand({ type: "delete-mark", markId: "locked-mark" });
    expect(lockedDelete).toMatchObject({ ok: false, cancelled: true });
    expect(odontogram.hasMark("locked-mark")).toBe(true);

    odontogram.setOption("lockedTeeth", []);
    odontogram.setSelection({ surfaces: [{ tooth: "11", surface: "O" }] });
    const invalid = odontogram.executeCommand({ type: "apply-mark", mark: { type: "caries" } });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok)
      expect(invalid.issues?.some((issue) => issue.code === "ERR_INAPPLICABLE_SURFACE")).toBe(true);
    expect(odontogram.getMarks().map((mark) => mark.id)).toEqual(["locked-mark"]);
  });

  it("readOnly blocks chart selection while preserving queries and allowing imperative commands", () => {
    let viewContext: ViewRenderContext | undefined;
    const odontogram = new Odontogram(document.createElement("div"), {
      initialView: "permanent",
      readOnly: true,
      plugins: [
        createPlugin({
          name: "capture",
          views: [
            {
              type: "permanent",
              render: (context) => {
                viewContext = context;
              },
            },
          ],
        }),
      ],
    });
    odontogram.setSelection({ teeth: ["16"] });
    odontogram.render();
    viewContext?.selectTooth("26");
    expect(odontogram.getSelection().teeth).toEqual(["16"]);
    expect(odontogram.getMarks()).toEqual([]);

    const result = odontogram.executeCommand({ type: "apply-mark", mark: { type: "crown" } });
    expect(result.ok).toBe(true);
    expect(odontogram.getMarksForTooth("16")).toHaveLength(1);
  });
});
