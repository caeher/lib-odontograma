#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const scratchDir = path.resolve(rootDir, "node_modules", ".tmp", "verify-pack");

function log(step, msg) {
  console.log(`\x1b[36m[verify-pack]\x1b[0m \x1b[1m${step}\x1b[0m: ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}

function fail(msg, error) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  if (error) console.error(error);
  process.exit(1);
}

function run(cmd, cwd = rootDir) {
  return execSync(cmd, { cwd, stdio: "pipe", encoding: "utf-8" });
}

async function main() {
  log("Step 1", "Building workspace packages...");
  run("npm run build", rootDir);
  success("Built all packages successfully.");

  // Clean and prepare scratch directory
  if (fs.existsSync(scratchDir)) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
  fs.mkdirSync(scratchDir, { recursive: true });

  const tarballDir = path.join(scratchDir, "tarballs");
  fs.mkdirSync(tarballDir, { recursive: true });

  log("Step 2", "Packing packages into local tarballs (.tgz)...");
  const packages = ["core", "dentition", "svg"];
  const tarballs = {};

  for (const pkg of packages) {
    const pkgDir = path.join(rootDir, "packages", pkg);
    const packOutput = run(`npm pack --pack-destination "${tarballDir}"`, pkgDir).trim();
    const filename = packOutput.split("\n").filter(Boolean).pop().trim();
    tarballs[pkg] = path.join(tarballDir, filename);
    log("  Packed", `@odontogram/${pkg} -> ${filename}`);
  }
  success("All tarballs created.");

  // --------------------------------------------------------------------------
  // Verify JavaScript Consumer
  // --------------------------------------------------------------------------
  log("Step 3", "Setting up isolated JavaScript consumer...");
  const jsConsumerDir = path.join(scratchDir, "js-consumer");
  fs.mkdirSync(jsConsumerDir, { recursive: true });

  const jsPackageJson = {
    name: "test-js-consumer",
    version: "1.0.0",
    private: true,
    type: "module",
    dependencies: {
      "@odontogram/core": `file:${tarballs.core}`,
      "@odontogram/dentition": `file:${tarballs.dentition}`,
      "@odontogram/svg": `file:${tarballs.svg}`,
      jsdom: "^25.0.1",
    },
  };
  fs.writeFileSync(
    path.join(jsConsumerDir, "package.json"),
    JSON.stringify(jsPackageJson, null, 2),
  );

  log("  Installing tarballs in JS consumer...", jsConsumerDir);
  run("npm install --no-audit --no-fund", jsConsumerDir);

  const jsConsumerScript = `
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Set up JSDOM environment
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='odontogram'></div></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.MouseEvent = dom.window.MouseEvent;

// 1. Verify CSS assets exist in package distributions
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreCssPath = path.resolve(__dirname, "node_modules/@odontogram/core/dist/style.css");
const svgCssPath = path.resolve(__dirname, "node_modules/@odontogram/svg/dist/style.css");

if (!fs.existsSync(coreCssPath)) throw new Error("Missing @odontogram/core/dist/style.css");
if (!fs.existsSync(svgCssPath)) throw new Error("Missing @odontogram/svg/dist/style.css");

// 2. Import packages from installed tarballs
const { Odontogram, createPlugin } = await import("@odontogram/core");
const { svgPlugin } = await import("@odontogram/svg");
const { getPermanentTeeth, getDeciduousTeeth, toNotation } = await import("@odontogram/dentition");

if (typeof Odontogram !== "function") throw new Error("Odontogram export is not a constructor");
if (!svgPlugin || typeof svgPlugin !== "object") throw new Error("svgPlugin export is missing");
if (getPermanentTeeth().length !== 32) throw new Error("getPermanentTeeth should return 32 teeth");
if (getDeciduousTeeth().length !== 20) throw new Error("getDeciduousTeeth should return 20 teeth");

// 3. Test Odontogram instance lifecycle and rendering
const container = document.getElementById("odontogram");
let surfaceClicked = null;
let selectionChanged = null;

const odontogram = new Odontogram(container, {
  plugins: [svgPlugin],
  initialView: "permanent",
  notation: "fdi",
  selectable: true,
  surfaceClick: (arg) => { surfaceClicked = arg; },
  selectionDidChange: (arg) => { selectionChanged = arg; },
});

odontogram.render();

const hostEl = container.querySelector(".odontogram-host");
if (!hostEl) throw new Error("Host element .odontogram-host not mounted");

const svgEl = container.querySelector("svg.odontogram-svg");
if (!svgEl) throw new Error("SVG element .odontogram-svg not rendered by plugin");

// Test state updates & marks
odontogram.setState({
  marks: [{ id: "m1", tooth: "16", surfaces: ["O"], type: "caries" }],
  teeth: { "48": { presence: "missing" } },
});

const state = odontogram.getState();
if (state.marks.length !== 1 || state.marks[0].tooth !== "16") {
  throw new Error("Marks not updated correctly in getState()");
}
if (state.teeth["48"]?.presence !== "missing") {
  throw new Error("Teeth overlay not updated correctly in getState()");
}

// Test batch rendering
odontogram.batchRendering(() => {
  odontogram.setOption("notation", "universal");
  odontogram.changeView("deciduous");
});

if (odontogram.getState().view !== "deciduous") {
  throw new Error("changeView inside batchRendering failed");
}

odontogram.destroy();
if (container.querySelector(".odontogram-host")) {
  throw new Error("Host element was not unmounted on destroy()");
}

console.log("JS consumer verified successfully!");
`;

  fs.writeFileSync(path.join(jsConsumerDir, "test.mjs"), jsConsumerScript);
  log("  Executing JS consumer test...", jsConsumerDir);
  run("node test.mjs", jsConsumerDir);
  success("JavaScript consumer passed tarball installation and runtime test.");

  // --------------------------------------------------------------------------
  // Verify TypeScript Consumer
  // --------------------------------------------------------------------------
  log("Step 4", "Setting up isolated TypeScript consumer...");
  const tsConsumerDir = path.join(scratchDir, "ts-consumer");
  fs.mkdirSync(tsConsumerDir, { recursive: true });

  const tsPackageJson = {
    name: "test-ts-consumer",
    version: "1.0.0",
    private: true,
    type: "module",
    dependencies: {
      "@odontogram/core": `file:${tarballs.core}`,
      "@odontogram/dentition": `file:${tarballs.dentition}`,
      "@odontogram/svg": `file:${tarballs.svg}`,
      typescript: "^5.7.2",
      "@types/node": "^22.10.2",
      jsdom: "^25.0.1",
    },
  };
  fs.writeFileSync(
    path.join(tsConsumerDir, "package.json"),
    JSON.stringify(tsPackageJson, null, 2),
  );

  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ES2022", "DOM"],
      strict: true,
      noUncheckedIndexedAccess: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ["test.ts"],
  };
  fs.writeFileSync(path.join(tsConsumerDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

  log("  Installing tarballs in TS consumer...", tsConsumerDir);
  run("npm install --no-audit --no-fund", tsConsumerDir);

  const tsConsumerScript = `
import {
  Odontogram,
  createPlugin,
  type OdontogramOptions,
  type OdontogramPlugin,
  type OdontogramState,
  type OdontographicMark,
  type SelectionState,
  type SurfaceClickArg,
  type SurfaceId,
  type ToothClickArg,
  type ToothId,
  type ToothPresence,
  type ToothState,
  type ViewMountArg,
  type ViewRenderContext,
  type ViewType,
} from "@odontogram/core";

import { svgPlugin } from "@odontogram/svg";

import {
  fdiAdapter,
  fromNotation,
  getAnatomicalArch,
  getApplicableSurfaces,
  getDeciduousTeeth,
  getLayoutArch,
  getMixedTeeth,
  getNotationAdapter,
  getPermanentTeeth,
  getQuadrant,
  getTeethForView,
  isDeciduousTooth,
  isPermanentTooth,
  isValidNotation,
  isValidSurface,
  listSupportedNotations,
  mapSurfaceToFace,
  palmerAdapter,
  SURFACE_CODES,
  SURFACE_LABELS,
  toAccessibleNotation,
  toNotation,
  universalAdapter,
  type ClinicalSurface,
  type Notation,
  type NotationAdapter,
  type SurfaceCode,
} from "@odontogram/dentition";

// Verify type contracts
const customPlugin: OdontogramPlugin = createPlugin({
  name: "custom-renderer",
  views: [
    {
      type: "custom",
      render: (ctx: ViewRenderContext) => {
        const div = document.createElement("div");
        div.className = "custom-view";
        ctx.el.appendChild(div);
      },
      destroy: (ctx: ViewRenderContext) => {
        ctx.el.innerHTML = "";
      },
    },
  ],
});

const tooth: ToothId = "16";
const surface: SurfaceId = "M";
const notation: Notation = "fdi";
const view: ViewType = "permanent";

const mark: OdontographicMark = {
  id: "mark-1",
  tooth,
  surfaces: [surface],
  type: "caries",
  style: {
    fill: "#f44336",
    stroke: "#d32f2f",
    strokeWidth: 1.5,
    opacity: 0.9,
  },
};

const selection: SelectionState = {
  teeth: [tooth],
  surfaces: [{ tooth, surface }],
};

const options: OdontogramOptions = {
  plugins: [svgPlugin, customPlugin],
  initialView: view,
  notation,
  height: 450,
  selectable: true,
  toothColor: "#fafafa",
  surfaceColor: "#eeeeee",
  selectionColor: "#bbdefb",
  markColors: {
    caries: "#e53935",
    restoration: "#1e88e5",
  },
  toothClick: (arg: ToothClickArg) => {
    console.log("Tooth click:", arg.tooth);
  },
  surfaceClick: (arg: SurfaceClickArg) => {
    console.log("Surface click:", arg.tooth, arg.surface);
  },
  selectionDidChange: ({ selection }: { selection: SelectionState }) => {
    console.log("Selection changed:", selection);
  },
  marksSet: ({ marks }: { marks: OdontographicMark[] }) => {
    console.log("Marks count:", marks.length);
  },
  toothClassNames: ({ tooth, isSelected }) => (isSelected ? "selected" : \`tooth-\${tooth}\`),
  viewDidMount: (arg: ViewMountArg) => {
    console.log("View mounted:", arg.view);
  },
};

// Check Dentition functions
const permanent = getPermanentTeeth();
const deciduous = getDeciduousTeeth();
const mixed = getMixedTeeth();
const layoutArch = getLayoutArch("11");
const anatomicalArch = getAnatomicalArch("11");
const quadrant = getQuadrant("21");
const isPerm = isPermanentTooth("16");
const isDec = isDeciduousTooth("55");
const converted = toNotation("11", "universal");
const roundtrip = fromNotation(converted, "universal");
const accessiblePalmer = toAccessibleNotation("11", "palmer");
const adapter: NotationAdapter = getNotationAdapter("palmer");
const parsedPalmer = palmerAdapter.parse("UR1");
const notationsList = listSupportedNotations();
const isFdiValid = isValidNotation("fdi");
const validSurface = isValidSurface("O");
const surfaces = getApplicableSurfaces("11");
const face = mapSurfaceToFace("16", "M" as ClinicalSurface);

// Instantiate and check methods
const container = document.createElement("div");
const odontogram = new Odontogram(container, options);

odontogram.render();
odontogram.setOption("notation", "universal");
const currentNotation = odontogram.getOption("notation");
odontogram.changeView("deciduous");
odontogram.setState({ marks: [mark], selection, teeth: { "16": { presence: "missing" as ToothPresence } } });
const state: OdontogramState = odontogram.getState();
const toothState: ToothState = { presence: "unerupted" };

odontogram.batchRendering(() => {
  odontogram.setOption("selectable", false);
  odontogram.setState({ marks: [] });
});

odontogram.destroy();

console.log("TypeScript consumer types and usage verified successfully!");
`;

  fs.writeFileSync(path.join(tsConsumerDir, "test.ts"), tsConsumerScript);
  log("  Typechecking TS consumer...", tsConsumerDir);
  run("npx tsc --project tsconfig.json", tsConsumerDir);
  success("TypeScript consumer passed strict type checking against distributed declarations.");

  // Clean up scratch dir
  fs.rmSync(scratchDir, { recursive: true, force: true });
  log("Cleaned up", "Temporary test consumer directories removed.");

  console.log("\n\x1b[32m======================================================\x1b[0m");
  console.log("\x1b[32m✔ All package distributions & consumers verified!\x1b[0m");
  console.log("\x1b[32m======================================================\x1b[0m\n");
}

main().catch((err) => {
  fail("Verification script failed", err);
});
