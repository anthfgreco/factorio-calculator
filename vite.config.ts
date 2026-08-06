import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
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
