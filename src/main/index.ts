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

schedulerWorkerPath = join(__dirname, 'worker.js')
console.log('schedulerWorkerPath', schedulerWorkerPath)

// Create the worker thread
const schedulerWorker = new Worker(schedulerWorkerPath)

// When the user logs in or signs up and sends user info
ipcMain.on('send-username', (event, user) => {
  console.log('Received user data from frontend:', user)

  // Store user data in electron-store
  store.set('user', {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    language: user.language
  })

  // You can pass this data to the worker or use it elsewhere
  schedulerWorker.postMessage({ type: 'SET_USER_INFO', user })
})

// Optionally, you can check if the user data already exists when the app starts
const savedUser = store.get('user')
if (savedUser) {
  console.log('User data loaded from electron-store:', savedUser)
  schedulerWorker.postMessage({ type: 'SET_USER_INFO', user: savedUser })
}

ipcMain.on('send-data-to-worker', (event) => {
  console.log('event is ', event)
  schedulerWorker.postMessage({
    type: 'SET_TRACKERS',
    currentSiteTimeTrackers: store.get('siteTimeTrackers'),
    storeData: store // Pass the whole store data if needed
  })
})

schedulerWorker.on('message', (message) => {
  if (message.type === 'RESET_DAILY') {
    resetDailyCounters() // Reset the daily counters in main process
  } else if (message.type === 'RESET_WEEKLY') {
    resetWeeklyData() // Reset the weekly data in main process
  }
})

function resetDailyCounters() {
  currentSiteTimeTrackers.forEach((tracker) => {
    tracker.timeSpent = 0 // Reset time spent on each site
  })
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
}

function resetWeeklyData() {
  currentSiteTimeTrackers.length = 0 // Clear all trackers for the new week
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
}

// Handle worker thread events, logging, or errors
schedulerWorker.on('error', (err) => {
  console.error('Worker Error:', err)
})

schedulerWorker.on('message', (message) => {
  console.log('Worker Message:', message)
})

if (app.isPackaged) {
  // Production logic
  const envPath = path.join(process.resourcesPath, '.env')
  console.log('Env file path:', envPath)
  console.log('Env file exists:', fs.existsSync(envPath))
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  } else {
    console.error('Env file not found in production build')
  }
} else {
  // Development logic
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
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: true,
    autoHideMenuBar: false,
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
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  console.log('app.whenReady()')
  electronApp.setAppUserModelId('com.electron')

  ipcMain.on('test-email-send', async () => {
    await emailService.testEmailSend()
  })

  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  ipcMain.on('logout', () => {
    store.delete('user')
    console.log('User data cleared from electron-store.')
  })
})

app.on('before-quit', () => {
  schedulerWorker.terminate()
})

app.on('browser-window-created', (_, window) => {
  optimizer.watchWindowShortcuts(window)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
