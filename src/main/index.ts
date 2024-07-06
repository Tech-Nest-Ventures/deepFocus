import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { MacOSResult, activeWindow, openWindowsSync } from 'get-windows'
import { EmailService } from './emailService'
import Store from 'electron-store'
import { StoreSchema, SiteTimeTracker, TypedStore, ExtendedResult } from './types'
import {
  calculateProductivityScore,
  getUrlFromResult,
  formatTime,
  updateSiteTimeTracker
} from './productivityUtils'

const store = new Store<StoreSchema>() as TypedStore

export let currentSiteTimeTrackers: SiteTimeTracker[] = []
function saveSiteTimeTrackers(): void {
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
  console.log('Saved site time trackers:', currentSiteTimeTrackers)
}

async function loadSiteTimeTrackers(): Promise<void> {
  const savedTrackers = store.get('siteTimeTrackers', [])
  currentSiteTimeTrackers = savedTrackers
  console.log('Loaded site time trackers:', currentSiteTimeTrackers)
}

// Call this function periodically, e.g., every 5 minutes
setInterval(saveSiteTimeTrackers, 5 * 60 * 1000)

function startActivityMonitoring(): void {
  console.log('startActivityMonitoring()')
  setInterval(async () => {
    try {
      const windowInfo = await activeWindow()
      const currOpenWindows = openWindowsSync() as MacOSResult[]

      if (windowInfo && windowInfo!.platform === 'macos') {
        const extendedResult: ExtendedResult = {
          ...windowInfo,
          url: getUrlFromResult(windowInfo),
          siteTimeTracker: updateSiteTimeTracker(windowInfo)
        }
        const result = processActivityData(extendedResult, currOpenWindows)
        if (result?._windowInfoData?.url) {
          console.log('result is ', result)
        }
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 60000) //TODO: change to 60000 for prod. Using 10000 for dev purposes only
}

function processActivityData(
  _windowInfoData: ExtendedResult | undefined,
  _currOpenWindowsData: MacOSResult[]
): {
  _windowInfoData: ExtendedResult | undefined
  productivityScore: number
} {
  console.log('processActivityScore')
  const productivityScore = calculateProductivityScore(_currOpenWindowsData)

  if (_windowInfoData?.siteTimeTracker) {
    console.log(
      `Time spent on ${_windowInfoData.siteTimeTracker.title}: ${formatTime(_windowInfoData.siteTimeTracker.timeSpent)}`
    )
    console.log(
      `Last active timestamp: ${new Date(_windowInfoData.siteTimeTracker.lastActiveTimestamp).toISOString()}`
    )
    console.log(`Current time: ${new Date().toISOString()}`)
  }

  return { _windowInfoData, productivityScore }
}

async function createWindow(): Promise<void> {
  console.log('createWindow()')
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    console.log('ready-to-show')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    console.log(' mainWindow.webContents.setWindowOpenHandler')
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
app.whenReady().then(async() => {
  console.log('app.whenReady()')
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  //  // Add this IPC handler
  //  ipcMain.handle('test-email-send', async () => {
  //   await emailService.testEmailSend()
  // })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  await createWindow()

  await loadSiteTimeTrackers()

  // Initialize EmailService
  const emailService = new EmailService(
    process.env.RESEND_API_KEY || '',
    process.env.EMAIL || '',
    store
  )
  emailService.scheduleEmailSend()

  /* //TODO: Remove/adjust logic once connected to frontend
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
    */

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
