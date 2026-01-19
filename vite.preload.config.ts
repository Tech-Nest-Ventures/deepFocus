import { defineConfig } from 'vite'
import { builtinModules } from 'module'

export default defineConfig({
  build: {
    target: 'node22',
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: 'src/preload.ts',
      formats: ['cjs'],
      fileName: 'preload'
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        'electron'
      ],
      output: {
        entryFileNames: 'preload.js'
      }
    }
  }
})
