import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";
import type { ViewRenderContext } from "./types.js";

function createMockView(type: string) {
  let renderCount = 0;
  const view = {
    type,
    render: vi.fn((ctx: ViewRenderContext) => {
      renderCount++;
      const div = document.createElement("div");
      div.className = `mock-view-${type}`;
      div.textContent = `render-${renderCount}`;
      ctx.el.appendChild(div);
    }),
    destroy: vi.fn(),
  };
  return { view, getRenderCount: () => renderCount };
}

describe("Odontogram", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("render() mounts host element and calls view render", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();

    expect(container.querySelector(".odontogram-host")).toBeTruthy();
    expect(view.render).toHaveBeenCalled();
  });

  it("destroy() removes host and calls view destroy", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();
    odontogram.destroy();

    expect(container.querySelector(".odontogram-host")).toBeNull();
    expect(view.destroy).toHaveBeenCalled();
  });

  it("getOption/setOption work for mutable options", () => {
    const odontogram = new Odontogram(container, { notation: "fdi" });
    expect(odontogram.getOption("notation")).toBe("fdi");

    odontogram.setOption("notation", "universal");
    expect(odontogram.getOption("notation")).toBe("universal");
  });

  it("setOption warns for immutable options", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const odontogram = new Odontogram(container, { initialView: "permanent" });
    odontogram.setOption("initialView", "deciduous");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("changeView switches view and re-renders", () => {
    const permanent = createMockView("permanent");
    const deciduous = createMockView("deciduous");
    const plugin = createPlugin({
      name: "test",
      views: [permanent.view, deciduous.view],
    });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();
    expect(odontogram.getState().view).toBe("permanent");

    odontogram.changeView("deciduous");
    expect(odontogram.getState().view).toBe("deciduous");
    expect(deciduous.view.render).toHaveBeenCalled();
  });

  it("getState/setState manage marks and selection", () => {
    const odontogram = new Odontogram(container, { initialView: "permanent" });

    odontogram.setState({
      marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
      selection: { teeth: ["16"], surfaces: [] },
    });

    const state = odontogram.getState();
    expect(state.marks).toHaveLength(1);
    expect(state.marks[0].type).toBe("caries");
    expect(state.selection.teeth).toContain("16");
  });

  it("batchRendering coalesces multiple updates into one render", () => {
    const { view } = createMockView("permanent");
    const plugin = createPlugin({ name: "test", views: [view] });
    const odontogram = new Odontogram(container, {
      plugins: [plugin],
      initialView: "permanent",
    });

    odontogram.render();
    const callsAfterRender = view.render.mock.calls.length;

    odontogram.batchRendering(() => {
      odontogram.setOption("notation", "palmer");
      odontogram.setState({ marks: [{ id: "m1", tooth: "11", surfaces: ["M"], type: "restoration" }] });
    });

    // Initial render + one batched render
    expect(view.render.mock.calls.length).toBe(callsAfterRender + 1);
  });

  it("render without view plugin logs warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const odontogram = new Odontogram(container);
    odontogram.render();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("No view implementation"),
    );
    warn.mockRestore();
  });
});
