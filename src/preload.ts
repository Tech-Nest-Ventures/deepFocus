// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'


export interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, func: (...args: any[]) => void) => void
    once: (channel: string, func: (...args: any[]) => void) => void
    removeListener(channel: string, listener: (...args: any[]) => void): void
    removeAllListeners(channel: string): void
  }
  process: {
    versions: {
      node: string
      chrome: string
      electron: string
    }
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
console.log('Preload script started')

if (process.contextIsolated) {
  try {
    console.log('Preload script executed successfully')
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  console.timeLog('not running')
  // window.electron = electronAPI
  // window.api = api
}