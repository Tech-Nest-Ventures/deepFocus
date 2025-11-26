import { defineConfig } from 'vite'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { builtinModules } from 'module'

export default defineConfig({
  build: {
    target: 'node22', // Electron 39 uses Node.js 22
    outDir: '.vite/build', // Output directory that matches package.json main field
    emptyOutDir: false, // Clear the output directory before building
    lib: {
      entry: 'src/main.ts', // The entry file for the main process
      formats: ['cjs'], // Electron main process uses CommonJS
      fileName: 'main' // Output file name (will be main.js)
    },
    rollupOptions: {
      external: [
        ...builtinModules, // Exclude built-in Node.js modules from the bundle
        'electron', // Exclude Electron from the bundle
        'electron-store', // Exclude electron-store (Node.js module, should not be bundled)
        'electron-log', // Exclude electron-log (Node.js module, should not be bundled)
        'electron-log/main', // Exclude electron-log/main entry point
        'electron-log/node', // Exclude electron-log/node entry point (legacy)
        'electron-log/node.js', // Exclude electron-log/node.js entry point (legacy)
        'dayjs', // Exclude dayjs (Node.js module, should not be bundled)
        'dotenv', // Exclude dotenv (Node.js module, should not be bundled)
        'node-schedule', // Exclude node-schedule (Node.js module, should not be bundled)
        'conf', // Exclude conf (dependency of electron-store)
        'semver' // Exclude semver (used by conf and other modules)
      ],
      output: {
        entryFileNames: 'main.js', // Output file name for the main process
        manualChunks: undefined, // Disable code-splitting
        inlineDynamicImports: true, // Inline all dynamic imports
        interop: 'default' // Handle default exports from externalized modules
      },
      plugins: [
        commonjs({
          dynamicRequireTargets: [
            'electron-store'
          ],
          transformMixedEsModules: true,
          ignoreDynamicRequires: false 
        }),
        nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node', 'default']
        }) // Enables resolving modules from node_modules
      ]
    }
  }
})
