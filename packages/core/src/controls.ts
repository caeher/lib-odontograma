import type { Odontogram } from "./odontogram.js";
import { getLocaleText } from "./locale.js";
import type {
  MarkCatalogEntry,
  OdontogramCommand,
  ToolbarContext,
  ToolbarControlId,
  ToolbarOptions,
  LocaleMessageKey,
} from "./types.js";

function t(
  chart: Odontogram,
  key: Parameters<typeof getLocaleText>[1],
  values?: Record<string, string | number>,
): string {
  return getLocaleText(
    chart.getOption("locale") || chart.getOption("localeText")
      ? {
          locale: chart.getOption("locale"),
          localeText: chart.getOption("localeText"),
        }
      : undefined,
    key,
    values,
  );
}

function viewChoices(chart: Odontogram): Array<[string, string]> {
  return [
    ["permanent", t(chart, "view.permanent")],
    ["deciduous", t(chart, "view.deciduous")],
    ["primary", t(chart, "view.primary")],
    ["mixed", t(chart, "view.mixed")],
    ["upper", t(chart, "view.upper")],
    ["lower", t(chart, "view.lower")],
    ...Array.from(
      { length: 8 },
      (_, i) =>
        [`quadrant-${i + 1}`, t(chart, "view.quadrant", { number: i + 1 })] as [string, string],
    ),
    ...[16, 36, 55].map(
      (number) => [`tooth-${number}`, t(chart, "view.tooth", { number })] as [string, string],
    ),
  ];
}

function markLabel(chart: Odontogram, type: string, custom?: string): string {
  if (custom) return custom;
  const keys: Record<string, LocaleMessageKey> = {
    caries: "mark.caries",
    restoration: "mark.restoration",
    crown: "mark.crown",
    bridge: "mark.bridge",
    sealant: "mark.sealant",
    extraction: "mark.extraction",
    implant: "mark.implant",
  };
  const key = keys[type];
  return key ? t(chart, key) : type;
}

function createButton(label: string, title?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (title) button.title = title;
  return button;
}

function contextFor(chart: Odontogram): ToolbarContext {
  return {
    state: chart.getState(),
    readOnly: chart.getMode() === "controlled" || Boolean(chart.getOption("readOnly")),
    disabled: Boolean(chart.getOption("disabled")),
    canUndo: chart.canUndo(),
    canRedo: chart.canRedo(),
    executeCommand: (command: OdontogramCommand) => chart.executeCommand(command),
  };
}

function getCatalog(chart: Odontogram): MarkCatalogEntry[] {
  const configured = chart.getOption("markCatalog") ?? [];
  const active = chart.getMarks().map(({ type, status }) => ({ type, status }));
  const entries = [...configured];
  for (const mark of active) {
    if (!entries.some((item) => item.type === mark.type && item.status === mark.status)) {
      entries.push(mark);
    }
  }
  return entries;
}

function appendControl(
  group: HTMLElement,
  control:
    ToolbarControlId | (NonNullable<ToolbarOptions["groups"]>[number]["controls"][number] & object),
  chart: Odontogram,
): void {
  if (typeof control === "object") {
    const button = createButton(control.label, control.title);
    const updateDisabled = () => {
      const ctx = contextFor(chart);
      button.disabled = Boolean(
        ctx.disabled ||
        (typeof control.disabled === "function" ? control.disabled(ctx) : control.disabled),
      );
    };
    button.addEventListener("click", () => control.onClick(contextFor(chart)));
    updateDisabled();
    group.append(button);
    return;
  }

  if (control === "views") {
    const select = document.createElement("select");
    select.setAttribute("aria-label", t(chart, "ui.views"));
    const choices = viewChoices(chart);
    for (const [value, label] of choices) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    const currentView = chart.getState().view;
    if (!choices.some(([value]) => value === currentView)) {
      const option = document.createElement("option");
      option.value = currentView;
      option.textContent = currentView;
      select.append(option);
    }
    select.value = currentView;
    select.disabled = Boolean(chart.getOption("disabled") || chart.getMode() === "controlled");
    select.addEventListener("change", () => chart.changeView(select.value));
    group.append(select);
    return;
  }

  if (control === "marks") {
    const catalog = getCatalog(chart);
    const types = [...new Set(catalog.map(({ type }) => type))];
    const statuses = [...new Set(catalog.flatMap(({ status }) => (status ? [status] : [])))];
    if (!types.length) types.push("finding");
    if (!statuses.length) statuses.push("existing", "planned", "completed");
    const type = document.createElement("select");
    type.setAttribute("aria-label", t(chart, "ui.markType"));
    for (const item of types) {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = markLabel(
        chart,
        item,
        catalog.find((entry) => entry.type === item)?.label,
      );
      type.append(option);
    }
    const status = document.createElement("select");
    status.setAttribute("aria-label", t(chart, "ui.markStatus"));
    for (const item of statuses) {
      const option = document.createElement("option");
      option.value = item;
      const statusKey = `ui.${item}` as "ui.existing" | "ui.planned" | "ui.completed";
      option.textContent = ["existing", "planned", "completed"].includes(item)
        ? t(chart, statusKey)
        : item;
      status.append(option);
    }
    const selection = chart.getSelection();
    const hasTarget = selection.teeth.length > 0 || selection.surfaces.length > 0;
    const blocked = Boolean(
      chart.getOption("disabled") ||
      chart.getOption("readOnly") ||
      chart.getMode() === "controlled",
    );
    type.disabled = status.disabled = blocked;
    const apply = createButton(t(chart, "ui.applyMark"));
    apply.disabled = blocked || !hasTarget;
    apply.addEventListener("click", () => {
      chart.executeCommand({
        type: "apply-mark",
        mark: { type: type.value, status: status.value },
      });
    });
    const selectedMarkId = selection.annotations?.[0];
    const edit = createButton(t(chart, "ui.editSelected"));
    edit.disabled = blocked || !selectedMarkId;
    edit.addEventListener("click", () => {
      if (selectedMarkId)
        chart.executeCommand({
          type: "edit-mark",
          markId: selectedMarkId,
          patch: { type: type.value, status: status.value },
        });
    });
    const remove = createButton(t(chart, "ui.deleteSelected"));
    remove.disabled = blocked || !selectedMarkId;
    remove.addEventListener("click", () => {
      if (selectedMarkId) chart.executeCommand({ type: "delete-mark", markId: selectedMarkId });
    });
    group.append(type, status, apply, edit, remove);
    return;
  }

  if (control === "selection") {
    const clear = createButton(t(chart, "ui.clearSelection"));
    const selection = chart.getSelection();
    clear.disabled = Boolean(
      chart.getOption("disabled") ||
      chart.getOption("readOnly") ||
      chart.getMode() === "controlled" ||
      (!selection.teeth.length && !selection.surfaces.length && !selection.annotations?.length),
    );
    clear.addEventListener("click", () => chart.setSelection({ teeth: [], surfaces: [] }));
    group.append(clear);
    return;
  }

  const blocked = Boolean(
    chart.getOption("disabled") || chart.getOption("readOnly") || chart.getMode() === "controlled",
  );
  const undo = createButton(t(chart, "ui.undo"));
  undo.disabled = blocked || !chart.canUndo();
  undo.addEventListener("click", () => chart.undo());
  const redo = createButton(t(chart, "ui.redo"));
  redo.disabled = blocked || !chart.canRedo();
  redo.addEventListener("click", () => chart.redo());
  group.append(undo, redo);
}

