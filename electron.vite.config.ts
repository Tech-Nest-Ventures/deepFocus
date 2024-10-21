import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import solid from 'vite-plugin-solid'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import {viteStaticCopy} from 'vite-plugin-static-copy'

// Define __dirname in an ES module environment
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
console.log('dirname:', __dirname)

dotenv.config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/main/index.ts'),
          worker: resolve(__dirname, 'src/main/worker.ts'),
          childProcess: resolve(__dirname, 'src/main/childProcess.ts')
        },
        output: {
          format: 'es',
          entryFileNames: '[name].js'
        },
        external: [
          'electron',
          'path',
          'fs',
          'dotenv',
          '@electron-toolkit/utils',
          'electron-store'
        ]
      }
    },
    define: {
      'process.env.API_BASE_URL': JSON.stringify(
        process.env.VITE_SERVER_URL_PROD || 'https://backend-production-5eec.up.railway.app'
      )
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'es',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      solid(),
      viteStaticCopy({
        targets: [
          {
            src: resolve(__dirname, 'src/renderer/loader.html'), 
            dest: '' 
          }
        ]
      })
    ],
    build: {
      outDir: 'out/renderer',
    },
    define: {
      'process.env.API_BASE_URL': JSON.stringify(
        process.env.VITE_SERVER_URL_PROD || 'https://backend-production-5eec.up.railway.app'
      )
    }
  }
})
