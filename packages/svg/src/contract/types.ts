import type {
  ClinicalSurface,
  GraphicFace,
  GraphicProjection,
  ToothClass,
} from "@odontogram/dentition";
import type { REQUIRED_ANCHOR_IDS } from "./constants.js";

/** Metadata sidecar for an authored tooth SVG resource. */
export interface ToothSvgMetadata {
  /** Must match {@link SVG_CONTRACT_VERSION} for the installed contract package. */
  contractVersion: string;
  /** Resource slug (filename stem without extension). */
  resourceId: string;
  /** Human-readable title for catalogs and attribution UI. */
  title: string;
  toothClass: ToothClass;
  projection: GraphicProjection;
  viewBox: {
    minX?: number;
    minY?: number;
    width: number;
    height: number;
  };
  /** Optional licensing / attribution block for shipped art. */
  attribution?: {
    author?: string;
    license?: string;
    sourceUrl?: string;
    notice?: string;
  };
  /** Named anchor coordinates in tooth-local viewBox space. */
  anchors?: Partial<Record<(typeof REQUIRED_ANCHOR_IDS)[number], { x: number; y: number }>>;
  /** Editor or pipeline hints (non-normative). */
  editor?: {
    tool?: string;
    template?: string;
  };
  /** FDI tooth used to assign data-face values in this catalog family. */
  referenceToothId?: string;
  /** Catalog orientation family (patient side + arch). */
  orientationKey?: string;
}

export interface ToothSvgValidationOptions {
  /** Metadata sidecar; when omitted, only structural/security rules run. */
  metadata?: ToothSvgMetadata;
  /** Expected contract version (defaults to package {@link SVG_CONTRACT_VERSION}). */
  contractVersion?: string;
}

/** Stable machine-readable rule identifier for CI and authoring tools. */
export type ToothSvgRuleId =
  | "contract.root-element"
  | "contract.viewbox"
  | "contract.metadata.version"
  | "contract.security.no-script"
  | "contract.security.no-external-refs"
  | "contract.layers.present"
  | "contract.layers.order"
  | "contract.ids.unique"
  | "contract.outline.present"
  | "contract.anchors.present"
  | "contract.surfaces.match-class"
  | "contract.surfaces.binding"
  | "contract.geometry.surface-regions"
  | "contract.surfaces.orientation";

export interface ToothSvgValidationIssue {
  ruleId: ToothSvgRuleId;
  message: string;
  /** Optional element id or layer id related to the issue. */
  elementId?: string;
  severity: "error" | "warning";
}

export interface ToothSvgValidationResult {
  valid: boolean;
  ruleIds: ToothSvgRuleId[];
  issues: ToothSvgValidationIssue[];
}

/** Surface region descriptor extracted from an interaction layer element. */
export interface SurfaceRegionBinding {
  surface: ClinicalSurface;
  face: GraphicFace;
  elementId: string;
}
