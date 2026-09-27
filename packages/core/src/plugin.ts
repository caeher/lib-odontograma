import type { OdontogramPlugin, OdontogramPluginDef } from "./types.js";
import { OdontogramError, VALIDATION_CODES } from "./errors.js";

/** Version of the public plugin contract implemented by this core release. */
export const ODONTOGRAM_PLUGIN_API_VERSION = "1.0.0";

/** Compatibility input for existing view-only plugins; normalized on creation. */
export interface LegacyOdontogramPluginDef {
  name: string;
  views?: OdontogramPluginDef["views"];
}

function parseVersion(version: string): [number, number, number] | undefined {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function compareVersion(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return Number.NaN;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return 0;
}

/** Supports exact, wildcard, caret, tilde, and >= semver ranges. */
export function satisfiesVersion(version: string, range = "*"): boolean {
  const requested = range.trim();
  if (requested === "*" || requested === "") return Boolean(parseVersion(version));
  if (requested.startsWith(">=")) return compareVersion(version, requested.slice(2).trim()) >= 0;
  if (requested.startsWith("^")) {
    const base = requested.slice(1);
    const cmp = compareVersion(version, base);
    const parsed = parseVersion(base);
    if (!parsed || Number.isNaN(cmp) || cmp < 0) return false;
    if (parsed[0] > 0) return compareVersion(version, `${parsed[0] + 1}.0.0`) < 0;
    if (parsed[1] > 0) return compareVersion(version, `0.${parsed[1] + 1}.0`) < 0;
    return compareVersion(version, `0.0.${parsed[2] + 1}`) < 0;
  }
  if (requested.startsWith("~")) {
    const base = requested.slice(1);
    const parsed = parseVersion(base);
    return Boolean(
      parsed &&
      compareVersion(version, base) >= 0 &&
      compareVersion(version, `${parsed[0]}.${parsed[1] + 1}.0`) < 0,
    );
  }
  return compareVersion(version, requested) === 0;
}

export function assertPluginApiCompatible(def: OdontogramPluginDef): void {
  if (!satisfiesVersion(ODONTOGRAM_PLUGIN_API_VERSION, def.apiCompatibility)) {
    throw new OdontogramError(
      `Plugin "${def.id}" supports Odontogram API "${def.apiCompatibility}"; this core provides "${ODONTOGRAM_PLUGIN_API_VERSION}".`,
      VALIDATION_CODES.ERR_PLUGIN_INCOMPATIBLE_API,
    );
  }
}

/**
 * Create a plugin definition for registration with Odontogram.
 * Mirrors FullCalendar's createPlugin pattern.
 */
export function createPlugin(def: OdontogramPluginDef): OdontogramPlugin;
/** @deprecated Supply id, version, and apiCompatibility in the plugin definition. */
export function createPlugin(def: LegacyOdontogramPluginDef): OdontogramPlugin;
export function createPlugin(
  def: OdontogramPluginDef | LegacyOdontogramPluginDef,
): OdontogramPlugin {
  if ("id" in def) return { pluginDef: def };
  return {
    pluginDef: {
      ...def,
      id: def.name,
      version: "0.0.0",
      apiCompatibility: `^${ODONTOGRAM_PLUGIN_API_VERSION}`,
    },
  };
}
