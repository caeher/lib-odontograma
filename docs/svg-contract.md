# SVG tooth resource contract (normative)

This document specifies the **tooth SVG resource contract** implemented by `@odontogram/svg/contract` (version **1.0.0**). It governs reusable vector assets for odontogram rendering: schematic occlusal cells today, anatomical assets in later stages.

Related documents:

- [SVG resource authoring workflow](svg-resource-authoring.md)
- [Dental model & orientation](dental-review.md)
- [Architecture](architecture.md)
- [API reference](api.md) — contract exports

## Terms

| Term                 | Definition                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Tooth resource**   | One SVG file describing a single tooth projection (e.g. occlusal schematic).          |
| **Metadata sidecar** | JSON file paired with the SVG (`*.json`) validated by `parseToothSvgMetadata`.        |
| **Clinical surface** | Code `M`, `O`, `I`, `D`, `B`, `L` from `@odontogram/dentition`.                       |
| **Graphic face**     | Schematic region `left`, `right`, `top`, `bottom`, `center` — not a clinical surface. |
| **Instance prefix**  | String prepended to every `id` when composing multiple teeth (see Instance IDs).      |
| **Layer**            | Top-level `<g>` group with a contract layer id.                                       |

**Source of truth:** Applicable surfaces and clinical→graphic mapping live in `@odontogram/dentition`. The SVG package validates binding but does not duplicate surface rules.

## Coordinate system, viewBox, and scale

- Root `<svg>` **must** declare `viewBox="0 0 44 52"` unless the metadata sidecar documents an equivalent box (same width/height as the schematic renderer cell in `@odontogram/svg`).
- One user unit equals one pixel at 1× scale; authors should keep geometry inside the viewBox.
- The schematic renderer uses a **6px inset** from the tooth box edge to the occlusal/incisal center region (`SCHEMATIC_SURFACE_INSET` in contract constants).

## Layer stack (document order)

Direct children of the root `<svg>` must appear **in this order**:

1. `#layer-anatomy` — silhouette, anchors, non-interactive anatomy
2. `#layer-interaction` — clickable surface regions (`data-surface`, `data-face`)
3. `#layer-focus` — focus ring / keyboard focus visuals (may be empty)
4. `#layer-marks` — mark overlays drawn by the engine (may be empty in source art)
5. `#layer-labels` — notation labels and static text

Each layer is a `<g id="layer-…">` group. Renderers may hide or reparent layers but must preserve ids through optimization (see below).

## Surface binding

### Clinical attributes

Every interactive surface region in `#layer-interaction` must:

- Be wrapped in a group (or equivalent) with **`data-surface`** set to a clinical code.
- Declare **`data-face`** with the graphic face that region occupies for the **reference tooth** used when authoring the asset.
- Use stable element ids `surface-{M|O|I|D|B|L}` before instance prefixing.
- Contain vector geometry (`path`, `rect`, `polygon`, `circle`, or `ellipse`).

### Tooth class applicability

| Tooth class     | Required `data-surface` codes |
| --------------- | ----------------------------- |
| Incisor, canine | `M`, `I`, `D`, `B`, `L`       |
| Premolar, molar | `M`, `O`, `D`, `B`, `L`       |

Incisors use **incisal (`I`)** on the center face; posteriors use **occlusal (`O`)**. The shipped molar template demonstrates `O`; incisor assets swap `surface-O` → `surface-I`.

Validation uses `getApplicableSurfacesForClass` from dentition — not hard-coded lists in SVG.

### Patient perspective and `mapSurfaceToFace`

Orientation follows [dental-review.md](dental-review.md): patient faces the viewer; patient’s right is screen left. For a catalog tooth id `T` and clinical surface `S`, authored `data-face` must equal:

```ts
mapSurfaceToFace(T, S, "occlusal");
```

Authoring templates often use a **reference tooth id** (e.g. `16` for maxillary right posterior) documented in the resource README. At runtime, engines map the same faces for other teeth by applying dentition rules when instancing art per FDI id.

## Outline and anchors

- `#tooth-outline` in `#layer-anatomy` defines the clickable tooth silhouette.
- Required anchor ids (for labels, focus, and future symbols):
  - `#anchor-center`
  - `#anchor-mesial`
  - `#anchor-distal`

Sidecar metadata may duplicate anchor coordinates under `anchors` for tooling.

## Instance ID prefixing

When multiple tooth resources compose one SVG document, call `prefixElementIds(markup, { prefix })` from `@odontogram/svg/contract`:

- Prefix every element `id` (`surface-M` → `{prefix}surface-M`).
- Rewrite internal `href="#…"` and `url(#…)` references.

Prefixes must be non-empty and unique per mounted instance (e.g. `t16-`, `inst-abc-`).

## Accessibility

- Root SVG should include `role="img"` and an accessible name via `<title>` or `aria-label`.
- Surface groups should expose **`aria-label`** with the clinical surface name (Mesial, Occlusal, …).
- Decorative template labels may use `aria-hidden="true"`.
- Do not rely on color alone for state; focus layer holds focus indicators.

## Security

Resources must be safe for inline embedding:

- **No** `<script>` elements or `on*` event attributes.
- **No** external references (`http:`, `https:`, `//`, or non-image `data:`) in `href`, `xlink:href`, `image`, `use`, or `@import` in styles.
- Validator rule ids: `contract.security.no-script`, `contract.security.no-external-refs`.

## Optimization preserve list

SVGO and similar optimizers **must not** remove or merge:

- Layer group ids (`layer-anatomy`, …)
- `id`, `class`, `data-surface`, `data-face`, `data-role`
- `aria-label`, `aria-hidden`, `role`
- `viewBox`
- Surface ids `surface-*` and anchors

See `OPTIMIZATION_PRESERVE_LIST` in `@odontogram/svg/contract`.

## Metadata sidecar

JSON schema: [`packages/svg/schema/tooth-svg-metadata.schema.json`](../packages/svg/schema/tooth-svg-metadata.schema.json).

Required fields: `contractVersion`, `resourceId`, `title`, `toothClass`, `projection`, `viewBox`.

`contractVersion` must match `SVG_CONTRACT_VERSION` from the contract package.

## Validation

Programmatic validation:

```ts
import { validateToothSvg, parseToothSvgMetadataJson } from "@odontogram/svg/contract";
```

CLI (monorepo root):

```bash
npm run validate:svg -- --metadata path/to/meta.json path/to/tooth.svg
```

Stable **`ruleId`** values include:

| ruleId                               | Meaning                            |
| ------------------------------------ | ---------------------------------- |
| `contract.root-element`              | Parseable SVG root                 |
| `contract.viewbox`                   | viewBox matches metadata / default |
| `contract.metadata.version`          | Sidecar version mismatch           |
| `contract.security.no-script`        | Scripts or event handlers          |
| `contract.security.no-external-refs` | External URLs                      |
| `contract.layers.present`            | Required layers exist              |
| `contract.layers.order`              | Layer order on root                |
| `contract.ids.unique`                | Duplicate ids                      |
| `contract.outline.present`           | `#tooth-outline` geometry          |
| `contract.anchors.present`           | Required anchors                   |
| `contract.surfaces.match-class`      | Surfaces vs `toothClass`           |
| `contract.surfaces.binding`          | Missing `data-face`                |
| `contract.geometry.surface-regions`  | Empty or missing paths             |

Fixtures: [`packages/svg/fixtures/contract/`](../packages/svg/fixtures/contract/).

## Versioning

Contract version **1.0.0** ships with Stage 03 issue #8. Breaking changes increment `SVG_CONTRACT_VERSION` and the JSON schema `contractVersion` const.
