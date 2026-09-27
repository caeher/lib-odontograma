import { Odontogram } from "@odontogram/core";
import { svgPlugin } from "@odontogram/svg";
import "@odontogram/core/style.css";
import "@odontogram/svg/style.css";

const catalog = [
  { type: "caries", status: "existing", label: "Caries", symbol: "×", color: "#d32f2f" },
  { type: "restoration", status: "completed", label: "Restoration", symbol: "●", color: "#1976d2" },
];

function makeChart(container: HTMLElement, integrated: boolean, detail: HTMLElement): Odontogram {
  const chart = new Odontogram(container, {
    plugins: [svgPlugin],
    initialView: "permanent",
    height: 370,
    markCatalog: catalog,
    toolbar: integrated
      ? {
          position: "top",
          groups: [
            { id: "view-and-history", label: "Chart", controls: ["views", "history"] },
            {
              id: "mark-and-selection",
              label: "Mark and selection",
              controls: ["marks", "selection"],
            },
            {
              id: "custom",
              label: "Custom",
              controls: [
                {
                  id: "custom-caries",
                  label: "Apply caries",
                  disabled: (ctx) =>
                    ctx.disabled ||
                    ctx.readOnly ||
                    (ctx.state.selection.teeth.length === 0 &&
                      ctx.state.selection.surfaces.length === 0),
                  onClick: (ctx) =>
                    ctx.executeCommand({
                      type: "apply-mark",
                      mark: { type: "caries", status: "existing" },
                    }),
                },
              ],
            },
          ],
        }
      : false,
    legend: integrated ? undefined : false,
    detailDidChange: ({ tooth, surface, marks, trigger }) => {
      detail.textContent = `Tooth ${tooth}${surface ? ` · ${surface}` : ""} · ${marks.length} mark(s) · ${trigger}`;
    },
  });
  chart.render();
  return chart;
}

makeChart(
  document.querySelector<HTMLElement>("#integrated")!,
  true,
  document.querySelector<HTMLElement>("#integrated-detail")!,
);
const external = makeChart(
  document.querySelector<HTMLElement>("#external")!,
  false,
  document.querySelector<HTMLElement>("#external-detail")!,
);

document.querySelectorAll<HTMLButtonElement>("#external-controls button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.action === "apply") {
      external.executeCommand({ type: "apply-mark", mark: { type: "caries", status: "existing" } });
    } else if (button.dataset.action === "undo") external.undo();
    else if (button.dataset.action === "redo") external.redo();
    else if (button.dataset.action === "clear") external.setSelection({ teeth: [], surfaces: [] });
  });
});
