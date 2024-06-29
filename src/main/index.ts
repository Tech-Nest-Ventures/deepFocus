import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { Result, activeWindow, openWindowsSync } from 'get-windows'
import { parse } from 'url'

interface StoreSchema {
  unproductiveSites: string[]
}

let timer = 0

interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void
}
const store = new Store<StoreSchema>() as TypedStore
// console.log('store is ', store);

// In your main process
function startActivityMonitoring(): void {
  setInterval(async () => {
    try {
      const windowInfo = await activeWindow()
      const currOpenWindows = await openWindowsSync()

      if (windowInfo) {
        // Process the information
        processActivityData(windowInfo, currOpenWindows)
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 10000) // Check every second
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-function-return-type
function processActivityData(_windowInfoData: Result | undefined, _currOpenWindowsData: Result[]) {
  // Implement your logic here
  // e.g., check if the URL or title contains unproductive sites
  // Update productivity score, etc.

  function getDomainFromUrl(url: string): string {
    const parsedUrl = parse(url)
    return parsedUrl.hostname || ''
  }

  function isProductiveUrl(url: string, unproductiveSites: string[]): boolean {
    const domain = getDomainFromUrl(url)
    return !unproductiveSites.some((site) => domain.includes(site.toLowerCase()))
  }

  function calculateProductivityScore(windows: WindowInfo[], unproductiveSites: string[]): number {
    const browserWindows = windows.filter((win) => win.url)
    if (browserWindows.length === 0) return 1 // No browser windows open, assume productive

    const productiveWindows = browserWindows.filter((win) =>
      isProductiveUrl(win.url!, unproductiveSites)
    )
    return productiveWindows.length / browserWindows.length
  }

  if (_windowInfoData!.platform === 'macos') {
    // Among other fields, `result.owner.bundleId` is available on macOS.
    console.log(
      `Process title is ${_windowInfoData?.title} with bundle id ${_windowInfoData?.owner.bundleId}.`
    )

    // Usage
    const unproductiveSites = ['gmail.com', 'instagram.com', 'facebook.com']
    const openWindows: Result[] = _currOpenWindowsData // Your data from earlier
    const productivityScore = calculateProductivityScore(openWindows, unproductiveSites)

    console.log(`Current productivity score: ${productivityScore}`)
    timer += 1
    console.log(timer)
  } else {
    console.log(`Currently running on a Non-MacOS system > Data can't be collected`)
  }

  return { _windowInfoData, _currOpenWindowsData }
}

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
    }
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
    const sites = store.get('unproductiveSites', ['Gmail', 'Instagram', 'Facebook']) as string[]
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
