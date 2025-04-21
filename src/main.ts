import {
  app,
  shell,
  ipcMain,
  powerMonitor,
  BrowserWindow,
  Notification,
  Menu,
  Tray,
  nativeImage
} from 'electron'
import path from 'path'
import dayjs from 'dayjs'
import fs from 'fs'
import { scheduleJob } from 'node-schedule'
import dotenv from 'dotenv'
import { StoreSchema, SiteTimeTracker, DeepWorkHours, User, AppIcon } from './types'
import {
  updateSiteTimeTracker,
  getBrowserURL,
  getActiveWindowApp,
  getBaseURL,
  isDeepWork,
  calculateDeepWorkHours,
  isBrowser,
  isValidURL
} from './productivityUtils'
import { getApplicationIcons } from './childProcess'
import { checkForUpdates, getIconPath, updateIconBasedOnProgress } from './utils'
import log from 'electron-log/node.js'
import { ChildProcess, fork } from 'child_process'
import { join } from 'path'

export interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
  clear(): void
}
const API_BASE_URL = 'https://backend-production-5eec.up.railway.app'
// const API_BASE_URL = 'http://localhost:3003'
let store: TypedStore
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
let iconPath = ''
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let persistenceInterval: NodeJS.Timeout | null = null
let isSystemSuspended = false
let serverProcess: ChildProcess | null = null
let isQuitting = false // Add this flag to track app quit state
log.transports.file.level = 'debug'
log.transports.file.maxSize = 10 * 1024 * 1024

log.info('Log from the main process')
const resourcesPath: string = setupEnvironment()
log.info('Set up Environment')

// Initialize store asynchronously
async function initializeStore() {
  const { default: Store } = await import('electron-store')
  store = new Store<StoreSchema>() as TypedStore

  // Move initial store operations here
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
  user = store.get('user', null)
}

function startWebSocketServer() {
  try {
    // Don't start if we're quitting or if a process already exists
    if (isQuitting || serverProcess) {
      return
    }

    serverProcess = fork(join(__dirname, 'wsServer.js'), [], {
      stdio: 'inherit'
    })

    serverProcess.on('error', (err) => {
      log.error('WebSocket Server Error:', err)
    })

    serverProcess.on('exit', (code) => {
      log.info(`WebSocket Server exited with code ${code}`)
      serverProcess = null

      // Only restart if:
      // 1. Not quitting
      // 2. Exit wasn't normal (code !== 0)
      // 3. System isn't suspended
      if (!isQuitting && code !== 0 && !isSystemSuspended) {
        log.info('Restarting WebSocket Server...')
        setTimeout(() => startWebSocketServer(), 1000) // Add delay before restart
      }
    })
  } catch (err) {
    log.error('Failed to start WebSocket Server:', err)
  }
}

function stopWebSocketServer() {
  if (serverProcess) {
    log.info('Stopping WebSocket Server...')
    serverProcess.kill()
    serverProcess = null
  }
}

