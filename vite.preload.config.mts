import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node20',
    outDir: '.vite/build/preload',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/preload.ts',
      output: {
        format: 'cjs',
        entryFileNames: '[name].js'
      }
    }
  }
})