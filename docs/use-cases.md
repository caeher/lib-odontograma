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

### 3. Record odontographic marks

Attach marks to teeth and surfaces to represent clinical findings or procedures. Marks carry:

- A unique `id`
- Target `tooth` (canonical FDI id)
- One or more `surfaces`
- A `type` string (e.g. `caries`, `restoration`, `missing`)
- Optional visual `style` overrides

Marks are part of odontogram state and can be serialized via `getState()`.

### 4. Customize representation

Control how teeth, surfaces, and marks appear through:

- **Options** — colors (`toothColor`, `surfaceColor`, `selectionColor`, `markColors`)
- **Hooks** — `toothClassNames`, `markClassNames`, `toothDidMount`, `markDidMount`
- **Callbacks** — `toothClick`, `surfaceClick`, `selectionDidChange`, `marksSet`

The core API is renderer-agnostic; the SVG plugin provides a schematic default that can be replaced by a custom view plugin.

---

## Explicitly excluded

The following are **out of scope** for this library and should be handled by the host application or separate packages:

| Domain | Reason |
|--------|--------|
| Scheduling / appointments | Not odontogram visualization |
| Patient management | Host app responsibility |
| General clinical records (EHR) | Broader than odontogram marks |
| Billing / invoicing | Financial domain |
| Prescriptions | Pharmaceutical domain |
| Automated diagnosis | Clinical decision support |
| Built-in backend / persistence | Library is client-side only |

The library provides `getState()` / `setState()` so host applications can persist odontogram data in their own storage layer.
