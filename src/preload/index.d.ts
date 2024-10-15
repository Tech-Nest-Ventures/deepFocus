/* eslint-disable @typescript-eslint/no-explicit-any */
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
