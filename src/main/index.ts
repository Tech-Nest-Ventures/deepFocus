import { app, shell, BrowserWindow, ipcMain, powerMonitor, Notification } from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import dotenv from 'dotenv'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
const { activeWindow } = await import('@deepfocus/get-windows')
import Store from 'electron-store'
import {
  StoreSchema,
  SiteTimeTracker,
  DeepWorkHours,
  MessageType,
  User,
  FocusInterval
} from './types'
import {
  updateSiteTimeTracker,
  mergeOverlappingIntervals,
  isDeepWork,
  checkAndRequestPermissions
} from './productivityUtils'
import { getInstalledApps } from './childProcess'

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
  clear(): void
}

const store = new Store<StoreSchema>() as TypedStore
let currentSiteTimeTrackers: SiteTimeTracker[] = []
let deepWorkHours = {
  Monday: 0,
  Tuesday: 0,
  Wednesday: 0,
  Thursday: 0,
  Friday: 0,
  Saturday: 0,
  Sunday: 0
} as DeepWorkHours

let currentDeepWork = 0
const deepWorkTarget = store.get('deepWorkTarget', 4) as number
let mainWindow: BrowserWindow | null = null
resetCounters('daily')

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
    iconPath = getIconPath('icon_green.png')
  } else if (currentDeepWork > 0 && currentDeepWork < Math.floor(deepWorkTarget / 2)) {
    console.log('Greater than 1. Setting to blue icon')
    iconPath = getIconPath('icon_yellow.png')
  } else if (currentDeepWork > 0 && currentDeepWork > Math.floor(deepWorkTarget / 2)) {
    iconPath = getIconPath('icon_blue.png')
  } else {
    iconPath = getIconPath('icon_red.png')
  }

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
  const now = dayjs()
  if (type === 'daily') {
    console.log('Resetting Daily Trackers')
    getSiteTrackers().forEach((tracker) => (tracker.timeSpent = 0))
    store.set('lastResetDate', dayjs().format('YYYY-MM-DD'))
    const deepWorkHours = getDeepWorkHours()
    deepWorkHours[now.format('dddd')] = 0
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
    store.set('siteTimeTrackers', [])
  }
  console.log(
    'Finished reset. Current site time trackers:',
    currentSiteTimeTrackers,
    'Deep work hours:',
    deepWorkHours,
    'last reset date:',
    store.get('lastResetDate')
  )
}

// Periodic saving of time trackers, deep work hours, and icon progress
function setupPeriodicSave() {
  setInterval(
    () => {
      store.set('siteTimeTrackers', currentSiteTimeTrackers)
      store.set('deepWorkHours', deepWorkHours)
      updateIconBasedOnProgress()
      handleDailyReset()
    },
    5 * 60 * 1000
  )
}

// Monitor system idle time and user activity every 2 minutes
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
        if (!windowInfo.owner.bundleId.includes('com.apple')) {
          console.log('windowInfo', windowInfo)
          updateSiteTimeTracker(windowInfo, currentSiteTimeTrackers)
        } else {
          console.log('Ignoring Apple App', windowInfo.owner.bundleId)
        }
      }
    } catch (error) {
      console.error('Error getting active window:', error)
    }
  }, 120000)
}

