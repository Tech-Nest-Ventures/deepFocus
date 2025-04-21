import { defineConfig } from 'vite'

// https://vitejs.dev/config
// export default defineConfig({});

import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: 'node20',
    outDir: '.vite/renderer/main_window',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})
