import { afterEach, describe, expect, it, vi } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import type { ViewRenderContext } from "./types.js";

function setup() {
  const root = document.createElement("div");
  document.body.append(root);
  const render = vi.fn((ctx: ViewRenderContext) => {
    ctx.el.append(document.createElement("svg"));
  });
  const destroy = vi.fn();
  const plugin = createPlugin({
    name: "imperative-api-test",
    views: ["permanent", "deciduous"].map((type) => ({ type, render, destroy })),
  });
  return { root, render, destroy, plugin };
}

describe("robust imperative interface", () => {
  let roots: HTMLElement[] = [];
  afterEach(() => {
    roots.forEach((root) => root.remove());
    roots = [];
  });

  it("supports isolated instances, defensive queries, and idempotent destruction", () => {
    const a = setup();
    const b = setup();
    roots = [a.root, b.root];
    const first = new Odontogram(a.root, { plugins: [a.plugin], initialView: "permanent" });
    const second = new Odontogram(b.root, { plugins: [b.plugin], initialView: "permanent" });
    first.render();
    first.render();
    second.render();
    first.addMark({ id: "a", tooth: "16", surfaces: ["O"], type: "caries" });
    const query = first.getMarksForTooth("16");
    query[0]!.type = "changed-outside";
    expect(first.getMark("a")?.type).toBe("caries");
    expect(second.getMarks()).toEqual([]);
    first.destroy();
    first.destroy();
    expect(a.root.querySelector(".odontogram-host")).toBeNull();
    expect(b.root.querySelector(".odontogram-host")).not.toBeNull();
  });

  it("cancels initialization, view, and data changes through their pre-hooks", () => {
    const { root, plugin } = setup();
    roots = [root];
    const chart = new Odontogram(root, {
      plugins: [plugin],
      initialView: "permanent",
      beforeMount: () => false,
      beforeViewChange: () => false,
      beforeDataChange: () => false,
    });
    chart.render();
    expect(root.querySelector(".odontogram-host")).toBeNull();
    chart.setOption("beforeMount", undefined);
    chart.render();
    chart.changeView("deciduous");
    chart.addMark({ id: "blocked", tooth: "16", surfaces: ["O"], type: "caries" });
    expect(chart.getState().view).toBe("permanent");
    expect(chart.getMarks()).toEqual([]);
  });

  it("vetoes pre-change callbacks and reports callback errors without interrupting commits", () => {
    const { root, plugin } = setup();
    roots = [root];
    const errors = vi.fn();
    const stateDidChange = vi.fn(() => {
      throw new Error("observer failed");
    });
    const chart = new Odontogram(root, {
      plugins: [plugin],
      initialView: "permanent",
      errorDidOccur: errors,
      beforeSelectionChange: () => false,
      stateDidChange,
    });
    chart.render();
    chart.selectTooth("16");
    expect(chart.getSelection().teeth).toEqual([]);
    chart.addMark({ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" });
    expect(chart.hasMark("m1")).toBe(true);
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "callback",
        callback: "stateDidChange",
        error: expect.any(Error),
      }),
    );
  });

  it("runs mount, pre-change, state, and view callbacks in the documented order", () => {
    const { root, plugin } = setup();
    roots = [root];
    const order: string[] = [];
    const chart = new Odontogram(root, {
      plugins: [plugin],
      initialView: "permanent",
      beforeMount: () => {
        order.push("beforeMount");
      },
      viewDidMount: () => {
        order.push("viewDidMount");
      },
      mountDidMount: () => {
        order.push("mountDidMount");
      },
      beforeViewChange: () => {
        order.push("beforeViewChange");
      },
      beforeSelectionChange: () => {
        order.push("beforeSelectionChange");
      },
      beforeDataChange: () => {
        order.push("beforeDataChange");
      },
      marksSet: () => {
        order.push("marksSet");
      },
      selectionDidChange: () => {
        order.push("selectionDidChange");
      },
      stateDidChange: () => {
        order.push("stateDidChange");
      },
      editDidChange: () => {
        order.push("editDidChange");
      },
      viewWillUnmount: () => {
        order.push("viewWillUnmount");
      },
      viewDidChange: () => {
        order.push("viewDidChange");
      },
    });
    chart.render();
    order.length = 0;
    chart.setState({
      view: "deciduous",
      selection: { teeth: ["55"], surfaces: [] },
      marks: [{ id: "order", tooth: "55", surfaces: ["O"], type: "caries" }],
    });
    expect(order).toEqual([
      "beforeViewChange",
      "beforeSelectionChange",
      "beforeDataChange",
      "marksSet",
      "selectionDidChange",
      "stateDidChange",
      "editDidChange",
      "viewWillUnmount",
      "viewDidMount",
      "viewDidChange",
    ]);
  });

  it("coalesces batch notifications and remounts once after a batched view change", () => {
    const { root, plugin, render } = setup();
    roots = [root];
    const marksSet = vi.fn();
    const stateDidChange = vi.fn();
    const viewDidChange = vi.fn();
    const chart = new Odontogram(root, {
      plugins: [plugin],
      initialView: "permanent",
      marksSet,
      stateDidChange,
      viewDidChange,
    });
    chart.render();
    const initialRenderCount = render.mock.calls.length;
    chart.batchRendering(() => {
      chart.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
      chart.addMark({ tooth: "26", surfaces: ["M"], type: "restoration" });
      chart.changeView("deciduous");
    });
    expect(chart.getState().view).toBe("deciduous");
    expect(marksSet).toHaveBeenCalledTimes(1);
    expect(stateDidChange).toHaveBeenCalledTimes(1);
    expect(viewDidChange).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(initialRenderCount + 1);
  });

  it("rejects mutation reentrancy and allows destruction during a callback", () => {
    const { root, plugin } = setup();
    roots = [root];
    const errors = vi.fn();
    const chartRef: { current?: Odontogram } = {};
    const chart = new Odontogram(root, {
      plugins: [plugin],
      initialView: "permanent",
      errorDidOccur: errors,
      stateDidChange: () => {
        try {
          chartRef.current!.addMark({ tooth: "11", surfaces: ["M"], type: "caries" });
        } finally {
          chartRef.current!.destroy();
        }
      },
    });
    chartRef.current = chart;
    chart.render();
    chart.addMark({ tooth: "16", surfaces: ["O"], type: "caries" });
    expect(chart.getMarks()).toHaveLength(1);
    expect(root.querySelector(".odontogram-host")).toBeNull();
    expect(errors).toHaveBeenCalled();
  });
});
