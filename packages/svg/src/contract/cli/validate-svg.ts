#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { parseToothSvgMetadataJson, validateToothSvg } from "../index.js";

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

function usage(): never {
  console.error(`Usage: validate-tooth-svg [--metadata sidecar.json] <file.svg> [more.svg]

Validates tooth SVG resources against the @odontogram/svg contract.`);
  process.exit(2);
}

function parseArgs(argv: string[]): { metadataPath?: string; svgPaths: string[] } {
  const svgPaths: string[] = [];
  let metadataPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--metadata" || arg === "-m") {
      const next = argv[i + 1];
      if (!next) usage();
      metadataPath = next;
      i++;
      continue;
    }
    if (arg === "--help" || arg === "-h") usage();
    if (arg.startsWith("-")) usage();
    svgPaths.push(arg);
  }
  if (svgPaths.length === 0) usage();
  return { metadataPath, svgPaths };
}

function resolveMetadataForSvg(
  svgPath: string,
  explicit?: string,
): { path: string; json: string } | undefined {
  if (explicit) {
    return { path: explicit, json: fs.readFileSync(explicit, "utf8") };
  }
  const sidecar = svgPath.replace(/\.svg$/i, ".json");
  if (fs.existsSync(sidecar)) {
    return { path: sidecar, json: fs.readFileSync(sidecar, "utf8") };
  }
  return undefined;
}

async function main(): Promise<void> {
  installDom();
  const { metadataPath, svgPaths } = parseArgs(process.argv.slice(2));
  let exitCode = 0;

  for (const svgPath of svgPaths) {
    const absSvg = path.resolve(svgPath);
    const markup = fs.readFileSync(absSvg, "utf8");
    const sidecar = resolveMetadataForSvg(absSvg, metadataPath);
    const metadata = sidecar ? parseToothSvgMetadataJson(sidecar.json) : undefined;
    const result = validateToothSvg(markup, { metadata });

    if (result.valid) {
      console.log(`✔ ${path.relative(process.cwd(), absSvg)}`);
    } else {
      exitCode = 1;
      console.error(`✖ ${path.relative(process.cwd(), absSvg)}`);
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
