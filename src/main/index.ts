import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { MacOSResult, Result, activeWindow, openWindowsSync } from 'get-windows'
import { calculateProductivityScore, getUrlFromResult } from '../utils/productivityUtils'
interface StoreSchema {
  unproductiveSites: string[]
}

export type ExtendedResult = Result & { url?: string }

interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void
}
const store = new Store<StoreSchema>() as TypedStore

function startActivityMonitoring(): void {
  setInterval(async () => {
    try {
      const windowInfo = await activeWindow()
      const currOpenWindows = (await openWindowsSync()) as MacOSResult[]

      if (windowInfo && windowInfo!.platform === 'macos') {
        const extendedResult: ExtendedResult = {
          ...windowInfo,
          url: getUrlFromResult(windowInfo)
        }
        const result = processActivityData(extendedResult, currOpenWindows)
        console.log('result is ', result)
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 60000) // run every min
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-function-return-type
function processActivityData(
  _windowInfoData: ExtendedResult | undefined,
  _currOpenWindowsData: MacOSResult[]
) {
  calculateProductivityScore(_currOpenWindowsData)
  return { _windowInfoData, _currOpenWindowsData }
}
console.log('dirname is ', __dirname) // /Users/timeo/Desktop/Engineering/buildspace/quick-start/deepWork/out/main
console.log(__dirname + '/renderer/src/assets/deepWork.ico')
console.log('test3', join(__dirname, '../renderer/index.html'))
function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? {} : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    icon: __dirname + '../renderer/src/assets/deepWork.ico'
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('get-unproductive-sites', () => {
    return store.get('unproductiveSites', ['Gmail', 'Instagram', 'Facebook'])
  })

  ipcMain.handle('add-unproductive-site', (_, site: string) => {
    const sites = store.get('unproductiveSites', [
      'Gmail',
      'Instagram',
      'Facebook',
      'LinkedIn'
    ]) as string[]
    if (!sites.includes(site)) {
      sites.push(site)
      store.set('unproductiveSites', sites)
    }
    return sites
  })

  ipcMain.handle('remove-unproductive-site', (_, site: string) => {
    const sites = store.get('unproductiveSites', ['Gmail', 'Instagram', 'Facebook']) as string[]
    const updatedSites = sites.filter((s) => s !== site)
    store.set('unproductiveSites', updatedSites)
    return updatedSites
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  startActivityMonitoring()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
