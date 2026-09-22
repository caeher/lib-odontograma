import {
  DEFAULT_TOOTH_VIEWBOX,
  SVG_CONTRACT_VERSION,
  CONTRACT_LAYER_IDS,
  REQUIRED_ANCHOR_IDS,
} from "./constants.js";
import { parseSvgMarkup } from "./instance-ids.js";
import {
  extractSurfaceBindings,
  expectedSurfacesForToothClass,
  validateSurfaceSetForClass,
  verifySurfaceFaceBinding,
} from "./surface-binding.js";
import type {
  ToothSvgRuleId,
  ToothSvgValidationIssue,
  ToothSvgValidationOptions,
  ToothSvgValidationResult,
} from "./types.js";

const EXTERNAL_URI = /(?:https?:|ftp:|\/\/|data:(?!image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)))/i;

/**
 * Validate a single-tooth SVG resource against the odontogram SVG contract.
 * Pass optional metadata sidecar for toothClass / viewBox alignment checks.
 */
export function validateToothSvg(
  svgMarkup: string,
  options: ToothSvgValidationOptions = {},
): ToothSvgValidationResult {
  const issues: ToothSvgValidationIssue[] = [];
  const contractVersion = options.contractVersion ?? SVG_CONTRACT_VERSION;

  if (options.metadata && options.metadata.contractVersion !== contractVersion) {
    issues.push({
      ruleId: "contract.metadata.version",
      message: `Metadata contractVersion "${options.metadata.contractVersion}" does not match expected "${contractVersion}"`,
      severity: "error",
    });
  }

  let root: Element;
  try {
    root = parseSvgMarkup(svgMarkup) as unknown as Element;
  } catch (error) {
    issues.push({
      ruleId: "contract.root-element",
      message: error instanceof Error ? error.message : "Failed to parse SVG",
      severity: "error",
    });
    return finalize(issues);
  }

  if (root.localName !== "svg") {
    issues.push({
      ruleId: "contract.root-element",
      message: "Document root must be an svg element",
      severity: "error",
    });
    return finalize(issues);
  }

  validateViewBox(root, options, issues);
  validateSecurity(root, issues);
  validateLayers(root, issues);
  validateUniqueIds(root, issues);
  validateOutline(root, issues);
  validateAnchors(root, options, issues);
  validateSurfaces(root, options, issues);
  validateGeometry(root, issues);

  return finalize(issues);
}

function finalize(issues: ToothSvgValidationIssue[]): ToothSvgValidationResult {
  const ruleIds = [...new Set(issues.map((i) => i.ruleId))];
  return {
    valid: issues.every((i) => i.severity !== "error"),
    ruleIds,
    issues,
  };
}

function validateViewBox(
  root: Element,
  options: ToothSvgValidationOptions,
  issues: ToothSvgValidationIssue[],
): void {
  const viewBox = root.getAttribute("viewBox");
  if (!viewBox) {
    issues.push({
      ruleId: "contract.viewbox",
      message: "Root svg must define a viewBox attribute",
      severity: "error",
    });
    return;
  }

  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    issues.push({
      ruleId: "contract.viewbox",
      message: `viewBox must contain four numbers; got "${viewBox}"`,
      severity: "error",
    });
    return;
  }

  const expected = options.metadata?.viewBox ?? DEFAULT_TOOTH_VIEWBOX;
  const minX = expected.minX ?? 0;
  const minY = expected.minY ?? 0;
  if (
    parts[0] !== minX ||
    parts[1] !== minY ||
    parts[2] !== expected.width ||
    parts[3] !== expected.height
  ) {
    issues.push({
      ruleId: "contract.viewbox",
      message: `viewBox must be "${minX} ${minY} ${expected.width} ${expected.height}"; got "${viewBox}"`,
      severity: "error",
    });
  }
}

