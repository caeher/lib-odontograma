# Occlusal schematic tooth template

Authoring starter for [`docs/svg-contract.md`](../../../docs/svg-contract.md) compliant tooth SVG resources.

## Files

| File | Purpose |
| ---- | ------- |
| `tooth-occlusal-schematic.template.svg` | Molar/posterior occlusal schematic with full layer stack |
| `tooth-occlusal-schematic.template.json` | Metadata sidecar validated by `parseToothSvgMetadata` |

## Incisor / canine variant

Posterior templates declare **`O` (occlusal)** on the center face. Anterior templates must declare **`I` (incisal)** instead:

1. Duplicate the SVG and sidecar.
2. Rename `surface-O` → `surface-I`, set `data-surface="I"`.
3. Set `toothClass` to `incisor` or `canine` in the JSON sidecar.
4. Run `npm run validate:svg -- path/to/your.svg`.

Surface applicability comes from `@odontogram/dentition`; do not hard-code surface lists in SVG.

## Validation

From the repository root:

```bash
npm run validate:svg -- packages/svg/resources/template/tooth-occlusal-schematic.template.svg
```

Pass the sidecar explicitly when validating metadata alignment:

```bash
npm run validate:svg -- --metadata packages/svg/resources/template/tooth-occlusal-schematic.template.json packages/svg/resources/template/tooth-occlusal-schematic.template.svg
```

## Reference orientation

Interaction regions use **`data-face`** values (`left`, `right`, `top`, `bottom`, `center`) that must agree with `mapSurfaceToFace(toothId, surface)` for the target catalog tooth when the asset is instanced. This template uses **FDI `16` (maxillary right first molar)** as the reference quadrant for face labels.

See [`docs/dental-review.md`](../../../docs/dental-review.md) for patient-perspective rules.
