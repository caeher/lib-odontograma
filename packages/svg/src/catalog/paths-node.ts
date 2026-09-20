import path from "node:path";
import { fileURLToPath } from "node:url";
import { resourceIdToRelativePaths } from "./paths.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Absolute path to `packages/svg/resources`. */
export function getResourcesRoot(): string {
  return path.join(packageRoot, "resources");
}

export function resolveAbsoluteResourcePath(relativePath: string): string {
  return path.join(getResourcesRoot(), relativePath);
}

export { resourceIdToRelativePaths };