function validateSecurity(root: Element, issues: ToothSvgValidationIssue[]): void {
  if (root.querySelector("script")) {
    issues.push({
      ruleId: "contract.security.no-script",
      message: "SVG must not contain script elements",
      severity: "error",
    });
  }

  for (const el of root.querySelectorAll("*")) {
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) {
        issues.push({
          ruleId: "contract.security.no-script",
          message: `Disallowed event handler attribute ${name}`,
          elementId: el.getAttribute("id") ?? undefined,
          severity: "error",
        });
      }
      if (name === "href" || name === "xlink:href") {
        if (value && !value.startsWith("#") && EXTERNAL_URI.test(value)) {
          issues.push({
            ruleId: "contract.security.no-external-refs",
            message: `External href is not allowed: ${value}`,
            elementId: el.getAttribute("id") ?? undefined,
            severity: "error",
          });
        }
      }
      if (name === "style" && /@import|url\(\s*['"]?https?:/i.test(value)) {
        issues.push({
          ruleId: "contract.security.no-external-refs",
          message: "External references in inline style are not allowed",
          elementId: el.getAttribute("id") ?? undefined,
          severity: "error",
        });
      }
    }
  }

  for (const el of root.querySelectorAll("image, use, feImage")) {
    const href =
      el.getAttribute("href") ??
      el.getAttribute("xlink:href") ??
      el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (href && !href.startsWith("#") && EXTERNAL_URI.test(href)) {
      issues.push({
        ruleId: "contract.security.no-external-refs",
        message: `External resource reference is not allowed on ${el.localName}`,
        elementId: el.getAttribute("id") ?? undefined,
        severity: "error",
      });
    }
  }
}

function validateLayers(root: Element, issues: ToothSvgValidationIssue[]): void {
  const layerElements = CONTRACT_LAYER_IDS.map((id) => root.querySelector(`#${id}`));
  for (let i = 0; i < CONTRACT_LAYER_IDS.length; i++) {
    const id = CONTRACT_LAYER_IDS[i];
    if (!layerElements[i]) {
      issues.push({
        ruleId: "contract.layers.present",
        message: `Missing required layer group #${id}`,
        elementId: id,
        severity: "error",
      });
    }
  }

  const directGroups = [...root.children].filter((c) => c.localName === "g");
  const layerOrder = directGroups
    .map((g) => g.getAttribute("id"))
    .filter(
      (id): id is string => id !== null && (CONTRACT_LAYER_IDS as readonly string[]).includes(id),
    );

  if (layerOrder.length > 0) {
    for (let i = 0; i < layerOrder.length; i++) {
      if (layerOrder[i] !== CONTRACT_LAYER_IDS[i]) {
        issues.push({
          ruleId: "contract.layers.order",
          message: `Layer groups must appear as direct children of svg in order: ${CONTRACT_LAYER_IDS.join(", ")}`,
          severity: "error",
        });
        break;
      }
    }
  }
}

function validateUniqueIds(root: Element, issues: ToothSvgValidationIssue[]): void {
  const seen = new Map<string, Element>();
  for (const el of root.querySelectorAll("[id]")) {
    const id = el.getAttribute("id");
    if (!id) continue;
    const prev = seen.get(id);
    if (prev) {
      issues.push({
        ruleId: "contract.ids.unique",
        message: `Duplicate id "${id}"`,
        elementId: id,
        severity: "error",
      });
    } else {
      seen.set(id, el);
    }
  }
}

function validateOutline(root: Element, issues: ToothSvgValidationIssue[]): void {
  const outline = root.querySelector("#tooth-outline");
  if (!outline) {
    issues.push({
      ruleId: "contract.outline.present",
      message: "Anatomy layer must include #tooth-outline (tooth silhouette)",
      severity: "error",
    });
    return;
  }
  const hasGeometry =
    outline.localName === "path" ||
    outline.localName === "rect" ||
    outline.querySelector("path, rect, polygon, circle, ellipse");
  if (!hasGeometry) {
    issues.push({
      ruleId: "contract.outline.present",
      message: "#tooth-outline must contain drawable geometry",
      elementId: "tooth-outline",
      severity: "error",
    });
  }
}

