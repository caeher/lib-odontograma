import fs from "node:fs";
import { resolveAbsoluteResourcePath } from "./paths-node.js";

/** Load catalog SVG markup from disk (Node.js only). */
export function loadCatalogSvgMarkup(relativeSvgPath: string): string {
  return fs.readFileSync(resolveAbsoluteResourcePath(relativeSvgPath), "utf8");
}
