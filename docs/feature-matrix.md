# Feature / Compatibility Matrix

Legend: ✅ implemented · 🔲 planned · — not applicable

## Core features

| Feature                 | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ----------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Odontogram instance API |  ✅  |     —     |  —  |    —    |    —     | 01    |
| render / destroy        |  ✅  |     —     |  —  |    —    |    —     | 01    |
| getOption / setOption   |  ✅  |     —     |  —  |    —    |    —     | 01    |
| changeView              |  ✅  |     —     |  —  |    —    |    —     | 01    |
| getState / setState     |  ✅  |     —     |  —  |    —    |    —     | 01    |
| batchRendering          |  ✅  |     —     |  —  |    —    |    —     | 01    |
| createPlugin            |  ✅  |     —     |  —  |    —    |    —     | 01    |
| Lifecycle hooks         |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Click callbacks         |  ✅  |     —     | ✅  |    —    |    —     | 01    |

## Dentition

| Feature                   | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ------------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| FDI numbering             |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Universal numbering       |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Palmer notation           |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Surface codes (M,O,I,D,B,L) |  ✅  |    ✅     | ✅  |    —    |    —     | 01    |
| Canonical tooth catalog     |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Applicable surfaces / tooth |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Clinical → graphic mapping  |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Tooth presence overlay      |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Mixed dentition coexistence |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Dental review fixtures      |  —   |    ✅     |  —  |    —    |    —     | 01    |
| Permanent catalog (32)    |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Deciduous catalog (20)    |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Mixed catalog (52)        |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Arch / quadrant metadata  |  —   |    ✅     |  —  |    —    |    —     | 01    |

## Rendering

| Feature                | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ---------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Schematic SVG renderer |  —   |     —     | ✅  |    —    |    —     | 01    |
| Permanent view         |  —   |     —     | ✅  |    —    |    —     | 01    |
| Deciduous view         |  —   |     —     | ✅  |    —    |    —     | 01    |
| Mixed view             |  —   |     —     | ✅  |    —    |    —     | 01    |
| Anatomical tooth paths |  —   |     —     |  —  |    —    |    —     | later |
| Canvas renderer        |  —   |     —     |  —  |    —    |    —     | later |
| Custom renderer plugin |  ✅  |     —     |  —  |   ✅    |    —     | 01    |

## Interaction

| Feature                 | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ----------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Tooth click selection   |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Surface click selection |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Multi-surface selection |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Drag selection          |  —   |     —     |  —  |   🔲    |    —     | later |
| Keyboard navigation     |  —   |     —     |  —  |   🔲    |    —     | later |

## Marks

| Feature                | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ---------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Mark state model       |  ✅  |     —     |  —  |    —    |    —     | 01    |
| Mark rendering (color) |  —   |     —     | ✅  |    —    |    —     | 01    |
| Mark style overrides   |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Mark type catalog      |  —   |     —     |  —  |   🔲    |    —     | later |
| Mark symbols / icons   |  —   |     —     |  —  |   🔲    |    —     | later |

## Integration

| Feature               | Core | Dentition | SVG | Plugins | Adapters | Stage    |
| --------------------- | :--: | :-------: | :-: | :-----: | :------: | -------- |
| Vanilla JS example    |  —   |     —     |  —  |    —    |    —     | 01       |
| React adapter         |  —   |     —     |  —  |    —    |    🔲    | later    |
| Vue adapter           |  —   |     —     |  —  |    —    |    🔲    | later    |
| State serialization   |  ✅  |     —     |  —  |    —    |    —     | 01       |
| Backend / persistence |  —   |     —     |  —  |    —    |    —     | excluded |

## Explicitly excluded (all stages)

| Domain                 | Status   |
| ---------------------- | -------- |
| Patient management     | excluded |
| Scheduling             | excluded |
| Clinical records (EHR) | excluded |
| Billing                | excluded |
| Prescriptions          | excluded |
| Automated diagnosis    | excluded |
| Built-in backend       | excluded |
