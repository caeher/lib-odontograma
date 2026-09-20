# Occlusal schematic SVG catalog

Contract v1 vector resources for permanent and primary dentition, using the **occlusal schematic projection** only (buccal/lingual appear as top/bottom faces on the occlusal box per issue #8).

## Layout

```
catalog/
  manifest.json
  {incisor|canine|premolar|molar}/
    patient-{right|left}.{maxillary|mandibular}.occlusal.svg
    patient-{right|left}.{maxillary|mandibular}.occlusal.json
```

- **16 families** — 4 tooth classes × 2 patient sides × 2 arches.
- **52 teeth** — `manifest.json` maps every FDI id to a `resourceId` plus per-tooth `referenceToothId` for runtime orientation checks.
- **Sidecars** — JSON metadata includes `referenceToothId` (canonical authoring tooth for the family), `orientationKey`, Apache-2.0 attribution, and contract fields from the #8 template.

## Regenerating assets

```bash
npm run generate:catalog -w @odontogram/svg
```

The generator derives geometry from `resources/template/tooth-occlusal-schematic.template.svg`, assigns `data-face` via `@odontogram/dentition` `mapSurfaceToFace`, and swaps mesial/distal and buccal/lingual regions per orientation family.

## API

Resolve resources from application code:

```ts
import { resolveToothSvgResource, getManifest } from "@odontogram/svg/catalog";
```

See [docs/svg-catalog.md](../../../docs/svg-catalog.md).

## Review gallery

Run `npm run gallery` from the repository root to open the Vite review UI (`examples/svg-gallery`).
