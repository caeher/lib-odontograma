import type { Odontogram } from "./odontogram.js";
import type {
  MarkCatalogEntry,
  OdontogramCommand,
  ToolbarContext,
  ToolbarControlId,
  ToolbarOptions,
} from "./types.js";

const VIEW_CHOICES = [
  ["permanent", "Permanent"],
  ["deciduous", "Deciduous"],
  ["primary", "Primary"],
  ["mixed", "Mixed"],
  ["upper", "Upper arch"],
  ["lower", "Lower arch"],
  ["quadrant-1", "Quadrant 1"],
  ["quadrant-2", "Quadrant 2"],
  ["quadrant-3", "Quadrant 3"],
  ["quadrant-4", "Quadrant 4"],
  ["quadrant-5", "Quadrant 5"],
  ["quadrant-6", "Quadrant 6"],
  ["quadrant-7", "Quadrant 7"],
  ["quadrant-8", "Quadrant 8"],
  ["tooth-16", "Tooth 16"],
  ["tooth-36", "Tooth 36"],
  ["tooth-55", "Tooth 55"],
] as const;

const DEFAULT_GROUPS: NonNullable<ToolbarOptions["groups"]> = [
  { id: "views", label: "View", controls: ["views"] },
  { id: "marks", label: "Marks", controls: ["marks"] },
  { id: "selection", label: "Selection", controls: ["selection"] },
  { id: "history", label: "History", controls: ["history"] },
];

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
    select.setAttribute("aria-label", "Odontogram view");
    for (const [value, label] of VIEW_CHOICES) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    const currentView = chart.getState().view;
    if (!VIEW_CHOICES.some(([value]) => value === currentView)) {
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
    type.setAttribute("aria-label", "Mark type");
    for (const item of types) {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = catalog.find((entry) => entry.type === item)?.label ?? item;
      type.append(option);
    }
    const status = document.createElement("select");
    status.setAttribute("aria-label", "Mark status");
    for (const item of statuses) {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
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
    const apply = createButton("Apply mark");
    apply.disabled = blocked || !hasTarget;
    apply.addEventListener("click", () => {
      chart.executeCommand({
        type: "apply-mark",
        mark: { type: type.value, status: status.value },
      });
    });
    const selectedMarkId = selection.annotations?.[0];
    const edit = createButton("Edit selected");
    edit.disabled = blocked || !selectedMarkId;
    edit.addEventListener("click", () => {
      if (selectedMarkId)
        chart.executeCommand({
          type: "edit-mark",
          markId: selectedMarkId,
          patch: { type: type.value, status: status.value },
        });
    });
    const remove = createButton("Delete selected");
    remove.disabled = blocked || !selectedMarkId;
    remove.addEventListener("click", () => {
      if (selectedMarkId) chart.executeCommand({ type: "delete-mark", markId: selectedMarkId });
    });
    group.append(type, status, apply, edit, remove);
    return;
  }

  if (control === "selection") {
    const clear = createButton("Clear selection");
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
  const undo = createButton("Undo");
  undo.disabled = blocked || !chart.canUndo();
  undo.addEventListener("click", () => chart.undo());
  const redo = createButton("Redo");
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
  const groups = config.groups ?? DEFAULT_GROUPS;
  container.className = `odontogram-toolbar odontogram-toolbar-${config.position ?? "top"}`;
  container.setAttribute("role", "toolbar");
  container.setAttribute("aria-label", "Odontogram controls");
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
  heading.textContent = config?.label ?? "Legend";
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
    label.textContent = [entry.label ?? entry.type, entry.status].filter(Boolean).join(" · ");
    item.append(swatch, label);
    list.append(item);
  }
  container.append(list);
}
