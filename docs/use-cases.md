# Use Cases

## In scope

This library addresses four core odontogram use cases:

### 1. Display dentition

Render a visual representation of a patient's teeth organized by arch and quadrant. Supported views:

- **Permanent** — 32 adult teeth (FDI quadrants 1–4)
- **Deciduous** — 20 primary teeth (FDI quadrants 5–8)
- **Mixed** — combined permanent and deciduous dentition

Tooth labels can be shown in FDI, Universal, or Palmer notation.

### 2. Select teeth and surfaces

Allow users to click on individual teeth or specific surfaces (M, O, D, B, L) to build a selection. Selection state is tracked in the odontogram instance and exposed via `getState()` and the `selectionDidChange` callback.

### 3. Record odontographic marks and annotations

Attach marks and annotations to teeth, surfaces, or groups of teeth to represent clinical findings, observations, or completed/planned procedures. Marks carry:

- A unique `id` preserving persistent identity across multiple marks on the same tooth
- An extensible `type` string (e.g. `caries`, `restoration`, `crown`, `bridge`, `implant`, `sealant`)
- A semantic lifecycle `status` (e.g. `existing`, `planned`, `completed`, `proposed`)
- A structured `target`:
  - **Surfaces on a single tooth** (e.g., MOD restoration on 16)
  - **An entire single tooth** (e.g., PFM crown on 36, extraction on 48, implant on 46)
  - **A group/range of multiple teeth** (e.g., 3-unit fixed partial denture 14-15-16, mandibular anterior splint 33-43)
- Optional clinician observation or description `text`
- Extensible consumer `metadata` (e.g., material types, lab details, shades, timestamps)
- Optional visual `style` overrides

**Tooth presence** (missing, unerupted) is modeled separately in `state.teeth`, not as mark types. Omitted tooth ids default to present for rendering only.

Marks are pure domain data — they record facts and clinical observations, but do **not** generate automated diagnostic inferences or clinical recommendations.

### 4. Validate structural coexistence

Enforce domain rules and detect incompatible mark combinations before persisting or rendering:

- Enforce mark ID uniqueness
- Verify target structure integrity and prevent duplicate surface codes
- Ensure surface applicability (e.g. Incisal on anterior only, Occlusal on posterior only)
- Detect incompatible coexistence with tooth presence (e.g. surface findings on missing teeth)
- Check custom incompatible mark type combinations with configurable severity levels

### 5. Customize representation

Control how teeth, surfaces, and marks appear through:

- **Options** — colors (`toothColor`, `surfaceColor`, `selectionColor`, `markColors`, `statusColors`), validators
- **Hooks** — `toothClassNames`, `markClassNames`, `toothDidMount`, `markDidMount`
- **Callbacks** — `toothClick`, `surfaceClick`, `selectionDidChange`, `marksSet`, `validationDidChange`

The core API is renderer-agnostic; the SVG plugin provides a schematic default that can be replaced by a custom view plugin.

---

## Explicitly excluded

The following are **out of scope** for this library and should be handled by the host application or separate packages:

| Domain                         | Reason                        |
| ------------------------------ | ----------------------------- |
| Scheduling / appointments      | Not odontogram visualization  |
| Patient management             | Host app responsibility       |
| General clinical records (EHR) | Broader than odontogram marks |
| Billing / invoicing            | Financial domain              |
| Prescriptions                  | Pharmaceutical domain         |
| Automated diagnosis            | Clinical decision support     |
| Built-in backend / persistence | Library is client-side only   |

The library provides `getState()` / `setState()` so host applications can persist odontogram data in their own storage layer.
