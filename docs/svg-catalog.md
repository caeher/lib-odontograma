# SVG tooth catalog

Stage **03** delivers occlusal schematic vector resources for all permanent and primary teeth, plus a manifest and resolver API. The procedural schematic renderer (`schematic-view`) is unchanged — catalog assets are optional art used when composing per-tooth SVG instances.

## Asset layout

See [`packages/svg/resources/catalog/README.md`](../packages/svg/resources/catalog/README.md).

| Dimension | Values |
| --------- | ------ |
| Tooth class | `incisor`, `canine`, `premolar`, `molar` |
| Patient side | `patient-right`, `patient-left` |
| Arch | `maxillary`, `mandibular` |
| Projection | `occlusal` only (v1) |

Sixteen SVG families cover every combination. `manifest.json` maps each of the **52** FDI teeth to a `resourceId` and per-tooth `referenceToothId` for orientation checks.

## API (`@odontogram/svg/catalog`)

```ts
import {
  getManifest,
  getOrientationKey,
  listCatalogFamilies,
  listCatalogResourceIds,
  listTeethForCatalogResource,
  resolveToothSvgResource,
} from "@odontogram/svg/catalog";
```

| Function | Purpose |
| -------- | ------- |
| `getManifest()` | Full manifest (`families` + `teeth`) |
| `getOrientationKey(toothId)` | `patient-{right\|left}.{maxillary\|mandibular}` |
| `resolveToothSvgResource(toothId)` | Manifest entry + relative `resources/` paths |
| `listCatalogFamilies()` | Sixteen family descriptors |
| `listCatalogResourceIds()` | Unique `resourceId` slugs |
| `listTeethForCatalogResource(id)` | FDI ids sharing one family |

Node-only disk loader:

```ts
import { loadCatalogSvgMarkup } from "@odontogram/svg/catalog/node";
```

## Validation

Catalog sidecars include `referenceToothId`. The contract validator checks each `data-face` against `mapSurfaceToFace(referenceToothId, surface)` when that field is present.

```bash
npm run validate:svg
```

This validates the template, contract fixtures, and all catalog SVGs.

## Review gallery

```bash
npm run gallery
```

Opens `examples/svg-gallery` — sixteen family cards, a 52-tooth browser, FDI/class labels, 24/32/44 px scale, and surface highlight on hover/click.

## Regenerating geometry

```bash
npm run generate:catalog -w @odontogram/svg
```

## Related docs

- [SVG contract](svg-contract.md)
- [Resource authoring](svg-resource-authoring.md)
- [Dental review](dental-review.md)
