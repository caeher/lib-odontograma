import type { OdontogramOptions, OdontogramState } from "./types.js";

export const DEFAULT_OPTIONS: Required<
  Pick<OdontogramOptions, "initialView" | "notation" | "height" | "selectable" | "toothColor" | "surfaceColor" | "selectionColor">
> = {
  initialView: "permanent",
  notation: "fdi",
  height: 400,
  selectable: true,
  toothColor: "#f5f5f5",
  surfaceColor: "#e0e0e0",
  selectionColor: "#90caf9",
};

export function createDefaultState(initialView: string): OdontogramState {
  return {
    view: initialView,
    marks: [],
    selection: { teeth: [], surfaces: [] },
  };
}
