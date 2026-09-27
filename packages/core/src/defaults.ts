import type { OdontogramOptions, OdontogramState, ToothId, ToothPresence } from "./types.js";

export const DEFAULT_OPTIONS: Required<
  Pick<
    OdontogramOptions,
    | "mode"
    | "initialView"
    | "notation"
    | "width"
    | "height"
    | "selectable"
    | "disabled"
    | "toothColor"
    | "surfaceColor"
    | "selectionColor"
  >
> = {
  mode: "internal",
  initialView: "permanent",
  notation: "fdi",
  width: "100%",
  height: 400,
  selectable: true,
  disabled: false,
  toothColor: "#f5f5f5",
  surfaceColor: "#e0e0e0",
  selectionColor: "#90caf9",
};

export function createDefaultState(initialView: string): OdontogramState {
  return {
    view: initialView,
    marks: [],
    selection: { teeth: [], surfaces: [] },
    teeth: {},
  };
}

/**
 * Resolve tooth presence from state overlay.
 * Omitted ids are treated as present for rendering only — not as missing or unerupted.
 */
export function getToothPresence(
  teeth: Record<ToothId, { presence: ToothPresence }>,
  toothId: ToothId,
): ToothPresence {
  return teeth[toothId]?.presence ?? "present";
}
