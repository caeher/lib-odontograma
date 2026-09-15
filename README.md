# lib-odontograma

Framework-independent JavaScript/TypeScript library for rendering and interacting with dental odontograms.

## Stage 01 · Foundations

This release provides the typed core API, dental numbering resources, a schematic SVG renderer plugin, and documentation. It is limited to the odontogram domain — no patients, scheduling, billing, or backend.

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
  marks: [
    { id: "1", tooth: "16", surfaces: ["O"], type: "caries" },
  ],
});
```

## Packages

| Package | Description |
|---------|-------------|
| `@odontogram/core` | Instance API, options, state, plugins, hooks |
| `@odontogram/dentition` | FDI / Universal / Palmer numbering, surface codes, tooth catalogs |
| `@odontogram/svg` | Schematic SVG view plugin (permanent, deciduous, mixed) |

## Documentation

- [Use cases](docs/use-cases.md) — what this library does and does not do
- [Architecture](docs/architecture.md) — layer boundaries and dependency rules
- [Feature matrix](docs/feature-matrix.md) — compatibility across packages
- [API reference](docs/api.md) — constructor, methods, options, state, hooks

## Development

```bash
npm install
npm run build
npm test
cd examples/vanilla && npm run dev
```

## License

Apache 2.0 — see [LICENSE](LICENSE).
