# Dental Model Review

This document accompanies the canonical dental model in `@odontogram/dentition`. It records terminology, catalog structure, orientation rules, and the professional review gate before identifiers are considered stabilized.

## Review status

**Status: pending professional sign-off**

Identifiers, surface assignments, and orientation rules in this release are **not stabilized** until reviewed and signed off by a licensed dental professional. See the checklist at the end of this document.

## Glossary

| Term                 | Definition                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Tooth**            | A catalog entry identified by FDI two-digit string (e.g. `"16"`, `"55"`).                        |
| **Dentition**        | `"permanent"` (adult) or `"primary"` (deciduous). Distinct FDI quadrant ranges; not age-derived. |
| **Arch**             | `"maxillary"` (upper) or `"mandibular"` (lower). Layout alias: `"upper"` / `"lower"`.            |
| **Quadrant**         | FDI quadrant digit: `1–4` permanent, `5–8` primary.                                              |
| **Position**         | Tooth position within quadrant: `1–8` permanent, `1–5` primary.                                  |
| **Clinical surface** | Anatomical surface code: `M`, `O`, `I`, `D`, `B`, `L`.                                           |
| **Graphic face**     | Schematic box region: `left`, `right`, `top`, `bottom`, `center`. Not a clinical surface.        |
| **Presence**         | Chart overlay: `present`, `missing`, or `unerupted`. Omitted ids are **not** missing.            |

## Catalogs

Committed fixtures (golden references):

- [`packages/dentition/fixtures/permanent.json`](../packages/dentition/fixtures/permanent.json) — 32 permanent teeth
- [`packages/dentition/fixtures/primary.json`](../packages/dentition/fixtures/primary.json) — 20 primary teeth
- [`packages/dentition/fixtures/notations.json`](../packages/dentition/fixtures/notations.json) — 52-tooth multi-notation mapping table (FDI, Universal, Palmer symbol & accessible)
- [`packages/dentition/fixtures/mixed-coexistence.json`](../packages/dentition/fixtures/mixed-coexistence.json) — successor pairs without replacement
- [`packages/dentition/fixtures/orientation.json`](../packages/dentition/fixtures/orientation.json) — clinical surface → graphic face samples

### Applicable surfaces by tooth class

| Tooth class     | Surfaces      |
| --------------- | ------------- |
| Incisor, canine | M, I, D, B, L |
| Premolar, molar | M, O, D, B, L |

Incisors use **incisal (`I`)**, not occlusal (`O`). Posterior teeth use occlusal only.

### Mixed dentition coexistence

Mixed dentition is the **union** of permanent and primary catalogs (52 ids). Primary tooth `55` and permanent successor `15` are independent ids. Successor/predecessor links are metadata only — no age-based replacement.

Example successor pairs:

| Primary | Permanent successor |
| ------- | ------------------- |
| 55      | 15                  |
| 51      | 11                  |
| 85      | 45                  |
| 71      | 31                  |

## Numbering systems and notation adapters

The library guarantees canonical identity: all internal state (`marks`, `selection`, `teeth`) and event callbacks (`toothClick`, `surfaceClick`) use **canonical FDI two-digit strings** (e.g. `"16"`, `"55"`). Numbering system options (`"fdi" | "universal" | "palmer"`) are presentation-layer transformations only.

### Numbering system specifications

1. **FDI World Dental Federation (ISO 3950)**:
   - Quadrant digit (1–4 permanent, 5–8 primary) + position digit (1–8 permanent, 1–5 primary).
   - Serves as the library's canonical tooth identifier.
2. **Universal Numbering System (ADA)**:
   - Permanent: 1–32 starting from maxillary right third molar (`18` = `1`) clockwise to mandibular right third molar (`48` = `32`).
   - Deciduous / primary: A–T starting from maxillary right second primary molar (`55` = `A`) clockwise to mandibular right second primary molar (`85` = `T`).
   - Parsing is case-insensitive for letters A–T.
3. **Palmer Notation Method**:
   - Quadrant corner bracket symbol enclosing tooth position (`1–8` for permanent, `A–E` for primary).
   - Corner symbols represent quadrant position relative to the midline (vertical bar) and occlusal plane (horizontal bar):
     - **Upper Right (Q1 / Q5)**: Corner at bottom-right of tooth number (`8┘`..`1┘`, `E┘`..`A┘`).
     - **Upper Left (Q2 / Q6)**: Corner at bottom-left of tooth number (`└1`..`└8`, `└A`..`└E`).
     - **Lower Left (Q3 / Q7)**: Corner at top-left of tooth number (`┌1`..`┌8`, `┌A`..`┌E`).
     - **Lower Right (Q4 / Q8)**: Corner at top-right of tooth number (`1┐`..`8┐`, `A┐`..`E┐`).
   - **Accessible ASCII representation**: For screen readers, text environments, and keyboard entry, two-letter quadrant abbreviations are standardized:
     - Upper Right: `UR1`–`UR8` (permanent), `URA`–`URE` (primary).
     - Upper Left: `UL1`–`UL8` (permanent), `ULA`–`ULE` (primary).
     - Lower Left: `LL1`–`LL8` (permanent), `LLA`–`LLE` (primary).
     - Lower Right: `LR1`–`LR8` (permanent), `LRA`–`LRE` (primary).
   - Parsing supports quadrant grid glyphs, corner brackets (`⏌`, `⎿`, `⎾`, `⏋`), prefix/suffix variations, and ASCII quadrant codes (`UR1`, `[UR] 1`, `ur-1`).
   - Ambiguous inputs lacking quadrant context (e.g. `"1"` or `"A"`) are strictly rejected (`null`).

