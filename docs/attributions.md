# Attributions and References

This document records the standards, resources, and design inspirations utilized in `lib-odontograma`.

## 1. Dental Domain Standards

`lib-odontograma` implements standard dental clinical notation and surface classification systems:

- **FDI World Dental Federation notation (ISO 3950)**:
  - Two-digit tooth designation standard (quadrants 1–4 for permanent, 5–8 for deciduous dentition; positions 1–8 / 1–5).
  - Used as the canonical internal identifier across `@odontogram/core`, `@odontogram/dentition`, and renderer plugins.
- **Universal Numbering System**:
  - Adopted by the American Dental Association (ADA).
  - 1–32 for permanent dentition and A–T for primary/deciduous dentition.
- **Palmer Notation Method**:
  - Quadrant grid symbols (`┘`, `└`, `┐`, `┌`) with tooth numbers 1–8 and letters A–E.
- **Black's Surface Designations**:
  - Standard five anatomical surfaces: Mesial (`M`), Occlusal/Incisal (`O`), Distal (`D`), Buccal/Vestibular (`B`), and Lingual/Palatal (`L`).

## 2. Architectural Design Patterns

- **Plugin and View Context Pattern**:
  - Inspired by the configuration, lifecycle hooks, and plugin architecture of [FullCalendar](https://fullcalendar.io).
  - **No FullCalendar code, dependencies, or assets are bundled or used.** The patterns are reimplemented cleanly from scratch in TypeScript specifically tailored to the odontogram domain.

## 3. Open Source Tooling Dependencies

The project uses modern, permissively licensed open source developer tooling:

- [TypeScript](https://www.typescriptlang.org/) (Apache-2.0) — static typing and declaration generation
- [tsup](https://github.com/egoist/tsup) / [esbuild](https://esbuild.github.io/) (MIT) — fast bundle compilation and declaration emission
- [Vitest](https://vitest.dev/) (MIT) — unit test framework
- [ESLint](https://eslint.org/) (MIT) & [Prettier](https://prettier.io/) (MIT) — code linting and formatting
- [Vite](https://vitejs.dev/) (MIT) — example application dev server and bundler