// Initialize environment variables based on the environment
function setupEnvironment(): string {
  try {
    log.info('Setting up environment...')

    const resourcesPath = app.isPackaged
      ? path.join(process.resourcesPath)
      : path.join(__dirname, 'resources')
    log.info('app.isPackaged:', app.isPackaged)
    log.info('resourcesPath:', resourcesPath)

    const envPath = path.join(resourcesPath, '.env')
    log.info('Looking for .env at:', envPath)

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

// Store user data in the electron-store and send to worker
export function handleUserData(user: User, store: TypedStore): User {
  store.set('user', {
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    country: user.country,
    language: user.language
  })
  return user
}

// Load user data if available on app start
export function loadUserData(): User | null {
  const savedUser: User | null = store.get('user') || null
  if (savedUser) {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '../../resources/icon.png')

    new Notification({
      title: 'Deep Focus',
      body: 'Welcome back, ' + savedUser.firstName,
      icon: iconPath
    }).show()
  }
  return savedUser
}

async function storeData(): Promise<void> {
  const today = dayjs().format('dddd') as keyof typeof deepWorkHours
  log.info(
    'Periodic save triggered (updating siteTimeTrackers, deepWorkHours, currentDeepWork and icon): '
  )
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
  store.set('deepWorkHours', deepWorkHours)
  currentDeepWork = deepWorkHours[today] || 0
}

export async function resetCounters(type: 'daily' | 'weekly'): Promise<void> {
  const now = dayjs()
  log.info('Invoked resetCounters')

  if (type === 'daily') {
    currentSiteTimeTrackers?.forEach((tracker) => {
      tracker.timeSpent = 0
      tracker.lastActiveTimestamp = 0
    })
    const lastResetDate = now.toISOString()
    store?.set('lastResetDate', lastResetDate)
    const today = now.format('dddd') as keyof typeof deepWorkHours
    deepWorkHours[today] = 0
    store.set('deepWorkHours', deepWorkHours)
    store.set('siteTimeTrackers', currentSiteTimeTrackers)
    log.info('currentSiteTimeTrackers', currentSiteTimeTrackers, 'deepWorkHours', deepWorkHours)
  } else if (type === 'weekly') {
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

  log.info(
    `${type.charAt(0).toUpperCase() + type.slice(1)} reset performed. Activity monitoring restarted.`
  )
}

// Periodic saving of time trackers, deep work hours, and icon progress every 2 minutes
function setupPeriodicSave(): void {
  if (!monitoringInterval) {
    setInterval(
      () => {
        if (user) {
          storeData()
          const deepWorkTarget = store.get('deepWorkTarget', 8) as number
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
  } else {
    log.info('setUpPeriodicSave stopped.')
  }
}

export function startActivityMonitoring(): void {
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

        let URL = ''

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
    }, 5000) // Run the monitoring function every 5 seconds
    log.info('Activity monitoring started.', today.format('dddd, HH:mm'))
  }
}

// Handles both periodicSave & activity monitoring
function stopActivityMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval) // Clear the interval
    monitoringInterval = null // Reset the interval ID
    log.info('Activity monitoring stopped.')
    log.info('Periodic Save Stopped. ')
    log.info('Last reset date is ', store.get('lastResetDate'))
  }
}

async function createWindow(): Promise<BrowserWindow> {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInWorker: true,
      sandbox: false
    },
    icon: iconPath
  })
  app.dock.setIcon(getIconPath('icon.png', resourcesPath))

  mainWindow.on('ready-to-show', async () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.on('closed', async () => {
    log.info('Main Window closed')
    await storeData()
    store.set('lastResetDate', dayjs().toISOString())
    log.info('Last reset date is ', store.get('lastResetDate'))
    app.quit()
    if (process.platform === 'darwin') {
      app.dock.hide()
    }
  })

  return mainWindow
}

app.whenReady().then(async () => {
  await initializeStore()

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'trayIcon.png')
    : path.join(__dirname, '../../resources/trayIcon.png')
  log.info('app is ready. Retrieving currentSiteTimeTrackers and deepWorkHours from store')
  log.info('currentSiteTimeTrackers', currentSiteTimeTrackers, 'deepWorkHours', deepWorkHours)

  startWebSocketServer()
  await createWindow().then(async () => {
    try {
      log.info('created window.')
      setupIPCListeners()
      user = loadUserData()
      setupPeriodicSave()
      console.log('updating app menu')
    } catch (error) {
      console.error('Error during permission check or timeout:', error)

      new Notification({
        title: 'Deep Focus',
        body: `Deep Focus can't function properly without permissions.`,
        icon: iconPath
      })
    }
  })
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(image)
  tray.setToolTip('Deep Focus. Get more done.')
  createTrayMenu()

  function createTrayMenu() {
    const today = dayjs().format('dddd') as keyof typeof deepWorkHours
    const totalDeepWorkHours = getDeepWorkHours()[today]
    log.info('totalDeepWorkHours', totalDeepWorkHours)

    // Update the label directly with the latest deep work hours
    const trayMenu = Menu.buildFromTemplate([
      {
        label: `Total Deep Work: ${totalDeepWorkHours} hours`
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ])

    tray?.setContextMenu(trayMenu)
  }
  // TODO: Undecided if we want to show app on tray click
  tray.on('click', () => {
    // if (mainWindow) {
    //   mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    // }
    createTrayMenu()
  })
})

