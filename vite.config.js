import { cpSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/**
 * The editor remains a classic script while its internal modules are
 * preserved. Vite compiles the entry HTML and CSS; this plugin copies
 * the existing runtime and SVG symbols without rewriting their globals.
 */
function copyLegacyRuntime() {
  return {
    name: "copy-legacy-runtime",
    apply: "build",
    closeBundle() {
      const outputDirectory = resolve(projectRoot, "dist");

      for (const directory of ["js", "assets"]) {
        const source = resolve(projectRoot, directory);

        if (existsSync(source)) {
          cpSync(source, resolve(outputDirectory, directory), {
            recursive: true,
            force: true
          });
        }
      }
    }
  };
}

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    tailwindcss(),
    copyLegacyRuntime()
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: false
  }
});
