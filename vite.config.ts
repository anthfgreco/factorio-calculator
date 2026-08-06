import { fileURLToPath } from "node:url"

import { defineConfig, type Plugin } from "vite"

export default defineConfig({
  base: "./",
  plugins: [moduleGraphManifest()],
  server: {
    open: "/calc.html",
  },
  preview: {
    open: "/calc.html",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        calculator: fileURLToPath(new URL("./calc.html", import.meta.url)),
      },
    },
  },
})

function moduleGraphManifest(): Plugin {
  let projectRoot = ""

  return {
    name: "factorio-module-graph-manifest",
    configResolved(config) {
      projectRoot = normalizePath(config.root).replace(/\/$/, "")
    },
    generateBundle(_options, bundle) {
      const chunks = Object.fromEntries(
        Object.values(bundle)
          .filter((output) => output.type === "chunk")
          .map((chunk) => [
            chunk.fileName,
            {
              dynamicImports: [...chunk.dynamicImports].sort(),
              imports: [...chunk.imports].sort(),
              isDynamicEntry: chunk.isDynamicEntry,
              isEntry: chunk.isEntry,
              modules: Object.keys(chunk.modules)
                .map((moduleId) => normalizeModuleId(moduleId, projectRoot))
                .sort(),
            },
          ]),
      )

      this.emitFile({
        type: "asset",
        fileName: ".vite/module-graph.json",
        source: `${JSON.stringify({ version: 1, chunks }, null, 2)}\n`,
      })
    },
  }
}

function normalizeModuleId(moduleId: string, projectRoot: string): string {
  const normalized = normalizePath(moduleId).replace(/\?.*$/, "")
  const rootPrefix = `${projectRoot}/`
  if (normalized.startsWith(rootPrefix)) return normalized.slice(rootPrefix.length)

  const nodeModulesMarker = "/node_modules/"
  const nodeModulesIndex = normalized.lastIndexOf(nodeModulesMarker)
  if (nodeModulesIndex !== -1) return normalized.slice(nodeModulesIndex + 1)
  return normalized
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/")
}
