import {
  getApplicableSurfaces,
  getTooth,
  mapFaceToSurface,
  type ClinicalSurface,
} from "@odontogram/dentition";
import {
  getManifest,
  listCatalogFamilies,
  resolveToothSvgResource,
} from "@odontogram/svg/catalog";

const catalogSvgModules = import.meta.glob(
  "../../../packages/svg/resources/catalog/**/*.svg",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

function catalogSvgByRelativePath(relativeSvgPath: string): string {
  const suffix = relativeSvgPath.replace(/^catalog\//, "catalog/");
  const key = Object.keys(catalogSvgModules).find((k) => k.includes(suffix));
  if (!key) {
    throw new Error(`Missing bundled SVG for ${relativeSvgPath}`);
  }
  return catalogSvgModules[key];
}

const familyGrid = document.querySelector<HTMLElement>("#family-grid")!;
const toothGrid = document.querySelector<HTMLElement>("#tooth-grid")!;
const scaleSelect = document.querySelector<HTMLSelectElement>("#scale-select")!;
const detail = document.querySelector<HTMLElement>("#detail")!;
const detailTitle = document.querySelector<HTMLElement>("#detail-title")!;
const detailMeta = document.querySelector<HTMLElement>("#detail-meta")!;

let highlightedSurface: ClinicalSurface | null = null;
let activeToothId: string | null = null;

function setScale(px: number): void {
  document.documentElement.style.setProperty("--tooth-scale", `${px}px`);
}

function mountSvg(container: HTMLElement, relativeSvgPath: string): SVGSVGElement {
  const markup = catalogSvgByRelativePath(relativeSvgPath);
  container.innerHTML = markup;
  const svg = container.querySelector("svg");
  if (!svg) {
    throw new Error("SVG root missing");
  }
  return svg;
}

function wireSurfaceHighlight(svg: SVGSVGElement, toothId: string): void {
  for (const group of svg.querySelectorAll<SVGGElement>("[data-surface]")) {
    const surface = group.getAttribute("data-surface") as ClinicalSurface;
    const face = group.getAttribute("data-face") ?? "";
    const activate = () => {
      highlightedSurface = surface;
      activeToothId = toothId;
      updateHighlights();
      showDetail(toothId, surface, face);
    };
    group.addEventListener("mouseenter", activate);
    group.addEventListener("focus", activate);
    group.addEventListener("click", activate);
  }
}

function updateHighlights(): void {
  for (const el of document.querySelectorAll<SVGGElement>("[data-surface]")) {
    const surface = el.getAttribute("data-surface");
    const tooth = el.closest("[data-tooth-id]")?.getAttribute("data-tooth-id");
    const on =
      highlightedSurface !== null &&
      surface === highlightedSurface &&
      tooth === activeToothId;
    el.classList.toggle("is-highlighted", on);
  }
}

function showDetail(toothId: string, surface: ClinicalSurface, face: string): void {
  const record = getTooth(toothId);
  detail.hidden = false;
  detailTitle.textContent = `Tooth ${toothId} · ${surface}`;
  detailMeta.innerHTML = `
    <dt>FDI</dt><dd>${toothId}</dd>
    <dt>Class</dt><dd>${record?.toothClass ?? "—"}</dd>
    <dt>Surface</dt><dd>${surface}</dd>
    <dt>Graphic face</dt><dd>${face}</dd>
    <dt>Applicable</dt><dd>${getApplicableSurfaces(toothId).join(", ")}</dd>
  `;
}

function renderFamilies(): void {
  const families = listCatalogFamilies();
  for (const family of families) {
    const card = document.createElement("article");
    card.className = "family-card";
    card.tabIndex = 0;
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    mountSvg(thumb, family.relativeSvgPath);
    const title = document.createElement("h3");
    title.textContent = family.resourceId;
    const meta = document.createElement("p");
    meta.textContent = `ref ${family.referenceToothId} · ${family.orientationKey}`;
    card.append(thumb, title, meta);
    card.addEventListener("click", () => {
      const first = Object.entries(getManifest().teeth).find(
        ([, e]) => e.resourceId === family.resourceId,
      );
      if (first) {
        const cell = toothGrid.querySelector(`[data-tooth-id="${first[0]}"]`);
        cell?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        (cell as HTMLElement | null)?.focus();
      }
    });
    familyGrid.append(card);
  }
}

function renderTeeth(): void {
  const manifest = getManifest();
  const ids = Object.keys(manifest.teeth).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  for (const toothId of ids) {
    const resolved = resolveToothSvgResource(toothId);
    const record = getTooth(toothId);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "tooth-cell";
    cell.dataset.toothId = toothId;
    const preview = document.createElement("div");
    preview.className = "tooth-preview";
    const svg = mountSvg(preview, resolved.relativeSvgPath);
    wireSurfaceHighlight(svg, toothId);
    const label = document.createElement("span");
    label.textContent = `${toothId} ${record?.toothClass ?? ""}`;
    cell.append(preview, label);
    cell.addEventListener("click", () => {
      activeToothId = toothId;
      const center = mapFaceToSurface(toothId, "center");
      if (center) {
        highlightedSurface = center;
        updateHighlights();
        showDetail(toothId, center, "center");
      }
    });
    toothGrid.append(cell);
  }
}

scaleSelect.addEventListener("change", () => {
  setScale(Number(scaleSelect.value));
});

setScale(Number(scaleSelect.value));
renderFamilies();
renderTeeth();
