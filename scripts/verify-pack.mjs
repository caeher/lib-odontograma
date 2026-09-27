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
const coreSchemaPath = path.resolve(__dirname, "node_modules/@odontogram/core/schema/odontogram-document.schema.json");

if (!fs.existsSync(coreCssPath)) throw new Error("Missing @odontogram/core/dist/style.css");
if (!fs.existsSync(svgCssPath)) throw new Error("Missing @odontogram/svg/dist/style.css");
if (!fs.existsSync(coreSchemaPath)) throw new Error("Missing @odontogram/core/schema/odontogram-document.schema.json");

// 2. Import packages from installed tarballs
const {
  Odontogram,
  createPlugin,
  validateOdontogramState,
  getMarksForTooth,
  getMarksForSurface,
  normalizeMark,
  SERIALIZATION_EXAMPLES,
  CURRENT_SCHEMA_VERSION,
  DOCUMENT_INTEROPERABILITY_EXAMPLES,
  exportOdontogramDocument,
  importOdontogramDocument,
  validateOdontogramDocument,
} = await import("@odontogram/core");
const { svgPlugin } = await import("@odontogram/svg");
const {
  getPermanentTeeth,
  getDeciduousTeeth,
  toNotation,
  isValidToothId,
  isSurfaceApplicableToTooth,
} = await import("@odontogram/dentition");

if (typeof Odontogram !== "function") throw new Error("Odontogram export is not a constructor");
if (!svgPlugin || typeof svgPlugin !== "object") throw new Error("svgPlugin export is missing");
if (getPermanentTeeth().length !== 32) throw new Error("getPermanentTeeth should return 32 teeth");
if (getDeciduousTeeth().length !== 20) throw new Error("getDeciduousTeeth should return 20 teeth");
if (!isValidToothId("16")) throw new Error("isValidToothId failed for 16");
if (!isSurfaceApplicableToTooth("16", "O")) throw new Error("isSurfaceApplicableToTooth failed for 16/O");

// 3. Test Odontogram instance lifecycle and rendering
const container = document.getElementById("odontogram");
let surfaceClicked = null;
let selectionChanged = null;

const odontogram = new Odontogram(container, {
  plugins: [svgPlugin],
  initialView: "permanent",
  notation: "fdi",
  selectable: true,
  statusColors: {
    completed: "#4caf50",
    planned: "#ff9800",
  },
  surfaceClick: (arg) => { surfaceClicked = arg; },
  selectionDidChange: (arg) => { selectionChanged = arg; },
});

odontogram.render();

const hostEl = container.querySelector(".odontogram-host");
if (!hostEl) throw new Error("Host element .odontogram-host not mounted");

const svgEl = container.querySelector("svg.odontogram-svg");
if (!svgEl) throw new Error("SVG element .odontogram-svg not rendered by plugin");

// Test state updates with Stage 02 marks
odontogram.setState({
  marks: [
    {
      id: "m1",
      type: "restoration",
      status: "completed",
      target: { tooth: "16", surfaces: ["M", "O", "D"] },
      text: "MOD composite",
      metadata: { shade: "A2" },
    },
    {
      id: "m2",
      type: "bridge",
      status: "planned",
      target: { teeth: ["14", "15", "16"] },
    },
  ],
  teeth: { "48": { presence: "missing" } },
});

const state = odontogram.getState();
if (state.marks.length !== 2 || state.marks[0].tooth !== "16") {
  throw new Error("Marks not updated correctly in getState()");
}
if (state.teeth["48"]?.presence !== "missing") {
  throw new Error("Teeth overlay not updated correctly in getState()");
}

const validation = odontogram.validate();
if (!validation.valid) {
  throw new Error("Validation failed for valid state: " + JSON.stringify(validation.errors));
}

// Verify serialization examples roundtrip
for (const [key, ex] of Object.entries(SERIALIZATION_EXAMPLES)) {
  const v = validateOdontogramState(ex);
  if (!v.valid) throw new Error("Serialization example " + key + " is invalid");
}

// Test CRUD operations
const addedMark = odontogram.addMark({
  tooth: "26",
  surfaces: ["O"],
  type: "caries",
  text: "Occlusal pit",
});
if (!odontogram.hasMark(addedMark.id)) throw new Error("addMark failed");

