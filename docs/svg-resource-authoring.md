# SVG resource authoring

Workflow for creating tooth vector resources that conform to the [SVG contract](svg-contract.md).

## Prerequisites

- Inkscape, Figma export, or similar SVG editor
- `@odontogram/dentition` surface/orientation rules ([dental-review.md](dental-review.md))
- Local clone of `lib-odontograma`

## Recommended workflow

1. **Copy the template**  
   Start from [`packages/svg/resources/template/tooth-occlusal-schematic.template.svg`](../packages/svg/resources/template/tooth-occlusal-schematic.template.svg) and its [JSON sidecar](../packages/svg/resources/template/tooth-occlusal-schematic.template.json).

2. **Set tooth class**  
   Update the sidecar `toothClass` and surfaces:
   - Posterior: keep `surface-O` (occlusal).
   - Anterior: rename to `surface-I` and `data-surface="I"`.

3. **Pick a reference tooth id**  
   Document which FDI id you used to assign `data-face` values (e.g. `16` for the template). Verify with `mapSurfaceToFace(referenceId, surface)`.

4. **Preserve layers**  
   Do not flatten the five layer groups. Put new anatomy only in `#layer-anatomy`, hit targets in `#layer-interaction`.

5. **Name resources**
   - SVG: `{resource-id}.svg` (lowercase, dots/hyphens)
   - Sidecar: same stem + `.json`
   - `resourceId` in JSON must match the stem.

6. **Validate**

   ```bash
   npm run validate:svg -- packages/svg/resources/template/tooth-occlusal-schematic.template.svg
   ```

   Auto-discovers a sibling `.json` sidecar when `--metadata` is omitted.

7. **Optimize safely**  
   Run SVGO with the preserve list from [svg-contract.md](svg-contract.md). Re-run validation after optimization.

8. **License and attribution**  
   Record `attribution` in the sidecar (author, license, source URL, notice). Ship editable sources in-repo; see [attributions.md](attributions.md) for project-level notices.

## Naming conventions

| Artifact        | Convention                                          |
| --------------- | --------------------------------------------------- |
| Layer groups    | Fixed ids `layer-anatomy`, …                        |
| Surfaces        | `surface-M`, `surface-O` or `surface-I`, …          |
| Anchors         | `anchor-center`, `anchor-mesial`, `anchor-distal`   |
| Outline         | `tooth-outline`                                     |
| Instance prefix | `{fdi}-` or `{instanceId}-` applied at compose time |

## Licensing

- Prefer **Apache-2.0** for project-contributed schematic art (matches repository license).
- Third-party anatomy must include compatible license text in the sidecar and [attributions.md](attributions.md).
- Do not embed stock assets with conflicting “no derivative” terms without legal review.

## Catalog placement

Validated catalog assets live under `packages/svg/resources/catalog/` (16 orientation families, 52-tooth manifest). See [svg-catalog.md](svg-catalog.md) and the [catalog README](../packages/svg/resources/catalog/README.md).

## See also

- [SVG catalog](svg-catalog.md)
- [Architecture — SVG renderer](architecture.md#svg-renderer-odontogramsvg)
- [Feature matrix — Stage 03](feature-matrix.md)
- [API — `@odontogram/svg/contract`](api.md#odontogramsvgcontract)
- [API — `@odontogram/svg/catalog`](api.md#odontogramsvgcatalog)
