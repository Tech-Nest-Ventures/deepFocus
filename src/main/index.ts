import { app, shell, ipcMain, powerMonitor, BrowserWindow, Notification } from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import dotenv from 'dotenv'
import Store from 'electron-store'
import { StoreSchema, SiteTimeTracker, DeepWorkHours, MessageType, User, browser } from './types'
import {
  updateSiteTimeTracker,
  isDeepWork,
  getBrowserURL,
  getActiveWindowApp,
  getBaseURL
} from './productivityUtils'
import { getInstalledApps } from './childProcess'
import { resetCounters, checkForUpdates, getIconPath, updateIconBasedOnProgress } from './utils'
import log from 'electron-log/node.js'

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
  clear(): void
}

const store = new Store<StoreSchema>() as TypedStore
let currentSiteTimeTrackers: SiteTimeTracker[] = []
let monitoringInterval: NodeJS.Timeout | null = null
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
let user: User | null = null
let iconPath: string = ''
let deepWorkTarget = store.get('deepWorkTarget', 8) as number
let mainWindow: BrowserWindow | null = null
log.transports.file.level = 'debug'
log.transports.file.maxSize = 10 * 1024 * 1024

log.info('Log from the main process')

setupEnvironment()
log.info('Set up Environment')
// Initialize environment variables based on the environment
function setupEnvironment(): void {
  if (app.isPackaged) {
    const envPath = path.join(process.resourcesPath, '.env')
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
      console.error('Env file not found in production build')
    }
  } else {
    console.log('app is not packaged')
    dotenv.config()
  }
}

// Store user data in the electron-store and send to worker
function handleUserData(user: User): User {
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
  return user
}

// Load user data if available on app start
function loadUserData() {
  const savedUser: User | null = store.get('user') || null
  if (savedUser) {
    schedulerWorker.postMessage({ type: MessageType.SET_USER_INFO, user: savedUser })

    new Notification({
      title: 'DeepFocus',
      body: 'Welcome back, ' + savedUser.firstName,
      icon: join(__dirname, 'resources/icon.png')
    }).show()
  }
  return savedUser
}

// Periodic saving of time trackers, deep work hours, and icon progress every 2 minutes
function setupPeriodicSave() {
  setInterval(
    () => {
      if (user) {
        const today = dayjs()
        log.info('Periodic save triggered for today: ', today.format('dddd, HH:mm'))
        store.set('siteTimeTrackers', currentSiteTimeTrackers)
        store.set('deepWorkHours', deepWorkHours)
        currentDeepWork = deepWorkHours[today.format('dddd')] || 0
        iconPath = updateIconBasedOnProgress(iconPath, deepWorkTarget, currentDeepWork)
        handleDailyReset()
      } else {
        log.info('User is not logged in. Not saving data.')
      }
    },
    2 * 60 * 1000
  )
}

function isBrowser(appName: string): appName is browser {
  return [
    'Google Chrome',
    'Arc',
    'Brave Browser',
    'Microsoft Edge',
    'Vivaldi',
    'Opera',
    'Safari',
    'Firefox'
  ].includes(appName)
}

function startActivityMonitoring(mainWindow: Electron.BrowserWindow) {
  if (!monitoringInterval) {
    const today = dayjs()
    monitoringInterval = setInterval(async () => {
      const idleTime = powerMonitor.getSystemIdleTime()

      // Skip if the system has been idle for more than 60 seconds
      if (idleTime > 60) {
        console.log(`System idle for ${idleTime} seconds.`)
        return
      }

      try {
        const appName = await getActiveWindowApp() // Get the active application name
        if (!appName) {
          log.info('No active window app found')
          return
        }

        console.log(`Active Application: ${appName}`)
        let URL: string = ''

        if (isBrowser(appName)) {
          URL = getBaseURL(await getBrowserURL(appName))
        }

        updateSiteTimeTracker(appName, currentSiteTimeTrackers, URL)

        // Send the active window info and URL to the renderer process
        if (mainWindow) {
          mainWindow.webContents.send('active-window-info', { appName, URL })
        }
      } catch (error) {
        console.error('Error getting active window or URL:', error)
      }
    }, 15000) // Run the monitoring function every 15 seconds
    log.info('Activity monitoring started.', today.format('dddd, HH:mm'))
  }
}

function stopActivityMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval) // Clear the interval
    monitoringInterval = null // Reset the interval ID
    console.log('Activity monitoring stopped.')
    log.info('Activity monitoring stopped.')
  }
}