### Behavior for teeth outside the standard catalog

- Standard catalog contains 52 canonical entries (32 permanent, 20 primary).
- Unrecognized or out-of-catalog identifier strings (e.g. supernumerary teeth, FDI `"91"`, Universal `"33"` / `"99"`, Palmer `"UR9"` / `"XYZ"`):
  - **Parsing (`fromNotation`)**: Returns `null` when input cannot be resolved to a catalog tooth ID.
  - **Formatting (`toNotation`)**: Returns the input string unmodified as a safe fallback when passed an uncataloged ID.
  - Host applications requiring supernumerary tooth tracking should model non-catalog findings via mark metadata or custom plugins.

## Orientation rules (occlusal schematic)

Patient faces the viewer; patient's right appears on screen left.

1. **Mesial / distal** — Mesial toward arch midline; horizontal flip by patient side (quadrants 1/4/5/8 vs 2/3/6/7).
2. **Buccal / lingual** — Buccal toward vestibule; vertical flip by arch (maxillary vs mandibular).
3. **Occlusal / incisal** — Both map to graphic `center`.

API: `mapSurfaceToFace(toothId, surface)` in `@odontogram/dentition`.

Authoring and validation of vector tooth assets (layers, surface binding, security rules) are specified in [`svg-contract.md`](svg-contract.md) and [`svg-resource-authoring.md`](svg-resource-authoring.md). Clinical surface lists remain authoritative in this document and in `@odontogram/dentition` — not duplicated in SVG sources.

## Presence model

Tooth presence is stored in `OdontogramState.teeth` as a sparse overlay:

```ts
teeth: {
  "16": { presence: "missing" },
  "26": { presence: "unerupted" },
}
```

- Omitted ids default to `"present"` for rendering only.
- Omission does **not** mean missing or unerupted.
- Marks represent findings/procedures, not absence.

## Structural coexistence rules and validation

The odontogram model enforces clinical and structural coexistence gates via configurable validators:

1. **Surface Applicability**:
   - Anterior teeth (`positions 1–3`): Applicable surfaces are `M, I, D, B, L`. Occlusal (`O`) is strictly forbidden.
   - Posterior teeth (`positions 4–8`): Applicable surfaces are `M, O, D, B, L`. Incisal (`I`) is strictly forbidden.
2. **Tooth Presence Coexistence**:
   - A `missing` tooth cannot have active surface findings (e.g. caries, composite restorations).
   - An `unerupted` tooth cannot have surface restorations or caries.
3. **Identity & Target Integrity**:
   - Mark `id` strings must be unique across state.
   - Surface marks cannot duplicate surface codes on the same tooth (e.g. `["M", "O", "M"]`).
   - Multi-tooth marks (e.g. bridges, splints) must specify a non-empty array of valid teeth.
4. **Mark Type Incompatibility**:
   - Consumers can configure mutually exclusive concurrent marks (e.g. `["implant", "natural-root"]`).

## Professional review checklist

- [ ] FDI quadrant and position assignments match ISO 3950
- [ ] Permanent catalog complete (32 teeth)
- [ ] Primary catalog complete (20 teeth)
- [ ] Successor/predecessor map clinically accurate
- [ ] Applicable surfaces by tooth class approved
- [ ] Structural coexistence rules (anterior/posterior surface validity, missing tooth coexistence) reviewed
- [ ] Multi-surface restoration, whole-tooth mark, and multi-tooth annotation serialization examples reviewed
- [ ] Mesial/distal orientation rules verified for all quadrants
- [ ] Buccal/lingual orientation rules verified for both arches
- [ ] Numbering systems conversion tables (FDI, Universal, Palmer) verified
- [ ] Palmer quadrant glyph orientation and ASCII accessible representations approved
- [ ] Out-of-catalog rejection contract reviewed
- [ ] SVG catalog families (16) and 52-tooth manifest reviewed ([svg-catalog.md](svg-catalog.md))
- [ ] Occlusal schematic surface labels verified in review gallery (`npm run gallery`)
- [ ] Terminology (primary vs deciduous, vestibular/buccal, palatal/lingual) approved
- [ ] Reviewer name, credentials, and date recorded below

### Sign-off

| Reviewer  | Credentials | Date      | Notes     |
| --------- | ----------- | --------- | --------- |
| _pending_ | _pending_   | _pending_ | _pending_ |

## Regenerating fixtures

After catalog changes, regenerate fixtures and re-run tests:

```bash
cd packages/dentition
npx tsx scripts/generate-fixtures.mts
npm test
```
