import { describe, expect, it, vi } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";

const emptyViewPlugin = createPlugin({
  name: "controls-test-view",
  views: [{ type: "permanent", render: () => undefined }],
});

describe("optional interaction controls", () => {
  it("renders configurable groups, legend catalog and custom actions", () => {
    const customAction = vi.fn();
    const root = document.createElement("div");
    const chart = new Odontogram(root, {
      plugins: [emptyViewPlugin],
      toolbar: {
        position: "bottom",
        groups: [
          {
            id: "custom",
            label: "Custom",
            controls: [{ id: "refresh", label: "Refresh", onClick: customAction }],
          },
          { id: "history", controls: ["history"] },
        ],
      },
      markCatalog: [
        { type: "caries", status: "planned", label: "Caries", symbol: "×", color: "red" },
      ],
    });
    chart.addMark({ tooth: "16", type: "restoration", status: "completed" });
    chart.render();

    expect(
      root.querySelector(".odontogram-toolbar")?.classList.contains("odontogram-toolbar-bottom"),
    ).toBe(true);
    expect(
      [...root.querySelectorAll(".odontogram-toolbar-group")].map((group) =>
        group.getAttribute("data-group"),
      ),
    ).toEqual(["custom", "history"]);
    expect(root.querySelector(".odontogram-legend")?.textContent).toContain("Caries · planned");
    expect(root.querySelector(".odontogram-legend")?.textContent).toContain(
      "restoration · completed",
    );
    (root.querySelector(".odontogram-toolbar button") as HTMLButtonElement).click();
    expect(customAction).toHaveBeenCalledOnce();
    chart.destroy();
  });

  it("omits integrated controls when toolbar and legend are disabled", () => {
    const root = document.createElement("div");
    const chart = new Odontogram(root, {
      plugins: [emptyViewPlugin],
      toolbar: false,
      legend: false,
    });
    chart.render();
    expect(root.querySelector(".odontogram-toolbar")?.children).toHaveLength(0);
    expect((root.querySelector(".odontogram-legend") as HTMLElement).hidden).toBe(true);
    chart.destroy();
  });

  it("reflects selection, read-only, and undo availability in built-in controls", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const chart = new Odontogram(root, {
      plugins: [emptyViewPlugin],
      toolbar: { groups: [{ id: "editing", controls: ["marks", "selection", "history"] }] },
    });
    chart.render();
    const getButtons = () => [
      ...root.querySelectorAll<HTMLButtonElement>(".odontogram-toolbar button"),
    ];
    expect(getButtons().map(({ disabled }) => disabled)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    chart.setSelection({ teeth: ["16"] });
    expect(getButtons()[0]?.disabled).toBe(false);
    getButtons()[0]?.focus();
    expect(document.activeElement).toBe(getButtons()[0]);
    getButtons()[0]?.click();
    expect(chart.getMarks()).toHaveLength(1);
    expect(document.activeElement).toBe(getButtons()[0]);
    expect(getButtons().at(-2)?.disabled).toBe(false);
    chart.setOption("readOnly", true);
    expect(getButtons().every(({ disabled }) => disabled)).toBe(true);
    chart.setOption("readOnly", false);
    chart.setOption("disabled", true);
    expect(getButtons().every(({ disabled }) => disabled)).toBe(true);
    chart.destroy();
    root.remove();
  });

  it("emits tooth and surface details on focus and activation with matching marks", () => {
    const detailDidChange = vi.fn();
    const root = document.createElement("div");
    const plugin = createPlugin({
      name: "detail-test",
      views: [
        {
          type: "permanent",
          render: (ctx) => {
            const tooth = document.createElement("button");
            tooth.dataset.testTooth = "16";
            tooth.addEventListener("focus", (event) => ctx.emitToothDetail?.("16", "focus", event));
            tooth.addEventListener("click", (event) => ctx.emitToothDetail?.("16", "click", event));
            const surface = document.createElement("button");
            surface.addEventListener("focus", (event) =>
              ctx.emitSurfaceDetail?.("16", "O", "focus", event),
            );
            surface.addEventListener("click", (event) =>
              ctx.emitSurfaceDetail?.("16", "O", "click", event),
            );
            ctx.el.append(tooth, surface);
          },
        },
      ],
    });
    const chart = new Odontogram(root, { plugins: [plugin], detailDidChange });
    chart.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
    chart.render();
    const buttons = root.querySelectorAll("button");
    buttons[0]?.dispatchEvent(new FocusEvent("focus"));
    buttons[1]?.dispatchEvent(new FocusEvent("focus"));
    buttons[1]?.click();
    expect(detailDidChange.mock.calls.map(([arg]) => arg)).toEqual([
      expect.objectContaining({
        tooth: "16",
        trigger: "focus",
        surfaces: ["O"],
        marks: [expect.objectContaining({ type: "caries" })],
      }),
      expect.objectContaining({
        tooth: "16",
        surface: "O",
        surfaces: ["O"],
        trigger: "focus",
        marks: [expect.objectContaining({ type: "caries" })],
      }),
      expect.objectContaining({
        tooth: "16",
        surface: "O",
        surfaces: ["O"],
        trigger: "click",
        marks: [expect.objectContaining({ type: "caries" })],
      }),
    ]);
    chart.destroy();
  });
});
