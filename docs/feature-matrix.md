# Feature / Compatibility Matrix

Legend: ✅ implemented · 🔲 planned · — not applicable

## Core features

| Feature                 | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ----------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Odontogram instance API |  ✅  |     —     |  —  |    —    |    —     | 01    |
| Headless execution      |  ✅  |     —     |  —  |    —    |    —     | 02    |
| render / destroy        |  ✅  |     —     |  —  |    —    |    —     | 01    |
| getOption / setOption   |  ✅  |     —     |  —  |    —    |    —     | 01    |
| changeView              |  ✅  |     —     |  —  |    —    |    —     | 01    |
| getState / setState     |  ✅  |     —     |  —  |    —    |    —     | 01    |
| batch / batchRendering  |  ✅  |     —     |  —  |    —    |    —     | 02    |
| createPlugin            |  ✅  |     —     |  —  |    —    |    —     | 01    |
| Lifecycle hooks         |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Click callbacks         |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| State & presence events |  ✅  |     —     |  —  |    —    |    —     | 02    |

## Model & Data Operations

| Feature                           | Core | Dentition | SVG | Plugins | Adapters | Stage |
| --------------------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Typed marks CRUD operations       |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Immutable mark IDs                |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Tooth state & presence CRUD       |  ✅  |     —     |  —  |    —    |    —     | 02    |
| DOM-independent selection         |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Atomic batch transaction rollback |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Controlled & internal modes       |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Monotonic revision tracking       |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Reset operations                  |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Orphaned mark pruning             |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Multi-instance isolation          |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Defensive cloning / immutability  |  ✅  |     —     |  —  |    —    |    —     | 02    |

## Dentition

| Feature                     | Core | Dentition | SVG | Plugins | Adapters | Stage |
| --------------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| FDI numbering               |  —   |    ✅     | ✅  |    —    |    —     | 02    |
| Universal numbering         |  —   |    ✅     | ✅  |    —    |    —     | 02    |
| Palmer notation             |  —   |    ✅     | ✅  |    —    |    —     | 02    |
| Surface codes (M,O,I,D,B,L) |  ✅  |    ✅     | ✅  |    —    |    —     | 01    |
| Canonical tooth catalog     |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Applicable surfaces / tooth |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Clinical → graphic mapping  |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Tooth presence overlay      |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Mixed dentition coexistence |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Dental review fixtures      |  —   |    ✅     |  —  |    —    |    —     | 01    |
| Permanent catalog (32)      |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Deciduous catalog (20)      |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Mixed catalog (52)          |  —   |    ✅     | ✅  |    —    |    —     | 01    |
| Arch / quadrant metadata    |  —   |    ✅     |  —  |    —    |    —     | 01    |

## Rendering

| Feature                        | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ------------------------------ | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Schematic SVG renderer         |  —   |     —     | ✅  |    —    |    —     | 01    |
| Fine-grained incremental SVG   |  ✅  |     —     | ✅  |    —    |    —     | 03    |
| Multi-instance defs isolation  |  ✅  |     —     | ✅  |    —    |    —     | 03    |
| Multi-tooth annotation layer   |  ✅  |     —     | ✅  |    —    |    —     | 03    |
| Focus & selection preservation |  ✅  |     —     | ✅  |    —    |    —     | 03    |
| Hidden container resilience    |  —   |     —     | ✅  |    —    |    —     | 03    |
| SVG resource contract          |  —   |     —     | ✅  |    —    |    —     | 03    |
| Tooth SVG validator            |  —   |     —     | ✅  |    —    |    —     | 03    |
| Occlusal SVG catalog (52)      |  —   |     —     | ✅  |    —    |    —     | 03    |
| Catalog manifest API           |  —   |     —     | ✅  |    —    |    —     | 03    |
| SVG review gallery             |  —   |     —     | ✅  |    —    |    —     | 03    |
| Permanent view                 |  —   |     —     | ✅  |    —    |    —     | 01    |
| Deciduous / Primary view       |  —   |     —     | ✅  |    —    |    —     | 01    |
| Mixed view (4-row layout)      |  —   |     —     | ✅  |    —    |    —     | 03    |
| Arch views (upper / lower)     |  ✅  |    ✅     | ✅  |    —    |    —     | 03    |
| Quadrant views (1..8)          |  ✅  |    ✅     | ✅  |    —    |    —     | 03    |
| Single tooth detail view       |  ✅  |    ✅     | ✅  |    —    |    —     | 03    |
| Patient orientation (R / L)    |  ✅  |    ✅     | ✅  |    —    |    —     | 03    |
| Central midline divider        |  ✅  |     —     | ✅  |    —    |    —     | 03    |
| Visible teeth filtering        |  ✅  |     —     | ✅  |    —    |    —     | 03    |
| Anatomical tooth paths         |  —   |     —     |  —  |    —    |    —     | later |
| Canvas renderer                |  —   |     —     |  —  |    —    |    —     | later |
| Custom renderer plugin         |  ✅  |     —     |  —  |   ✅    |    —     | 01    |

## Interaction

| Feature                 | Core | Dentition | SVG | Plugins | Adapters | Stage |
| ----------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Tooth click selection   |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Surface click selection |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Multi-surface selection |  ✅  |     —     | ✅  |    —    |    —     | 01    |
| Drag selection          |  —   |     —     |  —  |   🔲    |    —     | later |
| Keyboard navigation     |  —   |     —     |  —  |   🔲    |    —     | later |

## Marks & Annotations

| Feature                           | Core | Dentition | SVG | Plugins | Adapters | Stage |
| --------------------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Mark state model                  |  ✅  |     —     |  —  |    —    |    —     | 01    |
| MarkTarget (surfaces/tooth/teeth) |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Multi-surface marks on one tooth  |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Whole-tooth marks (crown/implant) |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Multi-tooth annotations (bridge)  |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Multiple marks / tooth identity   |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Semantic status lifecycle         |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Clinician text notes & metadata   |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Mark style & statusColors         |  ✅  |     —     | ✅  |    —    |    —     | 02    |
| Mark type catalog                 |  —   |     —     |  —  |   🔲    |    —     | later |
| Mark symbols / icons              |  —   |     —     |  —  |   🔲    |    —     | later |

## Validation & Coexistence

| Feature                          | Core | Dentition | SVG | Plugins | Adapters | Stage |
| -------------------------------- | :--: | :-------: | :-: | :-----: | :------: | ----- |
| Mark ID uniqueness               |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Target integrity validation      |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Surface applicability checks     |  ✅  |    ✅     |  —  |    —    |    —     | 02    |
| Tooth presence coexistence       |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Mark type incompatibility matrix |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Configurable validator rules     |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Custom validation rules          |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Typed error codes & field paths  |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Atomic state rollback/rejection  |  ✅  |     —     |  —  |    —    |    —     | 02    |
| Unknown mark type preservation   |  ✅  |     —     | ✅  |    —    |    —     | 02    |

## Integration

| Feature                      | Core | Dentition | SVG | Plugins | Adapters | Stage    |
| ---------------------------- | :--: | :-------: | :-: | :-----: | :------: | -------- |
| Vanilla JS example           |  —   |     —     |  —  |    —    |    —     | 01       |
| React adapter                |  —   |     —     |  —  |    —    |    🔲    | later    |
| Vue adapter                  |  —   |     —     |  —  |    —    |    🔲    | later    |
| State serialization fixtures |  ✅  |     —     |  —  |    —    |    —     | 02       |
| Backend / persistence        |  —   |     —     |  —  |    —    |    —     | excluded |

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
