import { app, shell, BrowserWindow, ipcMain, powerMonitor, Notification } from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import dotenv from 'dotenv'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
const { activeWindow } = await import('@deepfocus/get-windows')
import Store from 'electron-store'

import { EmailService } from './emailService'
import { StoreSchema, SiteTimeTracker, ExtendedResult, DeepWorkHours } from './types'
import {
  getUrlFromResult,
  formatTime,
  updateSiteTimeTracker,
  getBaseURL
} from './productivityUtils'

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
  clear(): void
}

const store = new Store<StoreSchema>() as TypedStore
let currentSiteTimeTrackers: SiteTimeTracker[] = []
setupEnvironment()
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
    const savedUrls = store.get('unproductiveUrls', [])
    console.log('Loaded unproductive URLs from store:', savedUrls)
    schedulerWorker.postMessage({ type: 'SET_USER_INFO', user: savedUser })

    new Notification({
      title: 'DeepFocus',
      body: 'Welcome back, ' + savedUser.firstName,
      icon: join(__dirname, 'resources/icon.png')
    }).show()
  }
}

// Reset counters logic
function resetCounters(type: 'daily' | 'weekly') {
  if (type === 'daily') {
    console.log('Resetting Daily Trackers')
    currentSiteTimeTrackers.forEach((tracker) => (tracker.timeSpent = 0))
    console.log('currentSiteTimeTrackers after daily reset', currentSiteTimeTrackers)
    console.log('store.get(lastResetDate)', store.get('lastResetDate'))
    store.set('lastResetDate', dayjs().format('YYYY-MM-DD'))
  } else if (type === 'weekly') {
    console.log('Resetting Weekly Trackers')
    currentSiteTimeTrackers = []
  }
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
}

// Periodic saving of time trackers
function setupPeriodicSave() {
  setInterval(() => store.set('siteTimeTrackers', currentSiteTimeTrackers), 5 * 60 * 1000)
  console.log('setupPeriodicSave', store.get('siteTimeTrackers'))
}

// Monitor system idle time and user activity
function startActivityMonitoring() {
  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime()
    if (idleTime > 60) {
      console.log(`System idle for ${idleTime} seconds.`)
      return
    }
    try {
      const windowInfo = await activeWindow()
      console.log('windowInfo', windowInfo)
      if (windowInfo && windowInfo!.platform === 'macos') {
        updateSiteTimeTracker(windowInfo, currentSiteTimeTrackers)
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 60000) // every minute
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

// Main app ready event
app.whenReady().then(async () => {
  console.log('ready!')
  electronApp.setAppUserModelId('com.electron')

  await createWindow().then(() => {
    loadUserData()
    handleDailyReset()
    setupPeriodicSave()
    setupIPCListeners()
    setupWindowActivityListener()
  })
})

function handleUserLogout() {
  store.delete('user')
  store.set('siteTimeTrackers', [])
  schedulerWorker.postMessage({ type: 'RESET_TRACKERS' })
}
function setupIPCListeners() {
  ipcMain.on('send-user-data', (event, user) => {
    console.log('Received user data from frontend:', user, event.processId)
    handleUserData(user)
    const savedUser = store.get('user')
    if (savedUser) {
      startActivityMonitoring()
      currentSiteTimeTrackers = store.get('siteTimeTrackers', [])
    }
  })
  ipcMain.on('test-email-send', async () => await emailService.testEmailSend())
  ipcMain.on('logout-user', () => handleUserLogout())
  ipcMain.on('fetch-unproductive-urls', (event) => {
    const urls = store.get('unproductiveUrls', [])
    event.reply('unproductive-urls-response', urls)
  })
  ipcMain.on('add-unproductive-url', (event, urls) => {
    store.set('unproductiveUrls', urls)
    console.log('Unproductive URLs updated:', urls, event.processId)
  })

  // Event for removing unproductive URLs
  ipcMain.on('remove-unproductive-url', (event, urls) => {
    store.set('unproductiveUrls', urls)
    console.log('Unproductive URLs updated:', urls, event.processId)
  })

  ipcMain.on('fetch-deep-work-data', (event) => {
    console.log('Received event for fetch-deep-work-data')
    // Fetch deep work hours data from electron-store
    const deepWorkHours = store.get('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    }) as DeepWorkHours
    console.log('deepWorkHours', deepWorkHours)

    // Convert the object into an array format expected by the chart
    const chartData = [
      deepWorkHours?.Monday || 0,
      deepWorkHours?.Tuesday || 0,
      deepWorkHours?.Wednesday || 0,
      deepWorkHours?.Thursday || 0,
      deepWorkHours?.Friday || 0,
      deepWorkHours?.Saturday || 0,
      deepWorkHours?.Sunday || 0
    ]

    console.log('chartData', chartData)

    // Send the data back to the renderer process
    event.reply('deep-work-data-response', chartData)
  })
}
function handleDailyReset() {
  const now = dayjs()
  const lastResetDate = dayjs(store.get('lastResetDate'))
  if (!lastResetDate.isSame(now, 'day') || now.diff(lastResetDate, 'hours') > 24) {
    console.log('Missed daily reset from previous session, performing now.')
    schedulerWorker.postMessage({ type: 'RESET_DAILY' })
  }
}

function setupWindowActivityListener() {
  // Send the store data to the worker thread every 10 minutes
  setInterval(
    () => {
      const currentSiteTimeTrackers = store.get('siteTimeTrackers', [])
      schedulerWorker.postMessage({ type: 'STORE_DATA', data: currentSiteTimeTrackers })
    },
    2.5 * 60 * 1000
  ) // Every 5 minutes
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
  if (message.type === 'STORE_DATA') store.set('deepWorkHours', message.data)
})
schedulerWorker.on('error', (err) => console.error('Worker Error:', err))
schedulerWorker.on('message', (message) => console.log('Worker Message:', message))
