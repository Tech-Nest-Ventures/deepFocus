import { defineConfig } from 'vite'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { builtinModules } from 'module'

export default defineConfig({
  build: {
    target: 'node20',
    emptyOutDir: false,
    outDir: '.vite/build',
    lib: {
      entry: {
        main: 'src/main.ts',
        wsServer: 'src/wsServer.ts'
      },
      formats: ['cjs']
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        'electron',
        'electron-store',
        'conf',
        'bufferutil',
        'utf-8-validate',
        'ws',
        'isomorphic-ws'
      ],
      output: {
        entryFileNames: '[name].js',
        manualChunks: undefined
      },
      plugins: [
        commonjs({
          dynamicRequireTargets: [],
          ignoreDynamicRequires: true,
          requireReturnsDefault: 'auto'
        }),
        nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node', 'import', 'require']
        })
      ]
    }
  },
  optimizeDeps: {
    exclude: ['electron-store', 'ws', 'conf', 'isomorphic-ws', 'utf-8-validate', 'bufferutil']
  }
})
