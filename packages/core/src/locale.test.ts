import { describe, expect, it } from "vitest";
import { getLocaleText, registerLocale } from "./locale.js";
import { Odontogram } from "./odontogram.js";
import { createPlugin } from "./plugin.js";

const view = createPlugin({
  name: "locale-test",
  views: [{ type: "permanent", render: () => undefined }],
});

describe("odontogram locales", () => {
  it("localizes controls and errors and falls back per missing message", () => {
    const root = document.createElement("div");
    const chart = new Odontogram(root, { plugins: [view], locale: "es", toolbar: {} });
    chart.render();

    expect(root.querySelector(".odontogram-toolbar")?.getAttribute("aria-label")).toBe(
      "Controles del odontograma",
    );
    expect(
      [...root.querySelectorAll(".odontogram-toolbar-group")].map((el) =>
        el.getAttribute("aria-label"),
      ),
    ).toEqual(["Vista", "Hallazgos", "Selección", "Historial"]);
    expect(() => new Odontogram(null, { locale: "es" }).render()).toThrow(
      "No hay un contenedor HTMLElement disponible",
    );
    expect(getLocaleText({ locale: "es" }, "error.invalidState")).toBe(
      "El estado del odontograma no es válido.",
    );
    chart.destroy();
  });

  it("supports registered locales, long text, and per-instance overrides", () => {
    registerLocale("qz", {
      direction: "rtl",
      messages: { "ui.legend": "عنوان طويل للغاية لواجهة مخطط الأسنان" },
    });
    expect(getLocaleText({ locale: "qz-ZZ" }, "ui.legend")).toBe(
      "عنوان طويل للغاية لواجهة مخطط الأسنان",
    );
    expect(
      getLocaleText(
        { locale: "qz", localeText: { "ui.legend": "Custom long legend heading" } },
        "ui.legend",
      ),
    ).toBe("Custom long legend heading");
    expect(getLocaleText({ locale: "qz" }, "ui.undo")).toBe("Undo");
  });
});
