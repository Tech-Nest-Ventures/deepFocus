import { defineConfig } from 'vite'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { builtinModules } from 'module'

export default defineConfig({
  build: {
    target: 'node16', // Ensure compatibility with the Electron version you are using
    emptyOutDir: false, // Clear the output directory before building
    lib: {
      entry: {
        main: 'src/main.ts', // The entry file for the main process
        wsServer: 'src/wsServer.ts' // Add the WebSocket server entry point
      },
      formats: ['cjs'] // Electron main process uses CommonJS
    },
    rollupOptions: {
      external: [
        ...builtinModules, // Exclude built-in Node.js modules from the bundle
        'electron' // Exclude Electron from the bundle
      ],
      output: {
        entryFileNames: '[name].js', // This will output main.js and wsServer.js
        manualChunks: undefined // Disable code-splitting
      },
      plugins: [
        commonjs({
          dynamicRequireTargets: [],
          ignoreDynamicRequires: false
        }),
        nodeResolve() // Enables resolving modules from node_modules
      ]
    }
  }
})
