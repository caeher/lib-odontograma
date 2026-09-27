import type {
  ComplexTarget,
  MarkFilter,
  MarkInput,
  MarkTarget,
  MultiToothTarget,
  OdontographicMark,
  SurfaceId,
  ToothId,
  ToothSurfaceTarget,
  WholeToothTarget,
} from "./types.js";

/** Check if a target specifies surfaces on a single tooth. */
export function isSurfaceTarget(target: MarkTarget): target is ToothSurfaceTarget {
  if (target.kind === "surface" || target.kind === "surfaces") return true;
  return (
    "tooth" in target &&
    typeof (target as ToothSurfaceTarget).tooth === "string" &&
    "surfaces" in target &&
    Array.isArray((target as ToothSurfaceTarget).surfaces)
  );
}

/** Check if a target specifies an entire single tooth without surfaces. */
export function isWholeToothTarget(target: MarkTarget): target is WholeToothTarget {
  if (target.kind === "tooth") return true;
  return (
    "tooth" in target &&
    typeof (target as WholeToothTarget).tooth === "string" &&
    (!("surfaces" in target) || (target as { surfaces?: SurfaceId[] }).surfaces === undefined)
  );
}

/** Check if a target specifies multiple teeth. */
export function isMultiToothTarget(target: MarkTarget): target is MultiToothTarget {
  if (target.kind === "teeth" || target.kind === "group") return true;
  return "teeth" in target && Array.isArray((target as MultiToothTarget).teeth);
}

/** Check if a target specifies complex multi-element targets. */
export function isComplexTarget(target: MarkTarget): target is ComplexTarget {
  if (target.kind === "complex" || target.kind === "elements") return true;
  return "elements" in target && Array.isArray((target as ComplexTarget).elements);
}

/** Check if a mark targets specific surfaces on a single tooth. */
export function isSurfaceMark(mark: OdontographicMark): boolean {
  return isSurfaceTarget(mark.target);
}

/** Check if a mark targets an entire whole tooth. */
export function isWholeToothMark(mark: OdontographicMark): boolean {
  return isWholeToothTarget(mark.target);
}

/** Check if a mark targets multiple teeth. */
export function isMultiToothMark(mark: OdontographicMark): boolean {
  return isMultiToothTarget(mark.target);
}

/** Get all tooth IDs targeted by a mark. */
export function getMarkTargetTeeth(mark: OdontographicMark): ToothId[] {
  const { target } = mark;
  if (isWholeToothTarget(target) || isSurfaceTarget(target)) {
    return [target.tooth];
  }
  if (isMultiToothTarget(target)) {
    return [...target.teeth];
  }
  if (isComplexTarget(target)) {
    const teeth = new Set<ToothId>();
    for (const el of target.elements) {
      teeth.add(el.tooth);
    }
    return Array.from(teeth);
  }
  if (mark.tooth) {
    return [mark.tooth];
  }
  return [];
}

/** Get all surfaces targeted by a mark for a given tooth (or all targeted surfaces if tooth is omitted). */
export function getMarkTargetSurfaces(mark: OdontographicMark, toothId?: ToothId): SurfaceId[] {
  const { target } = mark;
  if (isSurfaceTarget(target)) {
    if (!toothId || target.tooth === toothId) {
      return [...target.surfaces];
    }
    return [];
  }
  if (isComplexTarget(target)) {
    const surfaces: SurfaceId[] = [];
    for (const el of target.elements) {
      if (!toothId || el.tooth === toothId) {
        if (el.surfaces) {
          surfaces.push(...el.surfaces);
        }
      }
    }
    return surfaces;
  }
  if (mark.surfaces && (!toothId || mark.tooth === toothId)) {
    return [...mark.surfaces];
  }
  return [];
}

