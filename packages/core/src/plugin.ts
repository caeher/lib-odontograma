import type { OdontogramPlugin, OdontogramPluginDef } from "./types.js";

/**
 * Create a plugin definition for registration with Odontogram.
 * Mirrors FullCalendar's createPlugin pattern.
 */
export function createPlugin(def: OdontogramPluginDef): OdontogramPlugin {
  return { pluginDef: def };
}