export function renderToolbar(chart: Odontogram, container: HTMLElement): void {
  const active = document.activeElement;
  const focusedGroup =
    active && container.contains(active)
      ? Array.prototype.indexOf.call(container.children, (active as HTMLElement).parentElement)
      : -1;
  const focusedControl =
    focusedGroup >= 0
      ? Array.prototype.indexOf.call(container.children[focusedGroup]?.children ?? [], active)
      : -1;
  container.replaceChildren();
  const config = chart.getOption("toolbar");
  if (!config) {
    container.className = "odontogram-toolbar";
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const groups = config.groups ?? [
    { id: "views", label: t(chart, "ui.view"), controls: ["views"] as const },
    { id: "marks", label: t(chart, "ui.marks"), controls: ["marks"] as const },
    { id: "selection", label: t(chart, "ui.selection"), controls: ["selection"] as const },
    { id: "history", label: t(chart, "ui.history"), controls: ["history"] as const },
  ];
  container.className = `odontogram-toolbar odontogram-toolbar-${config.position ?? "top"}`;
  container.setAttribute("role", "toolbar");
  container.setAttribute("aria-label", t(chart, "ui.controls"));
  for (const definition of groups) {
    const group = document.createElement("div");
    group.className = "odontogram-toolbar-group";
    group.setAttribute("role", "group");
    group.dataset.group = definition.id;
    if (definition.label) group.setAttribute("aria-label", definition.label);
    for (const control of definition.controls) appendControl(group, control, chart);
    container.append(group);
  }
  if (focusedGroup >= 0 && focusedControl >= 0) {
    const replacement = container.children[focusedGroup]?.children[focusedControl];
    if (replacement instanceof HTMLElement) replacement.focus({ preventScroll: true });
  }
}

export function renderLegend(chart: Odontogram, container: HTMLElement): void {
  const config = chart.getOption("legend");
  container.className = "odontogram-legend";
  container.setAttribute("aria-label", t(chart, "ui.legend"));
  if (config === false) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  container.hidden = false;
  const entries = config?.items ?? getCatalog(chart);
  container.replaceChildren();
  if (!entries.length) {
    container.hidden = true;
    return;
  }
  const heading = document.createElement("h3");
  heading.textContent = config?.label ?? t(chart, "ui.legend");
  container.append(heading);
  const list = document.createElement("ul");
  for (const entry of entries) {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "odontogram-legend-symbol";
    swatch.textContent = entry.symbol ?? "●";
    swatch.setAttribute("aria-hidden", "true");
    swatch.style.color =
      entry.color ??
      (entry.status ? chart.getOption("statusColors")?.[entry.status] : undefined) ??
      chart.getOption("markColors")?.[entry.type] ??
      "currentColor";
    const label = document.createElement("span");
    const statusKey = `ui.${entry.status}` as "ui.existing" | "ui.planned" | "ui.completed";
    const status =
      entry.status && ["existing", "planned", "completed"].includes(entry.status)
        ? t(chart, statusKey)
        : entry.status;
    label.textContent = [markLabel(chart, entry.type, entry.label), status]
      .filter(Boolean)
      .join(" · ");
    item.append(swatch, label);
    list.append(item);
  }
  container.append(list);
}