/** Normalizes a mark target from various input forms into a canonical MarkTarget. */
export function normalizeTarget(input: {
  target?: MarkTarget;
  tooth?: ToothId;
  teeth?: ToothId[];
  surfaces?: SurfaceId[];
}): MarkTarget {
  // If teeth array is provided explicitly, it takes precedence
  if (input.teeth && input.teeth.length > 0) {
    return { kind: "teeth", teeth: [...input.teeth] };
  }

  // If surfaces or tooth are explicitly provided, construct or update surface/tooth target
  if (input.surfaces !== undefined || input.tooth !== undefined) {
    const tooth =
      input.tooth ??
      (input.target && "tooth" in input.target ? (input.target.tooth as ToothId) : undefined);
    if (tooth) {
      const surfaces =
        input.surfaces !== undefined
          ? input.surfaces
          : input.target && "surfaces" in input.target
            ? (input.target.surfaces as SurfaceId[])
            : undefined;

      if (surfaces && surfaces.length > 0) {
        return {
          kind: "surface",
          tooth,
          surfaces: [...surfaces],
        };
      }
      return { kind: "tooth", tooth };
    }
  }

  if (input.target) {
    return input.target;
  }

  if (input.tooth) {
    if (input.surfaces && input.surfaces.length > 0) {
      return {
        kind: "surface",
        tooth: input.tooth,
        surfaces: [...input.surfaces],
      };
    }
    return { kind: "tooth", tooth: input.tooth };
  }

  return { kind: "teeth", teeth: [] };
}

let markSequence = 0;

function generateMarkId(): string {
  markSequence = (markSequence + 1) % 1_000_000;
  return `mark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${markSequence}`;
}

/** Normalizes any MarkInput into a fully-formed canonical OdontographicMark. */
export function normalizeMark<TMetadata = Record<string, unknown>>(
  input: MarkInput<TMetadata>,
): OdontographicMark<TMetadata> {
  const target = normalizeTarget(input);
  const mark: OdontographicMark<TMetadata> = {
    ...(input as Record<string, unknown>),
    id: input.id ?? generateMarkId(),
    type: input.type,
    target,
  };

  if (input.status !== undefined) {
    mark.status = input.status;
  }
  if (input.text !== undefined) {
    mark.text = input.text;
  }
  if (input.metadata !== undefined) {
    mark.metadata = input.metadata;
  }
  if (input.style !== undefined) {
    mark.style = { ...input.style };
  }

  // Populate backward compatibility accessors if applicable
  if (isSurfaceTarget(target)) {
    mark.tooth = target.tooth;
    mark.surfaces = [...target.surfaces];
  } else if (isWholeToothTarget(target)) {
    mark.tooth = target.tooth;
    mark.surfaces = [];
  } else if (input.tooth) {
    mark.tooth = input.tooth;
    if (input.surfaces) {
      mark.surfaces = [...input.surfaces];
    }
  }

  return mark;
}

/** Normalizes an array of mark inputs into canonical OdontographicMark array. */
export function normalizeMarks<TMetadata = Record<string, unknown>>(
  marks: Array<MarkInput<TMetadata>>,
): Array<OdontographicMark<TMetadata>> {
  return marks.map((m) => normalizeMark(m));
}

/** Create a new OdontographicMark with type-safe construction. */
export function createMark<TMetadata = Record<string, unknown>>(
  input: MarkInput<TMetadata>,
): OdontographicMark<TMetadata> {
  return normalizeMark(input);
}

/** Returns true when a mark satisfies all criteria specified on the filter (AND semantics). */
export function markMatchesFilter(mark: OdontographicMark, filter: MarkFilter): boolean {
  if (filter.tooth !== undefined && !getMarkTargetTeeth(mark).includes(filter.tooth)) {
    return false;
  }
  if (filter.type !== undefined && mark.type !== filter.type) {
    return false;
  }
  if (filter.status !== undefined && mark.status !== filter.status) {
    return false;
  }
  return true;
}

/** Return marks from an array that match the optional filter. */
export function filterMarks(marks: OdontographicMark[], filter?: MarkFilter): OdontographicMark[] {
  if (!filter) {
    return marks;
  }
  return marks.filter((m) => markMatchesFilter(m, filter));
}

/** Find all marks that involve a specific tooth (via whole-tooth, surface, or multi-tooth target). */
export function getMarksForTooth(
  marks: OdontographicMark[],
  toothId: ToothId,
): OdontographicMark[] {
  return marks.filter((mark) => {
    const teeth = getMarkTargetTeeth(mark);
    return teeth.includes(toothId);
  });
}

/** Find all marks that target a specific surface on a specific tooth. */
export function getMarksForSurface(
  marks: OdontographicMark[],
  toothId: ToothId,
  surfaceId: SurfaceId,
): OdontographicMark[] {
  return marks.filter((mark) => {
    const surfaces = getMarkTargetSurfaces(mark, toothId);
    return surfaces.includes(surfaceId);
  });
}
