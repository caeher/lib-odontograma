import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  server: {
    fs: {
      allow: [path.resolve(import.meta.dirname, "../..")],
    },
  },
  resolve: {
    alias: {
      "@odontogram/svg/catalog": path.resolve(
        import.meta.dirname,
        "../../packages/svg/src/catalog/index.ts",
      ),
      "@odontogram/dentition": path.resolve(
        import.meta.dirname,
        "../../packages/dentition/src/index.ts",
      ),
    },
  },
});
