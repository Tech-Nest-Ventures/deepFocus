import { app, shell, BrowserWindow, ipcMain, powerMonitor, Notification } from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import dotenv from 'dotenv'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
const { activeWindow } = await import('@deepfocus/get-windows')
import Store from 'electron-store'
import { StoreSchema, SiteTimeTracker, DeepWorkHours, MessageType, User } from './types'
import { updateSiteTimeTracker } from './productivityUtils'

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
  clear(): void
}

const store = new Store<StoreSchema>() as TypedStore
let currentSiteTimeTrackers: SiteTimeTracker[] = []
let currentDeepWork = 0
const deepWorkTarget = store.get('deepWorkTarget', 4) as number // Default to 4 hours if not set
let mainWindow: BrowserWindow | null = null

setupEnvironment()
// Initialize environment variables based on the environment
function setupEnvironment(): void {
  if (app.isPackaged) {
    const envPath = path.join(process.resourcesPath, '.env')
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
    else console.error('Env file not found in production build')
  } else {
    console.log('app is not packaged')
    dotenv.config()
  }
}

function updateIconBasedOnProgress() {
  if (!mainWindow) return

  let iconPath

  if (currentDeepWork >= deepWorkTarget) {
    iconPath = getIconPath('icon_green.png') // Change to green icon when the target is hit
  } else if (currentDeepWork > 0) {
    console.log('Greater than 1. Setting to blue icon')
    iconPath = getIconPath('icon_blue.png') // Change to yellow icon when there is progress
  } else {
    iconPath = getIconPath('icon_red.png') // Default red icon
  }

  mainWindow.setIcon(iconPath)
  app.dock.setIcon(iconPath)
}

// Store user data in the electron-store and send to worker
function handleUserData(user: User): void {
  store.set('user', {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    language: user.language
  })
  schedulerWorker.postMessage({
    type: MessageType.SET_USER_INFO,
    user
  })
}

// Load user data if available on app start
function loadUserData() {
  const savedUser = store.get('user')
  if (savedUser) {
    schedulerWorker.postMessage({ type: MessageType.SET_USER_INFO, user: savedUser })

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
    const now = dayjs()
    console.log('Resetting Daily Trackers')
    currentSiteTimeTrackers.forEach((tracker) => (tracker.timeSpent = 0))
    store.set('lastResetDate', dayjs().format('YYYY-MM-DD'))
    const deepWorkHours = store.get('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    }) as DeepWorkHours

    deepWorkHours[now.format('dddd')] = 0
    resetCounters('daily')
    store.set('deepWorkHours', deepWorkHours)
    store.set('siteTimeTrackers', currentSiteTimeTrackers)
  } else if (type === 'weekly') {
    console.log('Resetting Weekly Trackers')
    currentSiteTimeTrackers = []
    store.set('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    })
    store.set('siteTimeTrackers', currentSiteTimeTrackers)
  }
}

// Periodic saving of time trackers
function setupPeriodicSave() {
  setInterval(() => store.set('siteTimeTrackers', currentSiteTimeTrackers), 5 * 60 * 1000)
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
      if (windowInfo && windowInfo!.platform === 'macos') {
        console.log('windowInfo', windowInfo)
        updateSiteTimeTracker(windowInfo, currentSiteTimeTrackers)
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 120000) // every 2 mins
}

// Create the browser window
async function createWindow(): Promise<BrowserWindow> {
  mainWindow = new BrowserWindow({
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
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Main app ready event
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  await createWindow().then(() => {
    loadUserData()
    handleDailyReset()
    setupPeriodicSave()
    setupIPCListeners()
  })
})

function handleUserLogout() {
  store.delete('user')
  store.set('siteTimeTrackers', [])
  schedulerWorker.postMessage({ type: MessageType.RESET_TRACKERS })
}
function setupIPCListeners() {
  ipcMain.on('send-user-data', (event, user) => {
    handleUserData(user)
    const savedUser = store.get('user')
    if (savedUser) {
      startActivityMonitoring()
      currentSiteTimeTrackers = store.get('siteTimeTrackers', [])
    }
  })
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
    schedulerWorker.postMessage({
      type: MessageType.UPDATE_DATA,
      data: { deepWorkHours, currentSiteTimeTrackers }
    })

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
    // Send the data back to the renderer process
    event.reply('deep-work-data-response', chartData)
  })
}
function handleDailyReset() {
  const now = dayjs()
  const lastResetDate = dayjs(store.get('lastResetDate'))
  if (!lastResetDate.isSame(now, 'day') || now.diff(lastResetDate, 'hours') > 24) {
    console.log('Missed daily reset from previous session, performing now.')
    resetCounters('daily')
  }
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

schedulerWorker.on('message', (message: any) => {
  if (message.type === MessageType.RESET_DAILY) resetCounters('daily')
  if (message.type === MessageType.RESET_WEEKLY) resetCounters('weekly')
  if (message.type === MessageType.UPDATE_DATA) {
    store.set('deepWorkHours', message.data as DeepWorkHours)
    const today = dayjs().format('dddd')
    currentDeepWork = message.data[today] || 0

    console.log(`Current deep work hours: ${currentDeepWork} hours`)

    // Update the app icon based on deep work progress
    updateIconBasedOnProgress()
  }
  if (message.type === MessageType.GET_DATA) {
    const currentSiteTimeTrackers = store.get('siteTimeTrackers', [])
    const deepWorkHours = store.get('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    }) as DeepWorkHours
    schedulerWorker.postMessage({
      type: MessageType.REPLY_DATA,
      data: { currentSiteTimeTrackers, deepWorkHours }
    })
  }
})
schedulerWorker.on('error', (err) => console.error('Worker Error:', err))
schedulerWorker.on('message', (message) => console.log('Worker Message:', message))

// Dynamically resolve the path to the resources directory
function getIconPath(iconName) {
  if (app.isPackaged) {
    // In production, resolve the path from the asar-unpacked resources
    return path.join(process.resourcesPath, 'resources', iconName)
  } else {
    // In development mode, resolve the path from your local development folder
    return path.join(__dirname, '../../resources', iconName)
  }
}