function calculateDeepWorkHours(
  siteTrackers: SiteTimeTracker[],
  deepWorkHours: DeepWorkHours
): DeepWorkHours {
  const today = dayjs().format('dddd')
  let totalDeepWorkTime = 0

  // Filter and sum the time spent on deep work apps/sites
  siteTrackers.forEach((tracker) => {
    if (isDeepWork(tracker.title, store)) {
      totalDeepWorkTime += tracker.timeSpent
    }
  })
  const timeSpentInHours = Number((totalDeepWorkTime / (60 * 60)).toFixed(2)) // Convert from sec to hours
  deepWorkHours[today] = timeSpentInHours
  log.info(`Deep work hours for ${today}: ${deepWorkHours[today]} hours`)
  store.set('deepWorkHours', deepWorkHours)
  return deepWorkHours
}

// Create the browser window
async function createWindow(): Promise<BrowserWindow> {
  mainWindow = new BrowserWindow({
    width: 600,
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

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

// Main app ready event
app.whenReady().then(async () => {
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

  await createWindow().then(async () => {
    try {
      // TODO: This logic may be necessary in the future if scripting fails.
      // Wait for permissions before proceeding with other functions
      // await Promise.race([
      //   checkAndRequestPermissions(),
      //   new Promise((_, reject) =>
      //     setTimeout(() => reject(new Error('Permission request timeout')), 60000)
      //   )
      // ])

      //console.log('Permissions granted or handled. Proceeding...')
      handleDailyReset()
      user = loadUserData()
      setupPeriodicSave()
      setupIPCListeners()
    } catch (error) {
      console.error('Error during permission check or timeout:', error)

      new Notification({
        title: 'DeepFocus',
        body: `Deep Focus can't function properly without permissions.`,
        icon: join(__dirname, 'resources/icon.png')
      })
      app.quit()
    }
  })
})

app.on('ready', () => {
  log.info('Checking for updates')
  checkForUpdates()
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
  const today = dayjs()
  log.info('Handling user logout', today.format('dddd, HH:mm'))
  store.delete('user')
  user = null
  stopActivityMonitoring()
}

function setupIPCListeners() {
  ipcMain.on('send-user-data', (event, user: User) => {
    user = handleUserData(user)
    if (user && mainWindow) {
      console.log('setting up listeners & monitoring')
      currentSiteTimeTrackers = getSiteTrackers()
      startActivityMonitoring(mainWindow)
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
  // Fetch the user's deep work target daily
  ipcMain.on('fetch-deep-work-target', (event) => {
    deepWorkTarget = store.get('deepWorkTarget', 8) as number
    event.reply('deep-work-target-response', deepWorkTarget)
  })
  // Update the user's deep work target daily
  ipcMain.on('update-deep-work-target', (event, newTarget: number) => {
    store.set('deepWorkTarget', newTarget)
    console.log(`Updated Deep Work Target: ${newTarget}`)
  })
  // Fetch the user's current deep work hours daily
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
  // Fetch the App icons of the Users installed apps (MacOS)
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

  const lastResetDate = dayjs(store.get('lastResetDate'))
  if (!lastResetDate.isSame(now, 'day') || now.diff(lastResetDate, 'hours') > 24) {
    console.log('Missed daily reset from previous session, performing now.')
    resetCounters('daily', store, currentSiteTimeTrackers, deepWorkHours)
  }
}

app.on('before-quit', () => schedulerWorker.terminate())
app.on('will-quit', () => {
  ipcMain.removeAllListeners()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Listen for permission changes (you could place this logic wherever it's most appropriate)

// Initialize the worker
const schedulerWorkerPath = join(__dirname, 'worker.js')
const schedulerWorker = new Worker(schedulerWorkerPath, {
  workerData: {
    API_BASE_URL: process.env.VITE_SERVER_URL_PROD
  }
})

schedulerWorker.on('message', (message: any) => {
  if (message.type === MessageType.RESET_DAILY)
    resetCounters('daily', store, getSiteTrackers(), getDeepWorkHours())
  if (message.type === MessageType.RESET_WEEKLY)
    resetCounters('weekly', store, getSiteTrackers(), getDeepWorkHours())
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

function getDeepWorkHours(): DeepWorkHours {
  calculateDeepWorkHours(getSiteTrackers(), deepWorkHours)
  return deepWorkHours
}

function getSiteTrackers(): SiteTimeTracker[] {
  return currentSiteTimeTrackers
}
