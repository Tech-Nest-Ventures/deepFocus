import { app, shell, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import dotenv from 'dotenv'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
const { activeWindow } = await import('@deepfocus/get-windows')
import Store from 'electron-store'

import { EmailService } from './emailService'
import { StoreSchema, SiteTimeTracker, ExtendedResult } from './types'
import { getUrlFromResult, formatTime, updateSiteTimeTracker } from './productivityUtils'

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
}

const store = new Store<StoreSchema>() as TypedStore
let currentSiteTimeTrackers: SiteTimeTracker[] = []

setupEnvironment()
console.log('email', process.env.EMAIL)

const emailService = new EmailService(process.env.EMAIL || '', store)

// Initialize environment variables based on the environment
function setupEnvironment(): void {
  if (app.isPackaged) {
    const envPath = path.join(process.resourcesPath, '.env')
    console.log('app.isPackaged ', app.isPackaged)
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
    else console.error('Env file not found in production build')
  } else {
    console.log('app is not packaged')
    dotenv.config()
  }
}

// Store user data in the electron-store and send to worker
function handleUserData(user): void {
  store.set('user', {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    language: user.language
  })
  schedulerWorker.postMessage({
    type: 'SET_USER_INFO',
    user,
    currentSiteTimeTrackers: store.get('siteTimeTrackers', [])
  })
}

// Load user data if available on app start
function loadUserData() {
  const savedUser = store.get('user')
  if (savedUser) {
    console.log('User data loaded from electron-store:', savedUser)
    schedulerWorker.postMessage({ type: 'SET_USER_INFO', user: savedUser })
  }
}

// Reset counters logic
function resetCounters(type: 'daily' | 'weekly') {
  if (type === 'daily') {
    console.log('Resetting Daily Trackers')
    currentSiteTimeTrackers.forEach((tracker) => (tracker.timeSpent = 0))
    store.set('lastResetDate', dayjs().format('YYYY-MM-DD'))
  } else if (type === 'weekly') {
    console.log('Resetting Weekly Trackers')
    currentSiteTimeTrackers.length = 0
  }
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
}

// Periodic saving of time trackers
function setupPeriodicSave() {
  setInterval(() => store.set('siteTimeTrackers', currentSiteTimeTrackers), 5 * 60 * 1000)
}

// Monitor system idle time and user activity
function startActivityMonitoring() {
  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime()
    if (idleTime > 60) return console.log(`System idle for ${idleTime} seconds.`)

    try {
      const windowInfo = await activeWindow()
      if (windowInfo && windowInfo!.platform === 'macos') {
        const extendedResult: ExtendedResult = {
          ...windowInfo,
          url: getUrlFromResult(windowInfo),
          siteTimeTracker: updateSiteTimeTracker(windowInfo, currentSiteTimeTrackers)
        }
        processActivityData(extendedResult)
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 60000) // change back to 600000
}

// Process activity data from active window
function processActivityData(_windowInfoData: ExtendedResult | undefined) {
  if (_windowInfoData?.siteTimeTracker) {
    console.log(
      `Time spent on ${_windowInfoData.siteTimeTracker.title}: ${formatTime(_windowInfoData.siteTimeTracker.timeSpent)}. URL is ${_windowInfoData.url}`
    )
    console.log(
      `Last active timestamp: ${new Date(_windowInfoData.siteTimeTracker.lastActiveTimestamp).toISOString()}`
    )
  }
}

// Create the browser window
async function createWindow(): Promise<BrowserWindow> {
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
    currentSiteTimeTrackers = store.get('siteTimeTrackers', [])
    emailService.scheduleEmailSend()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    console.log('ELECTRON_RENDERER_URL is not defined')
  }

  return mainWindow
}

app.commandLine.appendSwitch('remote-allow-origins', 'devtools://devtools')
// Main app ready event
app.whenReady().then(async () => {
  console.log('ready!')
  electronApp.setAppUserModelId('com.electron')

  loadUserData()

  const now = dayjs()
  const lastResetDate = dayjs(store.get('lastResetDate'))

  if (!lastResetDate.isSame(now, 'day') || now.diff(lastResetDate, 'hours') > 24) {
    console.log('Missed daily reset from previous session, performing now.')
    schedulerWorker.postMessage({ type: 'RESET_DAILY' })
  }

  await createWindow()

  setupPeriodicSave()

  ipcMain.on('send-user-data', (event, user) => {
    console.log('Received user data from frontend:', user, event.processId)
    handleUserData(user)
  })
  ipcMain.on('test-email-send', async () => await emailService.testEmailSend())
  ipcMain.on('logout-user', () => handleUserLogout())
})

function handleUserLogout() {
  store.delete('user')
  store.set('siteTimeTrackers', [])
  schedulerWorker.postMessage({ type: 'RESET_TRACKERS' })
}

app.on('before-quit', () => schedulerWorker.terminate())
app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Initialize the worker
const schedulerWorkerPath = join(__dirname, 'worker.js')
const schedulerWorker = new Worker(schedulerWorkerPath, {
  workerData: {
    API_BASE_URL: process.env.VITE_SERVER_URL_PROD
  }
})

schedulerWorker.on('message', (message) => {
  if (message.type === 'RESET_DAILY') resetCounters('daily')
  if (message.type === 'RESET_WEEKLY') resetCounters('weekly')
})
schedulerWorker.on('error', (err) => console.error('Worker Error:', err))
schedulerWorker.on('message', (message) => console.log('Worker Message:', message))
