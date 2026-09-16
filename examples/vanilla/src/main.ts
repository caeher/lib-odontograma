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
const views = ["permanent", "deciduous", "mixed"] as const;
for (const view of views) {
  document.getElementById(`btn-${view}`)!.addEventListener("click", () => {
    odontogram.changeView(view);
    document.querySelectorAll(".toolbar button[data-view]").forEach((b) => {
      b.classList.remove("active");
    });
    document.getElementById(`btn-${view}`)!.classList.add("active");
    log(`View changed to: ${view}`);
    if (view === "mixed") {
      odontogram.setTeethState({
        "55": "present",
        "15": "unerupted",
      });
      log("Mixed demo: 55 present, 15 unerupted (both coexist in catalog)");
    }
  });
}

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
  if (selection.surfaces.length === 0) {
    log("Select surfaces to add marks; use presence buttons for missing/unerupted teeth");
    return;
  }

  const marksToAdd: Array<OdontographicMark> = [];
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

  odontogram.addMarks(marksToAdd);
  log(`Added ${marksToAdd.length} mark(s)`);
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
