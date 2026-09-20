#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { parseToothSvgMetadataJson, validateToothSvg } from "../index.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function installDom(): void {
  if (typeof globalThis.DOMParser !== "undefined") return;
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
  globalThis.Node = dom.window.Node;
  globalThis.Element = dom.window.Element;
}

function collectCatalogSvgPaths(): string[] {
  const catalogRoot = path.join(packageRoot, "resources/catalog");
  const results: string[] = [];
  for (const toothClass of fs.readdirSync(catalogRoot, { withFileTypes: true })) {
    if (!toothClass.isDirectory()) continue;
    const classDir = path.join(catalogRoot, toothClass.name);
    for (const file of fs.readdirSync(classDir)) {
      if (file.endsWith(".svg")) {
        results.push(path.join(classDir, file));
      }
    }
  }
  return results.sort();
}

function defaultValidationTargets(): string[] {
  return [
    path.join(packageRoot, "resources/template/tooth-occlusal-schematic.template.svg"),
    path.join(packageRoot, "fixtures/contract/valid-molar-occlusal.svg"),
    ...collectCatalogSvgPaths(),
  ];
}

function resolveMetadataForSvg(svgPath: string): { json: string } | undefined {
  const sidecar = svgPath.replace(/\.svg$/i, ".json");
  if (fs.existsSync(sidecar)) {
    return { json: fs.readFileSync(sidecar, "utf8") };
  }
  return undefined;
}

async function main(): Promise<void> {
  installDom();
  const svgPaths = defaultValidationTargets();
  let exitCode = 0;

  for (const absSvg of svgPaths) {
    const markup = fs.readFileSync(absSvg, "utf8");
    const sidecar = resolveMetadataForSvg(absSvg);
    const metadata = sidecar ? parseToothSvgMetadataJson(sidecar.json) : undefined;
    const result = validateToothSvg(markup, { metadata });

    const label = path.relative(packageRoot, absSvg);
    if (result.valid) {
      console.log(`✔ ${label}`);
    } else {
      exitCode = 1;
      console.error(`✖ ${label}`);
      for (const issue of result.issues) {
        if (issue.severity === "error") {
          console.error(`  [${issue.ruleId}] ${issue.message}`);
        }
      }
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