app.on('ready', () => {
  checkForUpdates()
  startPersistenceInterval()

  powerMonitor.on('suspend', () => {
    isSystemSuspended = true
    stopPersistenceInterval()
    console.log('System suspended.')
    stopWebSocketServer()
  })

  powerMonitor.on('resume', () => {
    isSystemSuspended = false
    startPersistenceInterval()
    console.log('System resumed.')
    startWebSocketServer()
  })
})

app.on('browser-window-focus', () => {
  log.info('App window focused.')
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

  // Send the chartData to the renderer process
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('deep-work-data-response', chartData)
  }
})
export function handleUserLogout(): void {
  log.info('Handling user logout')
  store.delete('user')
  store.set('lastResetDate', dayjs().toISOString())
  user = null
  stopActivityMonitoring()
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png')
  new Notification({
    title: 'Deep Focus',
    body: 'You have been logged out',
    icon: iconPath
  }).show()
}

app.on('before-quit', () => {
  isQuitting = true
  stopWebSocketServer()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Getters
export function getDeepWorkHours(): DeepWorkHours {
  calculateDeepWorkHours(getSiteTrackers(), deepWorkHours, store)
  return deepWorkHours
}
export function getSiteTrackers(): SiteTimeTracker[] {
  return currentSiteTimeTrackers
}

scheduleJob('0 0 0 * * *', async () => {
  log.info('Scheduled daily reset at midnight')
  stopActivityMonitoring()
  await checkAndSendMissedEmails()
  await resetCounters('daily')

  // Check if today is Sunday and perform weekly reset if true
  if (dayjs().day() === 0) {
    log.info('Performing weekly reset on Sunday')
    await resetCounters('weekly')
  }
  startActivityMonitoring()
})

scheduleJob('0 0 12 * * *', () => {
  log.info('Scheduled daily reset at 12 PM')
  stopActivityMonitoring()
  checkAndSendMissedEmails()
  startActivityMonitoring()
  log.info('new reset date is ', store.get('lastResetDate'))
})

// TODO: For testing only
// scheduleJob('* * * * *', () => {
//   log.info('TESTING')
//   stopActivityMonitoring()
//   sendDailyEmail()
//   stopActivityMonitoring()
// })

// Log unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error)
})

