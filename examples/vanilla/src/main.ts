import { Odontogram } from "@odontogram/core";
import { svgPlugin } from "@odontogram/svg";
import type { Notation, OdontographicMark, ToothPresence } from "@odontogram/core";
import "@odontogram/core/style.css";
import "@odontogram/svg/style.css";

const container = document.getElementById("odontogram-container")!;
const logEl = document.getElementById("log")!;

let markCounter = 0;
const notations: Notation[] = ["fdi", "universal", "palmer"];
let notationIdx = 0;

function log(msg: string): void {
  logEl.textContent =
    `${new Date().toLocaleTimeString()} — ${msg}\n${logEl.textContent ?? ""}`.slice(0, 2000);
}

const odontogram = new Odontogram(container, {
  plugins: [svgPlugin],
  initialView: "permanent",
  notation: "fdi",
  height: 400,
  selectable: true,
  markColors: {
    caries: "#ef5350",
    restoration: "#42a5f5",
  },
  surfaceClick: ({ tooth, surface }) => {
    log(`Surface click: tooth ${tooth}, surface ${surface}`);
  },
  selectionDidChange: ({ selection }) => {
    const parts: string[] = [];
    if (selection.teeth.length) parts.push(`teeth: ${selection.teeth.join(", ")}`);
    if (selection.surfaces.length) {
      parts.push(
        `surfaces: ${selection.surfaces.map((s) => `${s.tooth}/${s.surface}`).join(", ")}`,
      );
    }
    log(`Selection: ${parts.join(" | ") || "(empty)"}`);
  },
  marksSet: ({ marks }) => {
    log(`Marks updated: ${marks.length} total`);
  },
  toothClassNames: ({ tooth, isSelected }) => (isSelected ? "tooth-selected" : `tooth-${tooth}`),
  surfaceClassNames: ({ isSelected }) => (isSelected ? "app-surface-selected" : ""),
  toothContent: ({ tooth }) => {
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `FDI tooth ${tooth}`;
    return title;
  },
});

odontogram.render();

function setPresenceForSelection(presence: ToothPresence): void {
  const selection = odontogram.getSelection();
  if (selection.teeth.length === 0) {
    log("Select one or more teeth first");
    return;
  }
  odontogram.batch(() => {
    for (const tooth of selection.teeth) {
      odontogram.setToothState(tooth, presence, { pruneMarks: true });
    }
  });
  log(`Set ${selection.teeth.join(", ")} → ${presence}`);
}

// View buttons
const viewButtons = document.querySelectorAll<HTMLButtonElement>(
  "#views-toolbar button[data-view]",
);
viewButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view as any;
    odontogram.changeView(view);
    viewButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    log(
      `View changed to: ${view} (preserved ${odontogram.getMarks().length} marks, ${odontogram.getSelection().teeth.length} selected teeth)`,
    );
    if (view === "mixed") {
      odontogram.setTeethState({
        "55": "present",
        "15": "unerupted",
      });
      log("Mixed demo: 55 present, 15 unerupted (both coexist in catalog)");
    }
  });
});

// Orientation toggle
let showOrientation = true;
const btnToggleOrientation = document.getElementById("btn-toggle-orientation")!;
btnToggleOrientation.addEventListener("click", () => {
  showOrientation = !showOrientation;
  odontogram.setOption("showOrientationLabels", showOrientation);
  btnToggleOrientation.textContent = `Orientation: ${showOrientation ? "ON (R/L)" : "OFF"}`;
  btnToggleOrientation.classList.toggle("active", showOrientation);
  log(`Orientation labels: ${showOrientation ? "enabled" : "disabled"}`);
});

// Midline toggle
let showMidline = true;
const btnToggleMidline = document.getElementById("btn-toggle-midline")!;
btnToggleMidline.addEventListener("click", () => {
  showMidline = !showMidline;
  odontogram.setOption("showMidline", showMidline);
  btnToggleMidline.textContent = `Midline: ${showMidline ? "ON" : "OFF"}`;
  btnToggleMidline.classList.toggle("active", showMidline);
  log(`Midline divider: ${showMidline ? "enabled" : "disabled"}`);
});

