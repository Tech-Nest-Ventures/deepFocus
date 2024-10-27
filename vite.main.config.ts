import { defineConfig } from 'vite'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { builtinModules } from 'module'

export default defineConfig({
  build: {
    target: 'node16', // Ensure compatibility with the Electron version you are using
    emptyOutDir: false, // Clear the output directory before building
    lib: {
      entry: 'src/main.ts', // The entry file for the main process
      formats: ['cjs'] // Electron main process uses CommonJS
    },
    rollupOptions: {
      external: [
        ...builtinModules, // Exclude built-in Node.js modules from the bundle
        'electron' // Exclude Electron from the bundle
      ],
      output: {
        entryFileNames: 'main.js', // Output file name for the main process
        manualChunks: undefined, // Disable code-splitting
        inlineDynamicImports: true // Inline all dynamic imports
      },
      plugins: [
        commonjs({
          dynamicRequireTargets: [
          ],
          ignoreDynamicRequires: false 
        }),
        nodeResolve() // Enables resolving modules from node_modules
      ]
    }
  }
})
