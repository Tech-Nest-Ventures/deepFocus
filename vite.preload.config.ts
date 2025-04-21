import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  build: {
    target: 'node20',
    outDir: '.vite/build/preload',
    emptyOutDir: false
  }
})
