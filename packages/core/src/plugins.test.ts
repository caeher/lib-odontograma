import { afterEach, describe, expect, it, vi } from "vitest";
import { svgPlugin } from "@odontogram/svg";
import { Odontogram, createPlugin, ODONTOGRAM_PLUGIN_API_VERSION } from "./index.js";
import { OdontogramError, VALIDATION_CODES } from "./errors.js";
import type { OdontogramPluginDef } from "./types.js";
import { customBridgePlugin } from "../../../examples/plugins/custom-bridge-plugin.js";
import { customHaderupNotationPlugin } from "../../../examples/plugins/custom-haderup-notation-plugin.js";

const compatible = `^${ODONTOGRAM_PLUGIN_API_VERSION}`;

type PluginExtras = Partial<OdontogramPluginDef>;

function plugin(id: string, extras: PluginExtras = {}) {
  const { version = "1.0.0", apiCompatibility = compatible, ...contributions } = extras;
  return createPlugin({
    id,
    version,
    apiCompatibility,
    ...contributions,
  });
}

describe("typed odontogram plugins", () => {
  let roots: HTMLElement[] = [];
  afterEach(() => {
    roots.forEach((root) => root.remove());
    roots = [];
  });

  it("checks duplicate ids, dependency presence, cycles, versions, and API compatibility", () => {
    const duplicate = plugin("duplicate");
    expect(() => new Odontogram(null, { plugins: [duplicate, duplicate] })).toThrow(
      expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_DUPLICATE_ID }),
    );
    expect(
      () =>
        new Odontogram(null, {
          plugins: [plugin("requires-missing", { dependencies: [{ id: "missing" }] })],
        }),
    ).toThrow(expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_MISSING_DEPENDENCY }));
    expect(
      () =>
        new Odontogram(null, {
          plugins: [
            plugin("cycle-a", { dependencies: [{ id: "cycle-b" }] }),
            plugin("cycle-b", { dependencies: [{ id: "cycle-a" }] }),
          ],
        }),
    ).toThrow(expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_DEPENDENCY_CYCLE }));
    expect(
      () =>
        new Odontogram(null, {
          plugins: [plugin("old-api", { apiCompatibility: "^9.0.0" })],
        }),
    ).toThrow(expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_INCOMPATIBLE_API }));
    expect(
      () =>
        new Odontogram(null, {
          plugins: [
            plugin("duplicate-views", {
              views: [
                { type: "custom-view", render: () => {} },
                { type: "custom-view", render: () => {} },
              ],
            }),
          ],
        }),
    ).toThrow(expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_CONTRIBUTION_CONFLICT }));
    expect(
      () =>
        new Odontogram(null, {
          plugins: [
            plugin("versioned-dependency", { version: "2.0.0" }),
            plugin("version-consumer", {
              dependencies: [{ id: "versioned-dependency", version: "^1.0.0" }],
            }),
          ],
        }),
    ).toThrow(expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_VERSION_MISMATCH }));
  });

  it("registers in dependency order and runs cleanup in reverse on unregistration", () => {
    const root = document.createElement("div");
    document.body.append(root);
    roots = [root];
    const events: string[] = [];
    const base = plugin("base-plugin", {
      onRegister: () => {
        events.push("base-register");
        return () => events.push("base-cleanup");
      },
      onUnregister: () => {
        events.push("base-unregister");
      },
    });
    const extension = plugin("extension-plugin", {
      dependencies: [{ id: "base-plugin", version: "^1.0.0" }],
      onRegister: () => {
        events.push("extension-register");
        return () => events.push("extension-cleanup");
      },
      onUnregister: () => {
        events.push("extension-unregister");
      },
    });
    const chart = new Odontogram(root, { plugins: [extension, base] });
    expect(events).toEqual(["base-register", "extension-register"]);
    expect(() => chart.unregisterPlugin("base-plugin")).toThrow(OdontogramError);
    expect(chart.unregisterPlugin("extension-plugin")).toBe(true);
    expect(chart.unregisterPlugin("base-plugin")).toBe(true);
    expect(events).toEqual([
      "base-register",
      "extension-register",
      "extension-cleanup",
      "extension-unregister",
      "base-cleanup",
      "base-unregister",
    ]);
  });

  it("protects an active plugin view until the chart switches away", () => {
    const root = document.createElement("div");
    document.body.append(root);
    roots = [root];
    const customView = plugin("custom-view-owner", {
      views: [
        { type: "custom-view", render: ({ el }) => el.append(document.createElement("div")) },
      ],
    });
    const chart = new Odontogram(root, { plugins: [svgPlugin] });
    chart.registerPlugin(customView);
    chart.render();
    chart.changeView("custom-view");
    expect(() => chart.unregisterPlugin("custom-view-owner")).toThrow(
      expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_IN_USE }),
    );
    chart.changeView("permanent");
    expect(chart.unregisterPlugin("custom-view-owner")).toBe(true);
  });

  it("renders plugin dental anatomy and custom symbols and exposes plugin tools", () => {
    const root = document.createElement("div");
    document.body.append(root);
    roots = [root];
    const renderer = vi.fn(({ element }: { element: SVGGElement }) => {
      const mark = document.createElementNS("http://www.w3.org/2000/svg", "path");
      mark.setAttribute("class", "custom-canine-renderer");
      element.append(mark);
    });
    const symbol = vi.fn(
      ({
        element,
        targets,
      }: {
        element: SVGGElement;
        targets: Array<{ x: number; y: number }>;
      }) => {
        const diamond = document.createElementNS("http://www.w3.org/2000/svg", "path");
        diamond.setAttribute("class", "custom-bridge-symbol");
        diamond.setAttribute("d", `M ${targets[0]!.x} ${targets[0]!.y} l 4 -4 l 4 4 l -4 4 z`);
        element.append(diamond);
      },
    );
    const tool = vi.fn(
      ({
        executeCommand,
      }: {
        executeCommand: (command: {
          type: "apply-mark";
          mark: { type: string; status: string };
        }) => unknown;
      }) => {
        executeCommand({ type: "apply-mark", mark: { type: "plugin-bridge", status: "planned" } });
      },
    );
    const extension = plugin("clinic-symbols", {
      dentalRenderers: [
        { id: "molar-renderer", matches: (tooth: string) => tooth === "16", render: renderer },
      ],
      symbols: [{ id: "bridge-symbol", markTypes: ["plugin-bridge"], render: symbol }],
      tools: [{ id: "apply-bridge", label: "Apply bridge", onActivate: tool }],
    });
    const chart = new Odontogram(root, {
      plugins: [svgPlugin, extension],
      initialView: "permanent",
      toolbar: {},
    });
    chart.render();
    expect(root.querySelector(".custom-canine-renderer")).not.toBeNull();
    chart.setSelection({ teeth: ["16", "26"], surfaces: [] });
    const toolButton = [...root.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply bridge",
    );
    expect(toolButton).toBeDefined();
    toolButton!.click();
    expect(chart.getMarks().map(({ type }) => type)).toEqual(["plugin-bridge"]);
    expect(root.querySelector(".custom-bridge-symbol")).not.toBeNull();
    expect(renderer).toHaveBeenCalled();
    expect(symbol).toHaveBeenCalled();
  });

  it("isolates failing contributions and cleans up dynamically registered plugins", () => {
    const root = document.createElement("div");
    document.body.append(root);
    roots = [root];
    const errors = vi.fn();
    const cleanup = vi.fn();
    const broken = plugin("broken-symbol", {
      onRegister: () => cleanup,
      symbols: [
        {
          id: "bad-symbol",
          markTypes: ["bad-bridge"],
          render: () => {
            throw new Error("symbol failure");
          },
        },
      ],
      tools: [
        {
          id: "broken-tool",
          label: "Broken tool",
          onActivate: () => {
            throw new Error("tool failure");
          },
        },
      ],
    });
    const chart = new Odontogram(root, {
      plugins: [svgPlugin],
      initialView: "permanent",
      pluginDidError: errors,
      toolbar: {},
    });
    chart.registerPlugin(broken);
    chart.render();
    chart.addMark({ type: "bad-bridge", target: { kind: "teeth", teeth: ["16", "26"] } });
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "broken-symbol", phase: "symbol:bad-symbol" }),
    );
    expect(root.querySelector(".odontogram-host")).not.toBeNull();
    [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "Broken tool")
      ?.click();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "broken-symbol", phase: "tool:broken-tool" }),
    );
    expect(chart.unregisterPlugin("broken-symbol")).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(chart.unregisterPlugin("broken-symbol")).toBe(false);
  });

  it("skips a plugin whose registration hook fails without blocking unrelated plugins", () => {
    const errors = vi.fn();
    const registerHealthy = vi.fn();
    const chart = new Odontogram(null, {
      pluginDidError: errors,
      plugins: [
        plugin("fails-to-register", {
          onRegister: () => {
            throw new Error("registration failed");
          },
        }),
        plugin("depends-on-failure", {
          dependencies: [{ id: "fails-to-register" }],
          onRegister: registerHealthy,
        }),
        plugin("unrelated", { onRegister: registerHealthy }),
      ],
    });
    expect(chart).toBeInstanceOf(Odontogram);
    expect(registerHealthy).toHaveBeenCalledOnce();
    expect(errors).toHaveBeenCalledTimes(2);
  });

  it("integrates customBridgePlugin with custom molar anatomy, symbol, and tool plus clean unregistration", () => {
    const root = document.createElement("div");
    document.body.append(root);
    roots = [root];

    const chart = new Odontogram(root, {
      plugins: [svgPlugin, customBridgePlugin],
      initialView: "permanent",
      toolbar: {},
    });
    chart.render();

    // Dental renderer contribution check
    expect(root.querySelector(".example-molar-fissure")).not.toBeNull();

    // Select teeth for bridge
    chart.setSelection({ teeth: ["14", "15", "16"], surfaces: [] });

    // Tool contribution check
    const toolButton = [...root.querySelectorAll("button")].find(
      (btn) => btn.textContent === "Apply bridge",
    );
    expect(toolButton).toBeDefined();
    expect(toolButton?.disabled).toBe(false);
    toolButton!.click();

    // Custom symbol contribution check
    expect(chart.getMarks().map(({ type }) => type)).toEqual(["bridge"]);
    expect(root.querySelector(".example-bridge-symbol")).not.toBeNull();

    // Unregistration & clean removal of contributions
    expect(chart.unregisterPlugin("@example/odontogram-bridge")).toBe(true);
    expect(root.querySelector(".example-molar-fissure")).toBeNull();
  });

  it("integrates customHaderupNotationPlugin and updates tooth labels and accessible attributes", () => {
    const root = document.createElement("div");
    document.body.append(root);
    roots = [root];

    const chart = new Odontogram(root, {
      plugins: [svgPlugin, customHaderupNotationPlugin],
      initialView: "permanent",
      notation: "haderup",
    });
    chart.render();

    const tooth16 = root.querySelector('[data-tooth="16"]');
    expect(tooth16?.getAttribute("data-notation-label")).toBe("6+");

    const tooth21 = root.querySelector('[data-tooth="21"]');
    expect(tooth21?.getAttribute("data-notation-label")).toBe("+1");

    const tooth31 = root.querySelector('[data-tooth="31"]');
    expect(tooth31?.getAttribute("data-notation-label")).toBe("-1");

    const tooth41 = root.querySelector('[data-tooth="41"]');
    expect(tooth41?.getAttribute("data-notation-label")).toBe("1-");

    // Dynamic unregistration cleans up notation
    expect(chart.unregisterPlugin("@example/odontogram-haderup-notation")).toBe(true);
    chart.setOption("notation", "fdi");
    expect(root.querySelector('[data-tooth="16"]')?.getAttribute("data-notation-label")).toBe("16");
  });

  it("detects duplicate notation contribution ids and isolates notation formatting failures", () => {
    const dupNotationA = plugin("notation-a", {
      notations: [{ id: "custom-dup", name: "Dup A", format: (t) => t }],
    });
    const dupNotationB = plugin("notation-b", {
      notations: [{ id: "custom-dup", name: "Dup B", format: (t) => t }],
    });

    expect(() => new Odontogram(null, { plugins: [dupNotationA, dupNotationB] })).toThrow(
      expect.objectContaining({ code: VALIDATION_CODES.ERR_PLUGIN_CONTRIBUTION_CONFLICT }),
    );

    const errors = vi.fn();
    const failingNotation = plugin("failing-notation-plugin", {
      notations: [
        {
          id: "buggy-notation",
          name: "Buggy",
          format: () => {
            throw new Error("notation format error");
          },
        },
      ],
    });

    const chart = new Odontogram(null, {
      plugins: [failingNotation],
      pluginDidError: errors,
    });

    const adapter = chart.getNotation("buggy-notation");
    expect(adapter).toBeDefined();
    expect(adapter?.format("16")).toBe("16"); // Safe fallback on error
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "failing-notation-plugin",
        phase: "notation:buggy-notation:format",
      }),
    );
  });
});