function setupIPCListeners() {
  ipcMain.setMaxListeners(20)
  ipcMain.on('login-user', (_event, user: User) => {
    user = handleUserData(user, store)
    if (user && mainWindow) {
      console.log('setting up listeners & monitoring')
      startActivityMonitoring()
      loadUserData()
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
    console.log('Unproductive URLs updated:', urls)
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
    console.log('Unproductive URLs updated:', urls)
    event.reply('unproductive-urls-response', urls) // Send updated URLs back
  })

  ipcMain.handle('get-icon', async (_event, iconPath) => {
    try {
      const image = nativeImage.createFromPath(iconPath)

      if (image.isEmpty()) {
        console.warn(`Icon at path "${iconPath}" could not be loaded.`)
        return null // Indicate that the icon could not be loaded
      }

      return image.toDataURL()
    } catch (error) {
      console.error(`Failed to load icon from path "${iconPath}":`, error)
      return null // Handle error by returning a default fallback
    }
  })

  // Fetch the user's site time trackers
  ipcMain.on('fetch-site-trackers', async (event) => {
    log.info('Received event for fetch-site-trackers')

    const trackers = store.get('siteTimeTrackers', [])
    const apps: AppIcon[] = await getApplicationIcons()

    const formattedTrackers = trackers.map((tracker) => {
      let iconUrl = ''

      // Determine if the tracker is a website or an app
      if (isValidURL(tracker.url)) {
        // If it's a valid URL (website), use the Google favicon service
        iconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${tracker.url}`
      } else {
        // If it's not a valid URL (assume it's an app), find its icon from the list of installed apps
        const matchingApp = apps.find((app) => app.appName === tracker.title)
        iconUrl = matchingApp ? matchingApp.iconPath : ''
      }
      return {
        ...tracker,
        iconUrl
      }
    })

    // Sort the trackers by time spent (descending) and limit to top 5
    const sortedTrackers = formattedTrackers
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .filter((tracker) => tracker.timeSpent > 60)
      .slice(0, 5)

    event.reply('site-trackers-response', sortedTrackers)
  })

  // Fetch the user's deep work target daily
  ipcMain.on('fetch-deep-work-target', (event) => {
    const deepWorkTarget = store.get('deepWorkTarget', 8) as number
    event.reply('deep-work-target-response', deepWorkTarget)
  })
  // Update the user's deep work target daily
  ipcMain.on('update-deep-work-target', (_event, newTarget: number) => {
    store.set('deepWorkTarget', newTarget)
    // updateAppMenu()
    console.log(`Updated Deep Work Target: ${newTarget}`)
  })
  // Fetch the user's current deep work hours daily
  ipcMain.on('fetch-deep-work-data', (event) => {
    log.info('Received event for fetch-deep-work-data')
    stopActivityMonitoring()
    handleDailyReset()
    startActivityMonitoring()
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
  // TODO: Logic can be improved to get more icons
  ipcMain.on('fetch-app-icons', async (event) => {
    try {
      log.info('Received event for fetch-deep-work-data')

      const apps = await getApplicationIcons()
      // console.log('Apps are ', apps)
      event.reply('app-icons-response', apps)
    } catch (error) {
      console.error('Error fetching app icons:', error)
      event.reply('app-icons-response', [])
    }
  })
}

export async function handleDailyReset() {
  const now = dayjs()

  log.info('lastResetDate is ', store.get('lastResetDate'))
  const lastResetDate = dayjs(store.get('lastResetDate', now.subtract(1, 'day').toISOString()))
  await checkAndSendMissedEmails()
  // Perform daily reset if the last reset was not today
  if (!lastResetDate.isSame(now, 'day')) {
    log.info('Performing daily reset. Previous reset date:', lastResetDate.format('YYYY-MM-DD'))
    await resetCounters('daily')
    log.info(`Daily reset performed. New reset date stored: ${now.format('YYYY-MM-DD')}`)
    // Check if we need to do a full weekly reset (if last reset was more than a week ago)
    if (now.diff(lastResetDate, 'week') >= 1) {
      log.info('Performing full weekly reset for the previous week.')
      await resetCounters('weekly')
      log.info(`Weekly reset performed. New reset date stored: ${now.format('YYYY-MM-DD')}`)
    } else if (now.day() === 0) {
      // Perform weekly reset if today is Sunday and it's a new week
      await resetCounters('weekly')
      log.info(`Weekly reset performed. New reset date stored: ${now.format('YYYY-MM-DD')}`)
    }
  }
}

async function persistDailyData(
  dailyData: any,
  deepWorkHours: any,
  today: keyof any,
  username: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activity/persist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dailyData,
        deepWorkHours,
        today,
        username
      })
    })

    if (response.ok) {
      console.log('Daily data persisted successfully')
      return true
    } else {
      console.error('Failed to persist daily data:', response.status, response.statusText)
      return false
    }
  } catch (error) {
    console.error('Error persisting daily data:', error)
    return false
  }
}
function startPersistenceInterval(): void {
  if (!persistenceInterval && !isSystemSuspended) {
    persistenceInterval = setInterval(
      async () => {
        const today = dayjs().format('dddd') as keyof DeepWorkHours // "Wednesday"
        const username = user.username
        const deepWorkHours = getDeepWorkHours()
        const MIN_TIME_THRESHOLD = 10

        const filteredTrackers = currentSiteTimeTrackers.filter(
          (tracker) => tracker.timeSpent >= MIN_TIME_THRESHOLD
        )

        const workToday = deepWorkHours[today as keyof DeepWorkHours] as number
        log.info('workToday:', workToday)

        // Create an array of activity objects
        const dailyData = filteredTrackers.map((tracker: SiteTimeTracker) => ({
          username: user.username,
          date: today,
          url: tracker.url ? tracker.url.slice(0, 200) : 'unknown', // Fallback for undefined url
          title: tracker.title ? tracker.title.slice(0, 100) : 'Untitled',
          timeSpent: tracker.timeSpent
        }))

        await persistDailyData(dailyData, deepWorkHours, today, username)
      },
      15 * 60 * 1000
    )
    console.log('Persistence interval started.')
  }
}

function stopPersistenceInterval(): void {
  if (persistenceInterval) {
    clearInterval(persistenceInterval)
    persistenceInterval = null
    console.log('Persistence interval stopped.')
  }
}

async function sendDailyEmail(): Promise<boolean> {
  const now = dayjs()
  log.info('currentSiteTimeTrackers:', currentSiteTimeTrackers)

  const MIN_TIME_THRESHOLD = 10
  const filteredTrackers = currentSiteTimeTrackers.filter(
    (tracker) => tracker.timeSpent >= MIN_TIME_THRESHOLD
  )
  const today = now.format('dddd') // needs to be number to access deepWorkHours
  const deepWorkHours = getDeepWorkHours()
  const workToday = deepWorkHours[today as keyof DeepWorkHours] as number
  log.info('workToday:', workToday)
  const lastResetDate = now.toISOString()
  store?.set('lastResetDate', lastResetDate)

  const dailyData = {
    username: user.username,
    date: today,
    workToday,
    trackers: filteredTrackers.map((tracker: SiteTimeTracker) => ({
      title: tracker.title.slice(0, 100), // Truncate long titles
      url: tracker.url.slice(0, 200), // Truncate long URLs
      timeSpent: tracker.timeSpent,
      iconUrl: tracker.iconUrl
    }))
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activity/send-daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dailyData
      })
    })
    console.log('Email sent status:', response.status)
    if (response.status === 200) {
      return true // Indicate success
    } else {
      return false // Indicate failure
    }
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

async function checkAndSendMissedEmails(): Promise<void> {
  try {
    const lastEmailDate = dayjs(store.get('lastEmailDate', null) || dayjs().subtract(1, 'day'))
    const today = dayjs().startOf('day')
    log.info('checking and sending missed emails')
    log.info(
      'lastEmailDate',
      lastEmailDate.format('YYYY-MM-DD'),
      'today',
      today.format('YYYY-MM-DD')
    )
    new Notification({
      title: 'Deep Focus',
      body: 'Checking for missed emails...'
    }).show()
    if (!lastEmailDate.isSame(today, 'day')) {
      let dateToProcess = lastEmailDate.add(1, 'day')

      while (dateToProcess.isBefore(today) || dateToProcess.isSame(today, 'day')) {
        const formattedDate = dateToProcess.format('YYYY-MM-DD')
        log.info(`Sending missed email for date: ${formattedDate}`)
        const sendEmailResponse = await sendDailyEmail()
        if (sendEmailResponse) {
          // Update the last email date after each successful send
          store.set('lastEmailDate', dateToProcess.toISOString())
          dateToProcess = dateToProcess.add(1, 'day')
        } else {
          log.info('Missed email not sent. Retrying in 10 minutes.')
          new Notification({
            title: 'Deep Focus',
            body: 'Missed email not sent. Retrying in 10 minutes.'
          }).show()
        }
      }
    }
  } catch (error) {
    console.error('Error checking and sending missed emails:', error)
  }
}
