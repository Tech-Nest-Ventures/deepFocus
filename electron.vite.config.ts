import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import solid from 'vite-plugin-solid'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/main/index.ts'),
          worker: resolve(__dirname, 'src/main/worker.ts')
        },
        output: {
          format: 'es',
          entryFileNames: '[name].js'
        },
        // Externalize unnecessary dependencies from the worker
        external: ['electron', 'path', 'fs', 'dotenv', '@electron-toolkit/utils', 'electron-store']
      },

    },
    define: {
      'process.env.API_BASE_URL': JSON.stringify(process.env.VITE_SERVER_URL_PROD || 'https://backend-production-5eec.up.railway.app'),
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        external: ['electron']
      }
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
    },
    define: {
      'process.env.API_BASE_URL': JSON.stringify(process.env.VITE_SERVER_URL_PROD || 'https://backend-production-5eec.up.railway.app'),
    }
  }
})
