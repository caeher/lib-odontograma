import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@odontogram/core": path.resolve(rootDir, "packages/core/src/index.ts"),
      "@odontogram/dentition": path.resolve(rootDir, "packages/dentition/src/index.ts"),
      "@odontogram/svg": path.resolve(rootDir, "packages/svg/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["packages/**/*.test.ts"],
  },
});