function validateAnchors(
  root: Element,
  options: ToothSvgValidationOptions,
  issues: ToothSvgValidationIssue[],
): void {
  for (const anchorId of REQUIRED_ANCHOR_IDS) {
    const el = root.querySelector(`#${anchorId}`);
    if (!el) {
      issues.push({
        ruleId: "contract.anchors.present",
        message: `Missing required anchor #${anchorId}`,
        elementId: anchorId,
        severity: "error",
      });
    }
  }

  if (options.metadata?.anchors) {
    for (const anchorId of REQUIRED_ANCHOR_IDS) {
      if (!options.metadata.anchors[anchorId]) {
        issues.push({
          ruleId: "contract.anchors.present",
          message: `Metadata sidecar missing coordinates for ${anchorId}`,
          elementId: anchorId,
          severity: "warning",
        });
      }
    }
  }
}

function validateSurfaces(
  root: Element,
  options: ToothSvgValidationOptions,
  issues: ToothSvgValidationIssue[],
): void {
  const bindings = extractSurfaceBindings(root);
  const declared = bindings.map((b) => b.surface);

  if (options.metadata?.toothClass) {
    const check = validateSurfaceSetForClass(declared, options.metadata.toothClass);
    if (!check.ok) {
      if (check.missing.length > 0) {
        issues.push({
          ruleId: "contract.surfaces.match-class",
          message: `Missing interaction surfaces for ${options.metadata.toothClass}: ${check.missing.join(", ")}`,
          severity: "error",
        });
      }
      if (check.extra.length > 0) {
        issues.push({
          ruleId: "contract.surfaces.match-class",
          message: `Unexpected surfaces for ${options.metadata.toothClass}: ${check.extra.join(", ")}`,
          severity: "error",
        });
      }
    }
  }

  for (const binding of bindings) {
    if (!binding.face) {
      issues.push({
        ruleId: "contract.surfaces.binding",
        message: `Surface ${binding.surface} must declare data-face`,
        elementId: binding.elementId,
        severity: "error",
      });
    }
  }

  const expectedForClass = options.metadata?.toothClass
    ? expectedSurfacesForToothClass(options.metadata.toothClass)
    : undefined;
  if (expectedForClass) {
    for (const surface of expectedForClass) {
      const el = root.querySelector(`#layer-interaction [data-surface="${surface}"]`);
      if (!el) {
        issues.push({
          ruleId: "contract.surfaces.match-class",
          message: `Interaction layer missing element for surface ${surface}`,
          severity: "error",
        });
      }
    }
  }

  const referenceToothId = options.metadata?.referenceToothId;
  if (referenceToothId) {
    for (const binding of bindings) {
      if (
        binding.face &&
        !verifySurfaceFaceBinding(referenceToothId, binding.surface, binding.face)
      ) {
        issues.push({
          ruleId: "contract.surfaces.orientation",
          message: `Surface ${binding.surface} data-face="${binding.face}" does not match mapSurfaceToFace for reference tooth ${referenceToothId}`,
          elementId: binding.elementId,
          severity: "error",
        });
      }
    }
  }
}

function validateGeometry(root: Element, issues: ToothSvgValidationIssue[]): void {
  const regions = root.querySelectorAll("#layer-interaction [data-surface]");
  for (const el of regions) {
    const drawable = el.matches("path, rect, polygon, circle, ellipse")
      ? el
      : el.querySelector("path, rect, polygon, circle, ellipse");
    if (!drawable) {
      issues.push({
        ruleId: "contract.geometry.surface-regions",
        message: "Surface region must contain vector geometry",
        elementId: el.getAttribute("id") ?? undefined,
        severity: "error",
      });
      continue;
    }
    if (drawable.localName === "path") {
      const d = drawable.getAttribute("d")?.trim();
      if (!d) {
        issues.push({
          ruleId: "contract.geometry.surface-regions",
          message: "Surface path must define a non-empty d attribute",
          elementId: el.getAttribute("id") ?? undefined,
          severity: "error",
        });
      }
    }
  }
}

export type { ToothSvgRuleId, ToothSvgValidationIssue, ToothSvgValidationResult };
