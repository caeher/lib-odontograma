import {
  getAnatomicalArch,
  getToothQuadrant,
  getTooth,
  isPatientRightQuadrant,
  type ArchId,
  type QuadrantId,
  type ToothId,
} from "@odontogram/dentition";
import type { OrientationKey, PatientSide } from "./types.js";

export function getOrientationKey(toothId: ToothId): OrientationKey {
  const tooth = getTooth(toothId);
  if (!tooth) {
    throw new Error(`Unknown tooth id: ${toothId}`);
  }
  const quadrant = (getToothQuadrant(toothId) ?? tooth.quadrant) as QuadrantId;
  const arch: ArchId = getAnatomicalArch(toothId) ?? tooth.arch;
  const side: PatientSide = isPatientRightQuadrant(quadrant) ? "patient-right" : "patient-left";
  const key = `${side}.${arch}` as OrientationKey;
  return key;
}
