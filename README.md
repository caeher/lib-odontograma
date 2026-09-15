# lib-odontograma

Framework-independent JavaScript/TypeScript library for rendering and interacting with dental odontograms.

## Stage 01 · Foundations

This release provides the typed core API, dental numbering resources, a schematic SVG renderer plugin, distributable CSS, and documentation. It is strictly limited to the odontogram domain — no patients, scheduling, billing, or backend.

## Requirements

- **Node.js**: `>= 18.0.0`
- **Package Manager**: `npm >= 9.0.0` (or compatible `pnpm` / `yarn`)
- **TypeScript**: `>= 5.0` (for TypeScript consumers)

## Install

```bash
npm install @odontogram/core @odontogram/svg @odontogram/dentition
```

## Quick start

```html
<div id="odontogram"></div>
```

```ts
import { Odontogram } from "@odontogram/core";
import { svgPlugin } from "@odontogram/svg";

// Optional default styles
import "@odontogram/core/style.css";
import "@odontogram/svg/style.css";

const el = document.getElementById("odontogram")!;
const odontogram = new Odontogram(el, {
  plugins: [svgPlugin],
  initialView: "permanent",
  notation: "fdi",
  selectable: true,
  surfaceClick: ({ tooth, surface }) => {
    console.log(`Clicked ${tooth}/${surface}`);
  },
});

odontogram.render();

// Record a mark
odontogram.setState({
  marks: [{ id: "1", tooth: "16", surfaces: ["O"], type: "caries" }],
});
```

## Packages

| Package                 | Version | Description                                                            |
| ----------------------- | ------- | ---------------------------------------------------------------------- |
| `@odontogram/core`      | `0.1.0` | Instance API, options, state, plugins, hooks, host styles              |
| `@odontogram/dentition` | `0.1.0` | Canonical tooth catalog, clinical surfaces, notation labels, orientation mapping |
| `@odontogram/svg`       | `0.1.0` | Schematic SVG view plugin (permanent, deciduous, mixed) and SVG styles |

## Documentation

- [Use cases](docs/use-cases.md) — what this library does and does not do
- [Architecture](docs/architecture.md) — layer boundaries, packaging, and dependency rules
- [Feature matrix](docs/feature-matrix.md) — compatibility across packages
- [API reference](docs/api.md) — constructor, methods, options, state, hooks
- [Dental model review](docs/dental-review.md) — catalog fixtures, terminology, professional review gate
- [Attributions & References](docs/attributions.md) — dental standards and architectural patterns

## Development & Verification

```bash
npm install          # Install dependencies
npm run build        # Build all packages and examples
npm test             # Run unit test suites
npm run typecheck    # Strict TypeScript type check
npm run lint         # Run ESLint across codebase
npm run format:check # Verify code formatting with Prettier
npm run verify:pack  # Pack packages into tarballs and verify JS + TS consumers
```

Run vanilla example locally:

```bash
cd examples/vanilla && npm run dev
```

## License and Attributions

Licensed under Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [Attributions](docs/attributions.md).
