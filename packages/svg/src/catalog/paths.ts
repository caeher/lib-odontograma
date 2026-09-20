/** Convert catalog `resourceId` to paths under `resources/` (browser-safe). */
export function resourceIdToRelativePaths(resourceId: string): {
  relativeSvgPath: string;
  relativeMetadataPath: string;
} {
  const dot = resourceId.indexOf(".");
  if (dot <= 0) {
    throw new Error(`Invalid catalog resourceId: ${resourceId}`);
  }
  const toothClass = resourceId.slice(0, dot);
  const stem = resourceId.slice(dot + 1);
  const base = `catalog/${toothClass}/${stem}`;
  return {
    relativeSvgPath: `${base}.svg`,
    relativeMetadataPath: `${base}.json`,
  };
}
