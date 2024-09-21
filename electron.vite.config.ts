import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/main/index.ts'),
          worker: resolve(__dirname, 'src/main/schedulerWorker.js')
        },
        output: {
          format: 'es',
          entryFileNames: '[name].js',
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [solid()],
    build: {
      outDir: 'out/renderer'
    }
  }
});
