import { app, shell, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
const { activeWindow } = await import('get-windows')
import { EmailService } from './emailService'
import Store from 'electron-store'
import { StoreSchema, SiteTimeTracker, TypedStore, ExtendedResult } from './types'
import { getUrlFromResult, formatTime, updateSiteTimeTracker } from './productivityUtils'

export const store = new Store<StoreSchema>() as TypedStore

console.log('Current NODE_ENV:', process.env.NODE_ENV)
console.log('Is Production?', process.env.NODE_ENV === 'production')
console.log('Is Development?', process.env.NODE_ENV === 'development')

console.log('Is app packaged?', app.isPackaged)

let schedulerWorkerPath: string

// if (app.isPackaged)  {
//   // Use the compiled JavaScript file in production
//   schedulerWorkerPath = join(__dirname, 'schedulerWorker.js');
// } else {
//   // Use TypeScript file in development, handled by Vite
//   schedulerWorkerPath = new URL('./schedulerWorker.ts', import.meta.url).pathname;
// }
schedulerWorkerPath = join(__dirname, 'worker.js')

console.log('schedulerWorkerPath', schedulerWorkerPath)
// Create the worker thread
const schedulerWorker = new Worker(schedulerWorkerPath)
// Pass messages to the worker thread
ipcMain.on('send-username', (event, username) => {
  schedulerWorker.postMessage({ type: 'SET_USERNAME', username, event })
})

// Handle worker thread events, logging, or errors here
schedulerWorker.on('error', (err) => {
  console.error('Worker Error:', err)
})

schedulerWorker.on('message', (message) => {
  console.log('Worker Message:', message)
})

if (app.isPackaged) {
  // Production logic here
  const envPath = path.join(process.resourcesPath, '.env')
  console.log('Env file path:', envPath)
  console.log('Env file exists:', fs.existsSync(envPath))
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  } else {
    console.error('Env file not found in production build')
  }
} else {
  // Development logic here
  dotenv.config()
}

const emailService = new EmailService(process.env.EMAIL || '', store)

export let currentSiteTimeTrackers: SiteTimeTracker[] = []
export function saveSiteTimeTrackers(): void {
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
}

async function loadSiteTimeTrackers(): Promise<void> {
  const savedTrackers = store.get('siteTimeTrackers', [])
  currentSiteTimeTrackers = savedTrackers
  // console.log('Loaded site time trackers:', currentSiteTimeTrackers)
}

// Call this function periodically, e.g., every 5 minutes
setInterval(saveSiteTimeTrackers, 5 * 60 * 1000)

function startActivityMonitoring(): void {
  console.log('startActivityMonitoring()')

  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime()

    if (idleTime > 60) {
      // If idle for over 1 minute, stop tracking
      console.log(`System is idle for ${idleTime} seconds.`)
      return
    }

    try {
      const windowInfo = await activeWindow()

      if (windowInfo && windowInfo!.platform === 'macos') {
        const extendedResult: ExtendedResult = {
          ...windowInfo,
          url: getUrlFromResult(windowInfo),
          siteTimeTracker: updateSiteTimeTracker(windowInfo)
        }
        processActivityData(extendedResult)
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 60000) // Every minute
}

function processActivityData(_windowInfoData: ExtendedResult | undefined): {
  _windowInfoData: ExtendedResult | undefined
} {
  console.log('processActivityScore')
  // const productivityScore = calculateProductivityScore(_currOpenWindowsData)

  if (_windowInfoData?.siteTimeTracker) {
    console.log(
      `Time spent on ${_windowInfoData.siteTimeTracker.title}: ${formatTime(_windowInfoData.siteTimeTracker.timeSpent)}`
    )
    console.log(
      `Last active timestamp: ${new Date(_windowInfoData.siteTimeTracker.lastActiveTimestamp).toISOString()}`
    )
    console.log(`Current time: ${new Date().toISOString()}`)
  }

  return { _windowInfoData }
}

async function createWindow(): Promise<BrowserWindow> {
  console.log('createWindow()')
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: true,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? {} : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegrationInWorker: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', async () => {
    console.log('ready-to-show')
    mainWindow.show()
    startActivityMonitoring()
    await loadSiteTimeTrackers()
    emailService.scheduleEmailSend()
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

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  console.log('app.whenReady()')
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  ipcMain.on('test-email-send', async () => {
    console.info('sending email')
    await emailService.testEmailSend()
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  await createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('before-quit', () => {
  schedulerWorker.terminate()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
