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
  const state = odontogram.getState();
  if (state.selection.teeth.length === 0) {
    log("Select one or more teeth first");
    return;
  }
  const teeth = { ...state.teeth };
  for (const tooth of state.selection.teeth) {
    if (presence === "present") {
      delete teeth[tooth];
    } else {
      teeth[tooth] = { presence };
    }
  }
  odontogram.setState({ teeth });
  log(`Set ${state.selection.teeth.join(", ")} → ${presence}`);
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
      odontogram.setState({
        teeth: {
          "55": { presence: "present" },
          "15": { presence: "unerupted" },
        },
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
  const state = odontogram.getState();
  const newMarks: OdontographicMark[] = [...state.marks];

  for (const { tooth, surface } of state.selection.surfaces) {
    markCounter++;
    newMarks.push({
      id: `mark-${markCounter}`,
      tooth,
      surfaces: [surface],
      type: markCounter % 2 === 0 ? "caries" : "restoration",
    });
  }

  if (state.selection.teeth.length > 0 && state.selection.surfaces.length === 0) {
    log("Select surfaces to add marks; use presence buttons for missing/unerupted teeth");
    return;
  }

  odontogram.setState({ marks: newMarks });
});

// Clear marks
document.getElementById("btn-clear-marks")!.addEventListener("click", () => {
  odontogram.setState({ marks: [] });
  log("Marks cleared");
});

// Batch rendering demo
document.getElementById("btn-batch")!.addEventListener("click", () => {
  odontogram.batchRendering(() => {
    odontogram.setOption("selectionColor", "#ff9800");
    odontogram.setState({
      marks: [
        { id: "batch-1", tooth: "16", surfaces: ["O", "M"], type: "caries" },
        { id: "batch-2", tooth: "26", surfaces: ["D"], type: "restoration" },
        { id: "batch-3", tooth: "36", surfaces: ["B"], type: "caries" },
      ],
      teeth: {
        "48": { presence: "missing" },
      },
    });
  });
  log("Batch update applied (single re-render)");
});