// Filter controls
const anteriorTeeth = [
  "13",
  "12",
  "11",
  "21",
  "22",
  "23",
  "43",
  "42",
  "41",
  "31",
  "32",
  "33",
] as const;
document.getElementById("btn-filter-anterior")?.addEventListener("click", () => {
  odontogram.setOption("visibleTeeth", [...anteriorTeeth]);
  log(
    `Filtered visible teeth to anterior group (${anteriorTeeth.length} teeth). Selection and marks on hidden teeth are preserved in model.`,
  );
});
document.getElementById("btn-filter-all")?.addEventListener("click", () => {
  odontogram.setOption("visibleTeeth", undefined);
  log("Reset tooth filter: all teeth in current view are visible.");
});

// Notation toggle
document.getElementById("btn-notation")!.addEventListener("click", () => {
  notationIdx = (notationIdx + 1) % notations.length;
  const notation = notations[notationIdx];
  odontogram.setOption("notation", notation);
  (document.getElementById("btn-notation") as HTMLButtonElement).textContent =
    `Notation: ${notation.toUpperCase()}`;
  log(`Notation: ${notation} (presentation only; canonical state preserved)`);
});

// Presence controls
document.getElementById("btn-present")!.addEventListener("click", () => {
  setPresenceForSelection("present");
});
document.getElementById("btn-missing")!.addEventListener("click", () => {
  setPresenceForSelection("missing");
});
document.getElementById("btn-unerupted")!.addEventListener("click", () => {
  setPresenceForSelection("unerupted");
});

// Add mark on current selection
document.getElementById("btn-add-mark")!.addEventListener("click", () => {
  const selection = odontogram.getSelection();
  if (selection.surfaces.length === 0 && selection.teeth.length === 0) {
    log("Select surfaces or teeth to add marks");
    return;
  }

  const marksToAdd: Array<OdontographicMark> = [];
  if (selection.surfaces.length > 0) {
    for (const { tooth, surface } of selection.surfaces) {
      markCounter++;
      marksToAdd.push({
        id: `mark-${markCounter}`,
        tooth,
        surfaces: [surface],
        type: markCounter % 2 === 0 ? "caries" : "restoration",
        target: { tooth, surfaces: [surface] },
      });
    }
  } else {
    for (const tooth of selection.teeth) {
      markCounter++;
      marksToAdd.push({
        id: `mark-${markCounter}`,
        tooth,
        type: "crown",
        target: { tooth },
      });
    }
  }

  odontogram.addMarks(marksToAdd);
  log(`Added ${marksToAdd.length} mark(s)`);
});

// Add bridge annotation (multi-tooth)
document.getElementById("btn-add-bridge")?.addEventListener("click", () => {
  odontogram.batch(() => {
    odontogram.setToothState("15", "missing", { pruneMarks: true });
    odontogram.addMark({
      id: "bridge-14-16",
      type: "bridge",
      status: "planned",
      target: { teeth: ["14", "15", "16"] },
      text: "3-unit porcelain-fused-to-metal bridge",
      style: { stroke: "#1976d2", strokeWidth: 4 },
    });
  });
  log("Placed 3-unit bridge across teeth 14, 15 (pontic), 16 (abutment)");
});

// Clear marks
document.getElementById("btn-clear-marks")!.addEventListener("click", () => {
  const cleared = odontogram.clearMarks();
  log(`Cleared ${cleared} marks`);
});

// Batch rendering demo
document.getElementById("btn-batch")!.addEventListener("click", () => {
  odontogram.batch(() => {
    odontogram.setOption("selectionColor", "#ff9800");
    odontogram.addMarks([
      { id: "batch-1", tooth: "16", surfaces: ["O", "M"], type: "caries" },
      { id: "batch-2", tooth: "26", surfaces: ["D"], type: "restoration" },
      { id: "batch-3", tooth: "36", surfaces: ["B"], type: "caries" },
    ]);
    odontogram.setToothState("48", "missing", { pruneMarks: true });
  });
  log(`Batch update applied (revision: ${odontogram.getRevision()}, single re-render)`);
});