const updatedMark = odontogram.updateMark(addedMark.id, {
  surfaces: ["O", "B"],
  text: "OB caries",
});
if (updatedMark.id !== addedMark.id || updatedMark.surfaces.length !== 2) {
  throw new Error("updateMark failed or altered mark ID");
}

odontogram.setToothState("18", "missing");
if (odontogram.getToothPresence("18") !== "missing") {
  throw new Error("setToothState failed");
}

odontogram.selectTooth("26");
if (!odontogram.isToothSelected("26")) {
  throw new Error("selectTooth failed");
}

const revisionBeforeBatch = odontogram.getRevision();
// Test transactional batching
odontogram.batch(() => {
  odontogram.setOption("notation", "universal");
  odontogram.addMark({ tooth: "11", surfaces: ["M"], type: "caries" });
  odontogram.changeView("deciduous");
});

if (odontogram.getRevision() !== revisionBeforeBatch + 1) {
  throw new Error("batch should increment revision once");
}

if (odontogram.getState().view !== "deciduous") {
  throw new Error("changeView inside batch failed");
}

// Test Stage 07 Interoperability: exportDocument, importDocument, toJSON, and validateOdontogramDocument
odontogram.addMark({ tooth: "16", surfaces: ["M", "O", "D"], type: "restoration", text: "MOD" });
const exportedDoc = odontogram.exportDocument({ includeVisualSettings: true });
if (exportedDoc.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error("exportDocument schemaVersion mismatch");
if (!Array.isArray(exportedDoc.marks) || exportedDoc.marks.length === 0) throw new Error("exportDocument marks mismatch");

const jsonExport = JSON.stringify(odontogram);
const parsedJson = JSON.parse(jsonExport);
if (parsedJson.schemaVersion !== "1.0.0") throw new Error("toJSON() stringify failed");

const docValidation = validateOdontogramDocument(DOCUMENT_INTEROPERABILITY_EXAMPLES.permanentRestorations);
if (!docValidation.valid) throw new Error("DOCUMENT_INTEROPERABILITY_EXAMPLES.permanentRestorations validation failed");

const imported = odontogram.importDocument(DOCUMENT_INTEROPERABILITY_EXAMPLES.mixedDentition);
if (!imported.ok || odontogram.getState().view !== "mixed") throw new Error("importDocument failed");

// Test Stage 07 Data Loading & Concurrency Handling
const loadedResult = await odontogram.loadData(async () => DOCUMENT_INTEROPERABILITY_EXAMPLES.permanentRestorations);
if (!loadedResult.ok || odontogram.getState().view !== "permanent") throw new Error("loadData failed");
if (odontogram.isDirty()) throw new Error("odontogram should not be dirty after loadData");
odontogram.addMark({ tooth: "11", surfaces: ["M"], type: "caries" });
if (!odontogram.isDirty() || !odontogram.hasPendingEdits()) throw new Error("odontogram should be dirty after local edit");
odontogram.markClean();
if (odontogram.isDirty()) throw new Error("odontogram should be clean after markClean");

// Test reset
odontogram.reset();
if (odontogram.getMarks().length !== 0 || Object.keys(odontogram.getTeethState()).length !== 0) {
  throw new Error("reset() failed");
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
  createValidator,
  validateOdontogramState,
  getMarksForTooth,
  getMarksForSurface,
  CURRENT_SCHEMA_VERSION,
  DOCUMENT_INTEROPERABILITY_EXAMPLES,
  exportOdontogramDocument,
  importOdontogramDocument,
  validateOdontogramDocument,
  createMockDocumentLoader,
  createMockStateLoader,
  type ComplexTarget,
  type CustomValidationRule,
  type DataLoadingChangeArg,
  type DataLoadFailArg,
  type DataLoadSuccessArg,
  type DocumentMigration,
  type ExportDocumentOptions,
  type ImportDocumentOptions,
  type MarkInput,
  type MarkMountArg,
  type MarkStatus,
  type MarkStyle,
  type MarkTarget,
  type MultiToothTarget,
  type OdontogramDataLoader,
  type OdontogramDocument,
  type OdontogramImportResult,
  type OdontogramLoaderContext,
  type OdontogramLoaderPayload,
  type OdontogramLoadResult,
  type OdontogramOptions,
  type OdontogramPlugin,
  type OdontogramState,
  type OdontogramVisualSettings,
  type OdontographicMark,
  type RefetchOptions,
  type SelectionState,
  type SurfaceClickArg,
  type SurfaceId,
  type ToothClickArg,
  type ToothId,
  type ToothPresence,
  type ToothState,
  type ToothSurfaceTarget,
  type ValidationContext,
  type ValidationIssue,
  type ValidationResult,
  type ValidatorConfig,
  type ViewMountArg,
  type ViewRenderContext,
  type ViewType,
  type WholeToothTarget,
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
  isSurfaceApplicableToTooth,
  isValidNotation,
  isValidSurface,
  isValidToothId,
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
  target: {
    tooth,
    surfaces: [surface],
  },
  type: "caries",
  status: "existing" as MarkStatus,
  text: "Mesial enamel caries",
  metadata: { depth: "enamel" },
  style: {
    fill: "#f44336",
    stroke: "#d32f2f",
    strokeWidth: 1.5,
    opacity: 0.9,
  },
};

const bridgeMark: OdontographicMark = {
  id: "bridge-1",
  type: "bridge",
  status: "planned",
  target: {
    teeth: ["14", "15", "16"],
  },
  metadata: {
    retainers: ["14", "16"],
    pontics: ["15"],
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
  statusColors: {
    completed: "#43a047",
    planned: "#fb8c00",
  },
  validator: true,
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
  toothClassNames: ({ tooth, isSelected }) => (isSelected ? "selected" : "tooth-" + tooth),
  viewDidMount: (arg: ViewMountArg) => {
    console.log("View mounted:", arg.view);
  },
};

// Check Dentition functions
const permanent = getPermanentTeeth();
const deciduous = getDeciduousTeeth();
const mixed = getMixedTeeth();
const isToothValid = isValidToothId("16");
const isSurfApplicable = isSurfaceApplicableToTooth("16", "O");

// Instantiate Odontogram headlessly
const odontogram = new Odontogram(null, options);

// Test Stage 02 CRUD, Batch, Mode, and Reset methods with strict TS type checking
const createdMark: OdontographicMark = odontogram.addMark({
  tooth: "26",
  surfaces: ["O"],
  type: "caries",
  text: "Occlusal fissure caries",
});

const updatedMark: OdontographicMark = odontogram.updateMark(createdMark.id, {
  surfaces: ["O", "B"],
  text: "Updated note",
});

odontogram.setToothState("18", "missing", { pruneMarks: true });
odontogram.selectTooth("26", "add");
odontogram.selectSurface("26", "O", "toggle");

const currentMode = odontogram.getMode();
const currentRev = odontogram.getRevision();

odontogram.batch(() => {
  odontogram.addMarks([
    { tooth: "11", surfaces: ["M"], type: "caries" },
    { tooth: "21", surfaces: ["D"], type: "restoration" },
  ]);
  odontogram.setToothState("48", "unerupted");
});

// Stage 07 Interoperability typed operations
const exportedDoc: OdontogramDocument = odontogram.exportDocument({
  includeVisualSettings: true,
  metadata: { clinicId: "test-clinic" },
});
const docValidation: ValidationResult = validateOdontogramDocument(exportedDoc);
const importResult: OdontogramImportResult = odontogram.importDocument(
  DOCUMENT_INTEROPERABILITY_EXAMPLES.withVisualSettings,
);

// Stage 07 Data Loader typed operations
const customLoader: OdontogramDataLoader = async ({ signal, reason, params }: OdontogramLoaderContext) => {
  if (signal.aborted) throw new Error("Aborted");
  return DOCUMENT_INTEROPERABILITY_EXAMPLES.mixedDentition;
};
const loadRes: OdontogramLoadResult = await odontogram.loadData(customLoader);
const dirtyCheck: boolean = odontogram.isDirty();
const pendingCheck: boolean = odontogram.hasPendingEdits();
odontogram.markClean();
const baseline: OdontogramState | null = odontogram.getBaselineState();

odontogram.reset({ keepView: true });

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