// Function to calculate and update deep work hours
function calculateDeepWorkHours(
  siteTrackers: SiteTimeTracker[],
  deepWorkHours: DeepWorkHours
): DeepWorkHours {
  const today = dayjs().format('dddd')
  const focusIntervals: FocusInterval[] = []

  // Filter only deep work apps/sites
  siteTrackers.forEach((tracker) => {
    if (isDeepWork(tracker.title)) {
      focusIntervals.push({
        start: tracker.lastActiveTimestamp - tracker.timeSpent,
        end: tracker.lastActiveTimestamp
      })
    }
  })

  // Merge overlapping intervals
  const mergedIntervals = mergeOverlappingIntervals(focusIntervals)

  // Calculate total deep work time
  const totalDeepWorkTime = mergedIntervals.reduce(
    (acc, interval) => acc + (interval.end - interval.start),
    0
  )
  const timeSpentInHours = totalDeepWorkTime / (1000 * 60 * 60) // Convert from ms to hours

  // Update deep work hours for the current day
  deepWorkHours[today] = parseFloat(timeSpentInHours.toFixed(2))

  console.log(`Deep work hours for ${today}: ${deepWorkHours[today]} hours`)

  // Persist the updated deep work hours to the store
  store.set('deepWorkHours', deepWorkHours)

  return deepWorkHours
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
  app.dock.setIcon(getIconPath('icon.png'))

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
  electronApp.setAppUserModelId('com.deepfocus.app')
  currentSiteTimeTrackers = store.get('siteTimeTrackers', [])
  deepWorkHours = store.get('deepWorkHours', {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0
  }) as DeepWorkHours

  await createWindow().then(() => {
    loadUserData()
    handleDailyReset()
    setupPeriodicSave()
    setupIPCListeners()
    checkAndRequestPermissions()
  })
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function handleUserLogout() {
  store.delete('user')
  resetCounters('daily')
}
function setupIPCListeners() {
  ipcMain.on('send-user-data', (event, user) => {
    handleUserData(user)
    const savedUser = store.get('user')
    if (savedUser) {
      startActivityMonitoring()
      currentSiteTimeTrackers = getSiteTrackers()
    }
  })
  ipcMain.on('logout-user', () => handleUserLogout())

  // Fetch Unproductive URLs
  ipcMain.on('fetch-unproductive-urls', (event) => {
    const urls = store.get('unproductiveUrls', [])
    event.reply('unproductive-urls-response', urls)
  })

  // Fetch Unproductive Apps
  ipcMain.on('fetch-unproductive-apps', (event) => {
    const apps = store.get('unproductiveApps', [])
    event.reply('unproductive-apps-response', apps)
  })

  // Add or update Unproductive URLs and persist them
  ipcMain.on('add-unproductive-url', (event, urls) => {
    store.set('unproductiveUrls', urls)
    console.log('Unproductive URLs updated:', urls, event.processId)
    event.reply('unproductive-urls-response', urls) // Send updated URLs back
  })

  // Update Unproductive Apps and persist them
  ipcMain.on('update-unproductive-apps', (event, apps) => {
    store.set('unproductiveApps', apps)
    console.log('Updated unproductive apps:', apps)
    event.reply('unproductive-apps-response', apps) // Send updated apps back
  })

  // Remove specific unproductive URL and persist
  ipcMain.on('remove-unproductive-url', (event, urls) => {
    store.set('unproductiveUrls', urls)
    console.log('Unproductive URLs updated:', urls, event.processId)
    event.reply('unproductive-urls-response', urls) // Send updated URLs back
  })

  ipcMain.on('fetch-deep-work-data', (event) => {
    console.log('Received event for fetch-deep-work-data')

    const updatedDeepWorkHours = getDeepWorkHours()

    // Convert the object into an array format for the front-end chart
    const chartData = [
      updatedDeepWorkHours?.Monday || 0,
      updatedDeepWorkHours?.Tuesday || 0,
      updatedDeepWorkHours?.Wednesday || 0,
      updatedDeepWorkHours?.Thursday || 0,
      updatedDeepWorkHours?.Friday || 0,
      updatedDeepWorkHours?.Saturday || 0,
      updatedDeepWorkHours?.Sunday || 0
    ]

    event.reply('deep-work-data-response', chartData)
  })

  ipcMain.on('fetch-app-icons', async (event) => {
    try {
      const apps = await getInstalledApps()
      console.log('Apps are ', apps)
      event.reply('app-icons-response', apps)
    } catch (error) {
      console.error('Error fetching app icons:', error)
      event.reply('app-icons-response', [])
    }
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
app.on('will-quit', () => {
  ipcMain.removeAllListeners()
})

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
  if (message.type === MessageType.GET_DATA) {
    const currentSiteTimeTrackers = getSiteTrackers()
    const deepWorkHours = getDeepWorkHours()
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

function getDeepWorkHours(): DeepWorkHours {
  calculateDeepWorkHours(getSiteTrackers(), deepWorkHours)
  return deepWorkHours
}

function getSiteTrackers(): SiteTimeTracker[] {
  return currentSiteTimeTrackers
}
