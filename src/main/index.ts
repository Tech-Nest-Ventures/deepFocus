import {
  app,
  shell,
  ipcMain,
  powerMonitor,
  BrowserWindow,
  Notification,
  Menu,
  MenuItemConstructorOptions
} from 'electron'
import { Worker } from 'worker_threads'
import path, { join } from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import schedule from 'node-schedule'
import dotenv from 'dotenv'
import Store from 'electron-store'
import { StoreSchema, SiteTimeTracker, DeepWorkHours, MessageType, User } from './types'
import {
  updateSiteTimeTracker,
  getBrowserURL,
  getActiveWindowApp,
  getBaseURL,
  isDeepWork,
  calculateDeepWorkHours,
  isBrowser
} from './productivityUtils'
import {
  resetCounters,
  checkForUpdates,
  getIconPath,
  updateIconBasedOnProgress,
  handleDailyReset,
  checkDailyResetOnFocus
} from './utils/utils'
import { setupIPCListeners } from './utils/ipcListeners'
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
let mainWindow: BrowserWindow | null = null
log.transports.file.level = 'debug'
log.transports.file.maxSize = 10 * 1024 * 1024

log.info('Log from the main process')
let resourcesPath: string = setupEnvironment()
log.info('Set up Environment')

// Initialize environment variables based on the environment
function setupEnvironment() {
  try {
    log.info('Setting up environment...')

    // Initialize resourcesPath within this function
    const resourcesPath = app.isPackaged ? process?.resourcesPath : __dirname
    log.info('app.isPackaged:', app.isPackaged)
    log.info('resourcesPath:', resourcesPath)

    // Set up the path to the .env file
    const envPath = path.join(resourcesPath, '.env')
    log.info('Looking for .env at:', envPath)

    // Load environment variables from the .env file if it exists
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
      log.info('Loaded .env file from:', envPath)
    } else {
      log.warn('Env file not found at:', envPath)
    }
    return resourcesPath
  } catch (error) {
    log.error('Failed to set up environment:', error)
    throw error
  }
}

export function updateAppMenu() {
  createAppMenu()
}

function createAppMenu() {
  const totalDeepWorkHours = getDeepWorkHours()

  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: 'DeepFocus',
      submenu: [
        {
          label: `Total Deep Work: ${totalDeepWorkHours} hours`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Reset Data',
          click: () => {
            handleDailyReset(store)
            new Notification({
              title: 'DeepFocus',
              body: 'Daily data has been reset.',
              icon: join(resourcesPath, 'icon.png')
            }).show()
            updateAppMenu()
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.quit()
          }
        }
      ]
    }
  ]

  // Create the menu from the template
  const menu = Menu.buildFromTemplate(menuTemplate)

  // Set the application menu
  Menu.setApplicationMenu(menu)
}

// Store user data in the electron-store and send to worker
export function handleUserData(user: User, store: TypedStore): User {
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
export function loadUserData() {
  const savedUser: User | null = store.get('user') || null
  if (savedUser) {
    schedulerWorker.postMessage({ type: MessageType.SET_USER_INFO, user: savedUser })

    new Notification({
      title: 'DeepFocus',
      body: 'Welcome back, ' + savedUser.firstName,
      icon: join(resourcesPath, 'icon.png')
    }).show()
  }
  return savedUser
}

async function storeData() {
  const today = dayjs()
  log.info(
    'Periodic save triggered (updating siteTimeTrackers, deepWorkHours, currentDeepWork and icon): ',
    today.format('dddd, HH:mm')
  )
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
  store.set('deepWorkHours', deepWorkHours)
  currentDeepWork = deepWorkHours[today.format('dddd')] || 0
}

// Periodic saving of time trackers, deep work hours, and icon progress every 2 minutes
function setupPeriodicSave() {
  if (!monitoringInterval) {
    setInterval(
      () => {
        if (user) {
          storeData()
          let deepWorkTarget = store.get('deepWorkTarget', 8) as number
          iconPath = updateIconBasedOnProgress(
            iconPath,
            deepWorkTarget,
            currentDeepWork,
            resourcesPath
          )
        } else {
          log.info('User is not logged in. Not saving data.')
        }
      },
      2 * 60 * 1000
    )
    // Handle checking
    setInterval(
      () => {
        if (user) {
          const today = dayjs()
          log.info('Periodic save. Invoking handleDailyReset: ', today.format('dddd, HH:mm'))
          handleDailyReset(store)
        } else {
          log.info('User is not logged in. Not invoking handleDailyReset.')
        }
      },
      30 * 60 * 1000
    )
  } else {
    log.info('setUpPeriodicSave stopped.')
  }
}

export function startActivityMonitoring(mainWindow: Electron.BrowserWindow) {
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

        // console.log(`Active Application: ${appName}`)
        let URL: string = ''

        if (isBrowser(appName)) {
          URL = getBaseURL(await getBrowserURL(appName))
        }

        updateSiteTimeTracker(appName, currentSiteTimeTrackers, URL)

        // Send the active window info and URL to the renderer process
        if (mainWindow) {
          const isProductive = URL.length
            ? isDeepWork({ type: 'URL', value: URL }, store)
            : isDeepWork({ type: 'appName', value: appName }, store)

          mainWindow.webContents.send('active-window-info', { appName, URL, isProductive })
        }
      } catch (error) {
        console.error('Error getting active window or URL:', error)
      }
    }, 5000) // Run the monitoring function every 15 seconds
    log.info('Activity monitoring started.', today.format('dddd, HH:mm'))
  }
}

function stopActivityMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval) // Clear the interval
    monitoringInterval = null // Reset the interval ID
    log.info('Activity monitoring stopped.')
    log.info('Periodic Save Stopped. ')
    log.info('Last reset date is ', store.get('lastResetDate'))
  }
}

// Create the browser window
async function createWindow(): Promise<BrowserWindow> {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 670,
    show: false,
    autoHideMenuBar: false,
    icon: join(resourcesPath, 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegrationInWorker: true,
      sandbox: false
    }
  })
  app.dock.setIcon(getIconPath('icon.png', resourcesPath))

  log.info('Loading loader.html', path.join(__dirname, '../renderer/loader.html'))
  mainWindow.loadFile(path.join(__dirname, '../renderer/loader.html'))

  mainWindow.on('ready-to-show', async () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  setTimeout(() => {
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow?.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow?.loadFile(join(__dirname, '../renderer/index.html'))
    }
    mainWindow?.once('ready-to-show', () => {
      mainWindow?.show()
    })
  }, 5000)

  mainWindow.on('closed', async () => {
    log.info('Main Window closed')
    await storeData()
    log.info('Last reset date is ', store.get('lastResetDate'))
    app.quit()
    if (process.platform === 'darwin') {
      app.dock.hide()
    }
  })

  return mainWindow
}

// Main app ready event
app.whenReady().then(async () => {
  log.info('app is ready. Retrieving currentSiteTimeTrackers and deepWorkHours from store')
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
      log.info('created window.')
      setupIPCListeners(ipcMain, store, mainWindow)
      user = loadUserData()
      setupPeriodicSave()
    } catch (error) {
      console.error('Error during permission check or timeout:', error)

      new Notification({
        title: 'DeepFocus',
        body: `Deep Focus can't function properly without permissions.`,
        icon: join(__dirname, 'resources/icon.png')
      })
    }
  })
})

app.on('ready', () => {
  log.info('Checking for updates & performing daily resets')
  checkForUpdates()
  handleDailyReset(store)
})

// Listen for app activation (when the app is brought back to focus)
app.on('activate', () => {
  log.info('App activated. Checking for missed daily resets.')
  checkDailyResetOnFocus(store)
})

// Listen for focus events on the main window (when the user focuses the app's main window)
app.on('browser-window-focus', () => {
  log.info('App window focused. Checking for missed daily resets.')
  checkDailyResetOnFocus(store)

  if (mainWindow) {
    mainWindow.webContents.send('refresh-deep-work-data') // Refresh deep work data
    mainWindow.webContents.send('fetch-latest-app-icons') // Refresh app icons
    mainWindow.webContents.send('update-deep-work-target') // Update deep work target
  }
})

export function handleUserLogout() {
  const today = dayjs()
  log.info('Handling user logout', today.format('dddd, HH:mm'))
  store.delete('user')
  user = null
  stopActivityMonitoring()
  new Notification({
    title: 'DeepFocus',
    body: 'You have been logged out',
    icon: join(__dirname, 'resources/icon.png')
  }).show()
}

app.on('before-quit', () => schedulerWorker.terminate())
app.on('will-quit', () => {
  ipcMain.removeAllListeners()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Initialize worker and listen for messages
const schedulerWorkerPath = join(__dirname, 'worker.js')
const schedulerWorker = new Worker(schedulerWorkerPath, {
  workerData: {
    API_BASE_URL: process.env.VITE_SERVER_URL_PROD
  }
})
schedulerWorker.on('message', (message: any) => {
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

// Getters
export function getDeepWorkHours(): DeepWorkHours {
  calculateDeepWorkHours(getSiteTrackers(), deepWorkHours, store)
  return deepWorkHours
}
export function getSiteTrackers(): SiteTimeTracker[] {
  return currentSiteTimeTrackers
}

schedule.scheduleJob('0 0 0 * * *', () => {
  log.info('Scheduled daily reset at midnight')
  handleDailyReset(store)
  ipcMain.emit('reset-deep-work-data')
  log.info('new reset date is ', store.get('lastResetDate'))
})

// Log unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error)
})
