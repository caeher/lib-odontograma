import type { LocaleMessageKey, OdontogramLocale, OdontogramOptions } from "./types.js";

const ENGLISH: Record<LocaleMessageKey, string> = {
  "ui.view": "View",
  "ui.marks": "Marks",
  "ui.selection": "Selection",
  "ui.history": "History",
  "ui.views": "Odontogram view",
  "ui.markType": "Mark type",
  "ui.markStatus": "Mark status",
  "ui.finding": "finding",
  "ui.existing": "existing",
  "ui.planned": "planned",
  "ui.completed": "completed",
  "ui.applyMark": "Apply mark",
  "ui.editSelected": "Edit selected",
  "ui.deleteSelected": "Delete selected",
  "ui.clearSelection": "Clear selection",
  "ui.undo": "Undo",
  "ui.redo": "Redo",
  "ui.controls": "Odontogram controls",
  "ui.legend": "Legend",
  "view.permanent": "Permanent",
  "view.deciduous": "Deciduous",
  "view.primary": "Primary",
  "view.mixed": "Mixed",
  "view.upper": "Upper arch",
  "view.lower": "Lower arch",
  "view.quadrant": "Quadrant {number}",
  "view.tooth": "Tooth {number}",
  "mark.caries": "caries",
  "mark.restoration": "restoration",
  "mark.crown": "crown",
  "mark.bridge": "bridge",
  "mark.sealant": "sealant",
  "mark.extraction": "extraction",
  "mark.implant": "implant",
  "surface.mesial": "Mesial",
  "surface.occlusal": "Occlusal",
  "surface.incisal": "Incisal",
  "surface.distal": "Distal",
  "surface.buccal": "Buccal",
  "surface.lingual": "Lingual",
  "presence.present": "present",
  "presence.missing": "missing",
  "presence.unerupted": "unerupted",
  "a11y.chart": "Dental chart",
  "a11y.summary": "Text equivalent of the visible dental chart.",
  "a11y.patientRight": "Patient Right",
  "a11y.patientLeft": "Patient Left",
  "a11y.quadrant": "Quadrant {number}",
  "a11y.tooth": "Tooth {number} ({accessible})",
  "a11y.surface": "{surface} surface",
  "a11y.marks": "marks: {marks}",
  "a11y.noMarks": "no marks",
  "error.invalidConfiguration": "Invalid odontogram configuration.",
  "error.invalidContainer": "A valid HTMLElement container is required.",
  "error.noContainer": "No HTMLElement container is available to render the odontogram.",
  "error.noSelection": "Select at least one tooth or surface before applying a mark.",
  "error.controlledMutation": "This odontogram is controlled; update its state through setState().",
  "error.invalidState": "The odontogram state is invalid.",
};

const SPANISH: Partial<Record<LocaleMessageKey, string>> = {
  "ui.view": "Vista",
  "ui.marks": "Hallazgos",
  "ui.selection": "Selección",
  "ui.history": "Historial",
  "ui.views": "Vista del odontograma",
  "ui.markType": "Tipo de hallazgo",
  "ui.markStatus": "Estado del hallazgo",
  "ui.finding": "hallazgo",
  "ui.existing": "existente",
  "ui.planned": "planificado",
  "ui.completed": "completado",
  "ui.applyMark": "Aplicar hallazgo",
  "ui.editSelected": "Editar seleccionado",
  "ui.deleteSelected": "Eliminar seleccionado",
  "ui.clearSelection": "Limpiar selección",
  "ui.undo": "Deshacer",
  "ui.redo": "Rehacer",
  "ui.controls": "Controles del odontograma",
  "ui.legend": "Leyenda",
  "view.permanent": "Permanente",
  "view.deciduous": "Temporal",
  "view.primary": "Primaria",
  "view.mixed": "Mixta",
  "view.upper": "Arcada superior",
  "view.lower": "Arcada inferior",
  "view.quadrant": "Cuadrante {number}",
  "view.tooth": "Diente {number}",
  "mark.caries": "caries",
  "mark.restoration": "restauración",
  "mark.crown": "corona",
  "mark.bridge": "puente",
  "mark.sealant": "sellador",
  "mark.extraction": "extracción",
  "mark.implant": "implante",
  "surface.mesial": "Mesial",
  "surface.occlusal": "Oclusal",
  "surface.incisal": "Incisal",
  "surface.distal": "Distal",
  "surface.buccal": "Vestibular",
  "surface.lingual": "Lingual",
  "presence.present": "presente",
  "presence.missing": "ausente",
  "presence.unerupted": "no erupcionado",
  "a11y.chart": "Odontograma",
  "a11y.summary": "Equivalente textual del odontograma visible.",
  "a11y.patientRight": "Derecha del paciente",
  "a11y.patientLeft": "Izquierda del paciente",
  "a11y.quadrant": "Cuadrante {number}",
  "a11y.tooth": "Diente {number} ({accessible})",
  "a11y.surface": "superficie {surface}",
  "a11y.marks": "hallazgos: {marks}",
  "a11y.noMarks": "sin hallazgos",
  "error.invalidConfiguration": "La configuración del odontograma no es válida.",
  "error.invalidContainer": "Se requiere un contenedor HTMLElement válido.",
  "error.noContainer": "No hay un contenedor HTMLElement disponible para mostrar el odontograma.",
  "error.noSelection":
    "Seleccione al menos un diente o una superficie antes de aplicar un hallazgo.",
  "error.controlledMutation":
    "Este odontograma es controlado; actualice su estado mediante setState().",
  "error.invalidState": "El estado del odontograma no es válido.",
};

const locales = new Map<string, OdontogramLocale>([
  ["en", { direction: "ltr", messages: ENGLISH }],
  ["es", { direction: "ltr", messages: SPANISH }],
]);

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().split("-")[0] ?? "en";
}

/** Register or extend an odontogram UI locale. Per-instance `localeText` still takes precedence. */
export function registerLocale(tag: string, locale: OdontogramLocale): void {
  if (!tag.trim()) throw new TypeError("Locale tag must be a non-empty string.");
  const key = normalizeTag(tag);
  const previous = locales.get(key);
  locales.set(key, {
    direction: locale.direction ?? previous?.direction ?? "ltr",
    messages: { ...previous?.messages, ...locale.messages },
  });
}

/** Resolve one message using instance override → registered locale → English → key fallback. */
export function getLocaleText(
  options: Pick<OdontogramOptions, "locale" | "localeText"> | undefined,
  key: LocaleMessageKey,
  values: Record<string, string | number> = {},
): string {
  const localeKey = normalizeTag(options?.locale ?? "en");
  const template =
    options?.localeText?.[key] ?? locales.get(localeKey)?.messages?.[key] ?? ENGLISH[key] ?? key;
  return template.replace(/\{([^}]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/** Resolve interface direction. Unknown locales inherit the browser-friendly ltr default. */
export function getLocaleDirection(locale?: string): "ltr" | "rtl" {
  return locales.get(normalizeTag(locale ?? "en"))?.direction ?? "ltr";
}
