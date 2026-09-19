import { SVG_CONTRACT_VERSION } from "./constants.js";
import type { ToothSvgMetadata } from "./types.js";

export class ToothSvgMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToothSvgMetadataError";
  }
}

/** Parse and normalize JSON metadata sidecar content. */
export function parseToothSvgMetadata(raw: unknown): ToothSvgMetadata {
  if (typeof raw !== "object" || raw === null) {
    throw new ToothSvgMetadataError("Metadata must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  const contractVersion = readString(obj, "contractVersion");
  const resourceId = readString(obj, "resourceId");
  const title = readString(obj, "title");
  const toothClass = readToothClass(obj, "toothClass");
  const projection = readProjection(obj, "projection");
  const viewBox = readViewBox(obj.viewBox);

  const metadata: ToothSvgMetadata = {
    contractVersion,
    resourceId,
    title,
    toothClass,
    projection,
    viewBox,
  };

  if (obj.attribution !== undefined) {
    metadata.attribution = readAttribution(obj.attribution);
  }
  if (obj.anchors !== undefined) {
    metadata.anchors = readAnchors(obj.anchors);
  }
  if (obj.editor !== undefined) {
    metadata.editor = readEditor(obj.editor);
  }

  return metadata;
}

/** Parse metadata from a JSON string (sidecar file contents). */
export function parseToothSvgMetadataJson(json: string): ToothSvgMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new ToothSvgMetadataError("Metadata sidecar is not valid JSON");
  }
  return parseToothSvgMetadata(parsed);
}

/** Whether metadata contractVersion matches the installed contract package. */
export function isMetadataVersionCompatible(
  metadata: ToothSvgMetadata,
  expectedVersion: string = SVG_CONTRACT_VERSION,
): boolean {
  return metadata.contractVersion === expectedVersion;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToothSvgMetadataError(`Metadata field "${key}" must be a non-empty string`);
  }
  return value;
}

function readToothClass(obj: Record<string, unknown>, key: string): ToothSvgMetadata["toothClass"] {
  const value = obj[key];
  if (value !== "incisor" && value !== "canine" && value !== "premolar" && value !== "molar") {
    throw new ToothSvgMetadataError(`Metadata field "${key}" must be a valid toothClass`);
  }
  return value;
}

function readProjection(
  obj: Record<string, unknown>,
  key: string,
): ToothSvgMetadata["projection"] {
  const value = obj[key];
  if (value !== "occlusal") {
    throw new ToothSvgMetadataError(`Metadata field "${key}" must be "occlusal" (only projection in v1)`);
  }
  return value;
}

function readViewBox(value: unknown): ToothSvgMetadata["viewBox"] {
  if (typeof value !== "object" || value === null) {
    throw new ToothSvgMetadataError("Metadata viewBox must be an object");
  }
  const vb = value as Record<string, unknown>;
  const width = readNumber(vb, "width");
  const height = readNumber(vb, "height");
  const minX = vb.minX !== undefined ? readNumber(vb, "minX") : 0;
  const minY = vb.minY !== undefined ? readNumber(vb, "minY") : 0;
  return { minX, minY, width, height };
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToothSvgMetadataError(`Metadata field "${key}" must be a finite number`);
  }
  return value;
}

function readAttribution(value: unknown): NonNullable<ToothSvgMetadata["attribution"]> {
  if (typeof value !== "object" || value === null) {
    throw new ToothSvgMetadataError("Metadata attribution must be an object");
  }
  const a = value as Record<string, unknown>;
  return {
    author: optionalString(a.author),
    license: optionalString(a.license),
    sourceUrl: optionalString(a.sourceUrl),
    notice: optionalString(a.notice),
  };
}

function readAnchors(value: unknown): NonNullable<ToothSvgMetadata["anchors"]> {
  if (typeof value !== "object" || value === null) {
    throw new ToothSvgMetadataError("Metadata anchors must be an object");
  }
  const anchors: NonNullable<ToothSvgMetadata["anchors"]> = {};
  for (const [key, point] of Object.entries(value)) {
    if (typeof point !== "object" || point === null) continue;
    const p = point as Record<string, unknown>;
    if (typeof p.x === "number" && typeof p.y === "number") {
      anchors[key as keyof typeof anchors] = { x: p.x, y: p.y };
    }
  }
  return anchors;
}

function readEditor(value: unknown): NonNullable<ToothSvgMetadata["editor"]> {
  if (typeof value !== "object" || value === null) {
    throw new ToothSvgMetadataError("Metadata editor must be an object");
  }
  const e = value as Record<string, unknown>;
  return {
    tool: optionalString(e.tool),
    template: optionalString(e.template),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
