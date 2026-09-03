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
import http from 'http'
import { scheduleJob } from 'node-schedule'
import dotenv from 'dotenv'
// Import electron-store - handle both ESM and CommonJS when externalized
// When externalized, electron-store is required as CommonJS which returns { default: Store }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import StoreModule from 'electron-store'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StoreModuleAny = StoreModule as any
const Store = StoreModuleAny?.default != null ? StoreModuleAny.default : StoreModuleAny
import {
  StoreSchema,
  SiteTimeTracker,
  DeepWorkHours,
  DeepWorkHoursWithDates,
  User,
  AppIcon,
  QueuedActivityData,
  FocusModeStats,
  ManualTimeEntry
} from './types'
import {
  updateSiteTimeTracker,
  getBrowserURL,
  getActiveWindowApp,
  getBaseURL,
  isDeepWork,
  calculateDeepWorkHours,
  isBrowser,
  isValidURL,
  closeBrowserTab,
  quitApplication
} from './productivityUtils'
import { getApplicationIcons } from './childProcess'
import { checkForUpdates, getIconPath, updateIconBasedOnProgress } from './utils'
import log from 'electron-log/main'
// Import Store type from electron-store for TypeScript
import type StoreType from 'electron-store'
export interface TypedStore extends StoreType<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K]
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: string, value: any): void
  delete<K extends keyof StoreSchema>(key: K): void
  clear(): void
}
const API_BASE_URL = 'https://backend-production-5eec.up.railway.app'
// For running locally/testing: const API_BASE_URL = 'http://localhost:3003'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new (Store as any)() as TypedStore
let currentSiteTimeTrackers: SiteTimeTracker[] = store.get('siteTimeTrackers', [])
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
let user: User | null = store.get('user', null) // change back to null
let iconPath = ''
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let persistenceInterval: NodeJS.Timeout | null = null
let isSystemSuspended = false
let retryQueueInterval: NodeJS.Timeout | null = null
let browserBridgeServer: http.Server | null = null
const MAX_RETRY_ATTEMPTS = 5
const INITIAL_RETRY_DELAY = 60000 // 1 minute
const MAX_RETRY_DELAY = 600000 // 10 minutes
const PERSISTENCE_INTERVAL = 5 * 60 * 1000 // 5 minutes
const BROWSER_BRIDGE_HOST = '127.0.0.1'
const BROWSER_BRIDGE_PORT = 17321
// Track recently blocked items to avoid rapid-fire blocking
const recentlyBlocked = new Map<string, number>()
const BLOCK_COOLDOWN = 10000 // 10 seconds cooldown before blocking the same item again
const BROWSER_BRIDGE_URL_CACHE_MS = 10 * 60 * 1000
type BrowserBridgeURLEntry = { URL: string; appName: string; timestamp: number }
const browserBridgeActiveURLs = new Map<string, BrowserBridgeURLEntry>()
let latestBrowserBridgeURL: BrowserBridgeURLEntry | null = null
log.transports.file.level = 'debug'
log.transports.file.maxSize = 10 * 1024 * 1024
if (app.isPackaged && log.transports.console) {
  log.transports.console.level = false
}
for (const stream of [process.stdout, process.stderr]) {
  stream?.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') {
      log.error('Process stdio stream error:', error)
    }
  })
}

log.info('Log from the main process')
const resourcesPath: string = setupEnvironment()
log.info('Set up Environment')

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

function incrementFocusModeStats(type: 'website' | 'app'): void {
  const currentStats = store.get('focusModeStats', {
    websitesBlocked: 0,
    appsBlocked: 0,
    totalBlocked: 0
  }) as FocusModeStats

  const updatedStats: FocusModeStats = {
    websitesBlocked: type === 'website' ? currentStats.websitesBlocked + 1 : currentStats.websitesBlocked,
    appsBlocked: type === 'app' ? currentStats.appsBlocked + 1 : currentStats.appsBlocked,
    totalBlocked: currentStats.totalBlocked + 1
  }

  store.set('focusModeStats', updatedStats)
  log.info(`Focus mode stats updated: ${JSON.stringify(updatedStats)}`)
}

type BrowserEventPayload = {
  url?: string
  title?: string
  browser?: string
  tabId?: number
  incognito?: boolean
  timestamp?: number
}

function sendBrowserBridgeJSON(
  response: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
): void {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  })
  response.end(JSON.stringify(payload))
}

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk.toString()
      if (body.length > 64 * 1024) {
        reject(new Error('Browser bridge payload too large'))
        request.destroy()
      }
    })

    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function normalizeExtensionBrowserName(browserName?: string, userAgent?: string): string {
  const source = `${browserName || ''} ${userAgent || ''}`.toLowerCase()

  if (source.includes('edg/') || source.includes('edge')) return 'Microsoft Edge'
  if (source.includes('brave')) return 'Brave Browser'
  if (source.includes('firefox')) return 'Firefox'
  if (source.includes('chrome')) return 'Google Chrome'

  return browserName || 'Browser'
}

function getBrowserBridgeCacheKeys(appName: string, payload?: BrowserEventPayload, userAgent?: string): string[] {
  const source = `${appName} ${payload?.browser || ''} ${payload?.title || ''} ${userAgent || ''}`.toLowerCase()
  const keys = new Set<string>()

  if (appName) keys.add(appName)
  if (payload?.browser) keys.add(payload.browser)

  if (source.includes('firefox')) keys.add('Firefox')
  if (source.includes('edg/') || source.includes('edge')) keys.add('Microsoft Edge')
  if (source.includes('chrome')) keys.add('Google Chrome')
  if (source.includes('brave')) keys.add('Brave Browser')

  return Array.from(keys).filter(Boolean)
}

function clearBrowserBridgeURLCache(keys: string[]): void {
  for (const key of keys) {
    browserBridgeActiveURLs.delete(key)
  }

  if (latestBrowserBridgeURL && keys.includes(latestBrowserBridgeURL.appName)) {
    latestBrowserBridgeURL = null
  }
}

function setBrowserBridgeURLCache(keys: string[], entry: BrowserBridgeURLEntry): void {
  for (const key of keys) {
    browserBridgeActiveURLs.set(key, entry)
  }
  latestBrowserBridgeURL = entry
}

function getBrowserBridgeURL(appName: string): string {
  const now = Date.now()
  const cached = browserBridgeActiveURLs.get(appName)

  if (cached && now - cached.timestamp <= BROWSER_BRIDGE_URL_CACHE_MS) {
    return cached.URL
  }

  if (cached) {
    browserBridgeActiveURLs.delete(appName)
  }

  if (
    latestBrowserBridgeURL &&
    now - latestBrowserBridgeURL.timestamp <= BROWSER_BRIDGE_URL_CACHE_MS &&
    (latestBrowserBridgeURL.appName === appName || appName === 'Browser' || latestBrowserBridgeURL.appName === 'Browser')
  ) {
    return latestBrowserBridgeURL.URL
  }

  return ''
}

function handleExtensionBrowserEvent(payload: BrowserEventPayload, userAgent?: string): {
  action: 'allow' | 'block'
  reason?: string
} {
  const appName = normalizeExtensionBrowserName(payload.browser, userAgent)
  const cacheKeys = getBrowserBridgeCacheKeys(appName, payload, userAgent)

  if (payload.incognito) {
    clearBrowserBridgeURLCache(cacheKeys)
    return { action: 'allow' }
  }

  if (!payload.url) {
    return { action: 'allow' }
  }

  const URL = getBaseURL(payload.url)
  if (!URL) {
    clearBrowserBridgeURLCache(cacheKeys)
    return { action: 'allow' }
  }

  setBrowserBridgeURLCache(cacheKeys, { URL, appName, timestamp: Date.now() })
  log.info(`Browser bridge URL resolved for ${appName}: ${URL}`)
  updateSiteTimeTracker(appName, currentSiteTimeTrackers, URL)
  const isProductive = isDeepWork({ type: 'URL', value: URL }, store)

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('active-window-info', { appName, URL, isProductive })
  }

  if (store.get('focusMode', false) && !isProductive) {
    const blockKey = `extension:${URL}`
    const now = Date.now()
    const lastBlocked = recentlyBlocked.get(blockKey) || 0

    if (now - lastBlocked >= BLOCK_COOLDOWN) {
      recentlyBlocked.set(blockKey, now)
      incrementFocusModeStats('website')

      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(__dirname, '../../resources/icon.png')
      new Notification({
        title: 'Deep Focus - Focus Mode',
        body: `Blocked unproductive website: ${URL}`,
        icon: iconPath
      }).show()
    }

    return { action: 'block', reason: 'unproductive' }
  }

  return { action: 'allow' }
}

function startBrowserBridge(): void {
  if (browserBridgeServer) {
    return
  }

  browserBridgeServer = http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      sendBrowserBridgeJSON(response, 204, {})
      return
    }

    if (request.method !== 'POST' || request.url !== '/browser-event') {
      sendBrowserBridgeJSON(response, 404, { error: 'Not found' })
      return
    }

    try {
      const body = await readRequestBody(request)
      const payload = JSON.parse(body) as BrowserEventPayload
      const result = handleExtensionBrowserEvent(payload, request.headers['user-agent'])
      sendBrowserBridgeJSON(response, 200, result)
    } catch (error) {
      log.warn('Browser bridge event failed:', error)
      sendBrowserBridgeJSON(response, 400, { action: 'allow', error: 'Invalid browser event' })
    }
  })

  browserBridgeServer.on('error', (error) => {
    log.warn('Browser bridge server error:', error)
    browserBridgeServer = null
  })

  browserBridgeServer.listen(BROWSER_BRIDGE_PORT, BROWSER_BRIDGE_HOST, () => {
    log.info(`Browser bridge listening on http://${BROWSER_BRIDGE_HOST}:${BROWSER_BRIDGE_PORT}`)
  })
}

function stopBrowserBridge(): void {
  if (!browserBridgeServer) {
    return
  }

  browserBridgeServer.close(() => {
    log.info('Browser bridge stopped.')
  })
  browserBridgeServer = null
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

    // Also reset today's date-stamped data
    const deepWorkHoursWithDates = store.get('deepWorkHoursWithDates', {}) as DeepWorkHoursWithDates
    const todayDate = now.format('YYYY-MM-DD')
    deepWorkHoursWithDates[today as keyof DeepWorkHoursWithDates] = {
      hours: 0,
      date: todayDate
    }
    store.set('deepWorkHoursWithDates', deepWorkHoursWithDates)
    
    // Reset focus mode stats daily
    store.set('focusModeStats', {
      websitesBlocked: 0,
      appsBlocked: 0,
      totalBlocked: 0
    })
    
    store.set('deepWorkHours', deepWorkHours)
    store.set('siteTimeTrackers', currentSiteTimeTrackers)
    log.info('currentSiteTimeTrackersl', currentSiteTimeTrackers, 'deepWorkHours', deepWorkHours)
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
    store.set('deepWorkHoursWithDates', {})
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
          const browserURL = await getBrowserURL(appName)
          if (browserURL && browserURL.trim()) {
            URL = getBaseURL(browserURL)
          } else {
            URL = getBrowserBridgeURL(appName)
          }
        }

        updateSiteTimeTracker(appName, currentSiteTimeTrackers, URL)
        // Send the active window info and URL to the renderer process
        if (mainWindow) {
          const isProductive = URL.length
            ? isDeepWork({ type: 'URL', value: URL }, store)
            : isDeepWork({ type: 'appName', value: appName }, store)

          mainWindow.webContents.send('active-window-info', { appName, URL, isProductive })

          // Check focus mode and take action if unproductive
          const focusMode = store.get('focusMode', false) as boolean
          if (!isProductive) {
            const blockKey = URL.length > 0 ? URL : appName
            const now = Date.now()
            const lastBlocked = recentlyBlocked.get(blockKey) || 0

            // Skip if we blocked this item recently (within cooldown period)
            if (now - lastBlocked >= BLOCK_COOLDOWN) {
              if (focusMode) {
                // Focus mode ON: Block unproductive apps/websites
                if (URL.length > 0 && isBrowser(appName)) {
                  // Close the browser tab
                  log.info(`Focus mode: Closing unproductive website tab: ${URL} in ${appName}`)
                  const closed = await closeBrowserTab(appName)

                  if (closed) {
                    recentlyBlocked.set(blockKey, now)
                    incrementFocusModeStats('website')
                    
                    // Show notification
                    const iconPath = app.isPackaged
                      ? path.join(process.resourcesPath, 'icon.png')
                      : path.join(__dirname, '../../resources/icon.png')
                    new Notification({
                      title: 'Deep Focus - Focus Mode',
                      body: `Blocked unproductive website: ${URL}`,
                      icon: iconPath
                    }).show()
                  }
                } else {
                  // Quit the unproductive app
                  log.info(`Focus mode: Quitting unproductive app: ${appName}`)
                  const quit = await quitApplication(appName)

                  if (quit) {
                    recentlyBlocked.set(blockKey, now)
                    incrementFocusModeStats('app')
                    
                    // Show notification
                    const iconPath = app.isPackaged
                      ? path.join(process.resourcesPath, 'icon.png')
                      : path.join(__dirname, '../../resources/icon.png')
                    new Notification({
                      title: 'Deep Focus - Focus Mode',
                      body: `Blocked unproductive app: ${appName}`,
                      icon: iconPath
                    }).show()
                  }
                }
              } else {
                // Focus mode OFF: Send notification only (cooldown already checked above)
                recentlyBlocked.set(blockKey, now)

                const iconPath = app.isPackaged
                  ? path.join(process.resourcesPath, 'icon.png')
                  : path.join(__dirname, '../../resources/icon.png')
                const notificationBody =
                  URL.length > 0
                    ? `You're on an unproductive website: ${URL}`
                    : `You're using an unproductive app: ${appName}`

                new Notification({
                  title: 'Deep Focus - Unproductive Activity',
                  body: notificationBody,
                  icon: iconPath
                }).show()
              }
            }
          }
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
  if (process.platform === 'darwin') {
    app.dock.setIcon(getIconPath('icon.png', resourcesPath))
  }

  mainWindow.on('ready-to-show', async () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // and load the index.html of the app.
  const rendererDevServerUrl =
    typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' ? MAIN_WINDOW_VITE_DEV_SERVER_URL : ''
  const rendererWindowName =
    typeof MAIN_WINDOW_VITE_NAME !== 'undefined' ? MAIN_WINDOW_VITE_NAME : 'main_window'

  if (rendererDevServerUrl) {
    mainWindow.loadURL(rendererDevServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${rendererWindowName}/index.html`))
  }

  mainWindow.on('closed', async () => {
    log.info('Main Window closed')
    await storeData()
    store.set('lastResetDate', dayjs().toISOString())
    log.info('Last reset date is ', store.get('lastResetDate'))

    // Final sync attempt before closing
    if (user && user.username) {
      const today = dayjs().format('YYYY-MM-DD')
      const MIN_TIME_THRESHOLD = 10
      const filteredTrackers = currentSiteTimeTrackers.filter(
        (tracker) => tracker.timeSpent >= MIN_TIME_THRESHOLD
      )

      if (filteredTrackers.length > 0) {
        const dailyData = filteredTrackers.map((tracker: SiteTimeTracker) => ({
          url: tracker.url ? tracker.url.slice(0, 200) : 'unknown',
          title: tracker.title ? tracker.title.slice(0, 100) : 'Untitled',
          timeSpent: tracker.timeSpent,
          date: today
        }))

        await persistDailyData(dailyData, user.username)
        await processOfflineQueue()
      }
    }

    app.quit()
    if (process.platform === 'darwin') {
      app.dock.hide()
    }
  })

  return mainWindow
}

app.whenReady().then(async () => {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'trayIcon.png')
    : path.join(__dirname, '../../resources/trayIcon.png')
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

  function createTrayMenu(): void {
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
        click: (): void => {
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
  startBrowserBridge()
  startPersistenceInterval()
  startRetryQueueProcessor()

  // Process offline queue on app start if user is logged in
  if (user && user.username) {
    processOfflineQueue().catch((error) => {
      log.error('Error processing offline queue on app start:', error)
    })
  }

  powerMonitor.on('suspend', () => {
    isSystemSuspended = true
    stopPersistenceInterval()
    stopRetryQueueProcessor()
    log.info('System suspended.')
  })

  powerMonitor.on('resume', () => {
    isSystemSuspended = false
    startPersistenceInterval()
    startRetryQueueProcessor()

    // Process offline queue when system resumes
    if (user && user.username) {
      processOfflineQueue().catch((error) => {
        log.error('Error processing offline queue on resume:', error)
      })
    }

    log.info('System resumed.')
  })
})

// Function to get chart data in Monday -> Sunday order
// Always shows the current week (Monday through Sunday) with data from the most recent week
function getChartDataInOrder(store: TypedStore): { data: number[]; labels: string[] } {
  const now = dayjs()
  const today = now.day() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const deepWorkHoursWithDates = store.get('deepWorkHoursWithDates', {}) as DeepWorkHoursWithDates
  const deepWorkHours = getDeepWorkHours()

  // Find the most recent Monday (start of the current week)
  // If today is Sunday, go back 6 days to get Monday
  // Otherwise, go back (today - 1) days to get Monday
  let mondayDate = now
  if (today === 0) {
    // Today is Sunday, go back 6 days to get Monday
    mondayDate = now.subtract(6, 'day')
  } else {
    // Go back to Monday
    mondayDate = now.subtract(today - 1, 'day')
  }

  // Day names in Monday -> Sunday order
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const dayAbbrevs = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const data: number[] = []
  const labels: string[] = []

  // Get manual time entries
  const manualTimeEntries = store.get('manualTimeEntries', []) as ManualTimeEntry[]

  // Build array from Monday to Sunday
  for (let i = 0; i < 7; i++) {
    const currentDate = mondayDate.add(i, 'day')
    const dayName = dayNames[i] as keyof DeepWorkHoursWithDates
    const dateStr = currentDate.format('YYYY-MM-DD')

    // Calculate manual hours for this date
    const manualHoursForDate = manualTimeEntries
      .filter((entry) => entry.date === dateStr)
      .reduce((sum, entry) => sum + entry.hours, 0)

    // Check if we have data with dates for this day
    const dayData = deepWorkHoursWithDates[dayName]

    let totalHours = 0
    if (dayData && dayData.date === dateStr) {
      // Use the data with matching date
      // For past dates, this might not include manual hours, so we add them
      // For today, calculateDeepWorkHours already includes manual hours in the stored data
      if (currentDate.isSame(now, 'day')) {
        // Today: stored data already includes manual hours from calculateDeepWorkHours
        totalHours = dayData.hours
      } else {
        // Past date: stored data is automatic only, add manual hours
        totalHours = dayData.hours + manualHoursForDate
      }
    } else if (currentDate.isSame(now, 'day')) {
      // For today, use current deepWorkHours (which includes manual hours from calculateDeepWorkHours)
      totalHours = deepWorkHours[dayName as keyof DeepWorkHours] || 0
    } else if (currentDate.isBefore(now, 'day')) {
      // For past days in the current week, try to use stored data or fallback to 0
      const baseHours = dayData ? dayData.hours : (deepWorkHours[dayName as keyof DeepWorkHours] || 0)
      // Add manual hours for past dates
      totalHours = baseHours + manualHoursForDate
    } else {
      // Future days should be 0
      totalHours = 0
    }
    
    data.push(Number(totalHours.toFixed(2)))

    labels.push(dayAbbrevs[i])
  }

  return { data, labels }
}

app.on('browser-window-focus', () => {
  log.info('App window focused.')
  const { data, labels } = getChartDataInOrder(store)

  // Send the chartData to the renderer process
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('deep-work-data-response', { data, labels })
  }
})
export function handleUserLogout(): void {
  log.info('Handling user logout')
  store.delete('user')
  store.set('lastResetDate', dayjs().toISOString())
  user = null
  stopActivityMonitoring()
  stopPersistenceInterval()
  stopRetryQueueProcessor()
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png')
  new Notification({
    title: 'Deep Focus',
    body: 'You have been logged out',
    icon: iconPath
  }).show()
}

app.on('will-quit', () => {
  stopBrowserBridge()
  ipcMain.removeAllListeners()
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
  // Email sending is now handled automatically by the backend at 5:00 AM
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
  // Email sending is now handled automatically by the backend at 5:00 AM
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

function setupIPCListeners(): void {
  ipcMain.setMaxListeners(20)
  ipcMain.on('login-user', (_event, userData: User) => {
    user = handleUserData(userData, store)
    if (user && mainWindow) {
      console.log('setting up listeners & monitoring')
      startActivityMonitoring()
      startPersistenceInterval()
      startRetryQueueProcessor()
      loadUserData()

      // Process any queued data when user logs in
      processOfflineQueue().catch((error) => {
        log.error('Error processing offline queue on login:', error)
      })
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

    const { data, labels } = getChartDataInOrder(store)

    // Send both data and labels to the renderer
    event.reply('deep-work-data-response', { data, labels })
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

  // Fetch focus mode state
  ipcMain.on('fetch-focus-mode', (event) => {
    const focusMode = store.get('focusMode', false) as boolean
    event.reply('focus-mode-response', focusMode)
  })

  // Toggle focus mode
  ipcMain.on('toggle-focus-mode', (_event, enabled: boolean) => {
    store.set('focusMode', enabled)
    log.info(`Focus mode ${enabled ? 'enabled' : 'disabled'}`)

    // Send notification when focus mode is enabled
    if (enabled) {
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(__dirname, '../../resources/icon.png')
      new Notification({
        title: 'Deep Focus',
        body: 'Focus mode enabled. Unproductive apps and websites will be blocked.',
        icon: iconPath
      }).show()
    }
  })

  // Fetch focus mode stats
  ipcMain.on('fetch-focus-mode-stats', (event) => {
    const stats = store.get('focusModeStats', {
      websitesBlocked: 0,
      appsBlocked: 0,
      totalBlocked: 0
    }) as FocusModeStats
    event.reply('focus-mode-stats-response', stats)
  })

  // Add manual time entry
  ipcMain.on('add-manual-time-entry', (_event, entry: Omit<ManualTimeEntry, 'id' | 'createdAt'>) => {
    try {
      // Validate input
      if (!entry.taskName || entry.taskName.trim() === '') {
        log.error('Invalid manual time entry: task name is required')
        return
      }
      if (entry.hours <= 0 || entry.hours > 24) {
        log.error('Invalid manual time entry: hours must be between 0 and 24')
        return
      }
      if (!dayjs(entry.date).isValid()) {
        log.error('Invalid manual time entry: date is invalid')
        return
      }

      // Create entry with ID and timestamp
      const newEntry: ManualTimeEntry = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        taskName: entry.taskName.trim(),
        hours: Number(entry.hours.toFixed(2)),
        date: entry.date,
        createdAt: Date.now()
      }

      // Get existing entries and add new one
      const manualTimeEntries = store.get('manualTimeEntries', []) as ManualTimeEntry[]
      manualTimeEntries.push(newEntry)
      store.set('manualTimeEntries', manualTimeEntries)

      log.info(`Added manual time entry: ${newEntry.taskName} - ${newEntry.hours} hours on ${newEntry.date}`)

      // Recalculate deep work hours for the entry's date
      const entryDate = dayjs(entry.date)
      const entryDayName = entryDate.format('dddd') as keyof DeepWorkHours
      
      // Recalculate today if the entry is for today, otherwise update the specific day
      if (entryDate.isSame(dayjs(), 'day')) {
        calculateDeepWorkHours(currentSiteTimeTrackers, deepWorkHours, store)
      } else {
        // For past dates, we need to recalculate that day's total
        // The stored data in deepWorkHoursWithDates might already include manual hours
        // So we need to get all manual entries for that date and recalculate
        const deepWorkHoursWithDates = store.get('deepWorkHoursWithDates', {}) as DeepWorkHoursWithDates
        const dayData = deepWorkHoursWithDates[entryDayName]
        
        // Get all manual hours for this date (including the new one)
        const manualHoursForDate = manualTimeEntries
          .filter((e) => e.date === entry.date)
          .reduce((sum, e) => sum + e.hours, 0)
        
        // For past dates, we assume the stored hours are automatic only
        // If dayData exists and matches the date, use it as base, otherwise 0
        const baseHours = (dayData && dayData.date === entry.date) ? dayData.hours : 0
        
        // For past dates, we can't recalculate automatic hours, so we'll store
        // the sum of stored hours + all manual hours
        // Note: This assumes stored hours don't already include manual hours
        // If they do, we'd need to track automatic vs manual separately (future improvement)
        const totalHours = Number((baseHours + manualHoursForDate).toFixed(2))
        
        deepWorkHoursWithDates[entryDayName] = {
          hours: totalHours,
          date: entry.date
        }
        deepWorkHours[entryDayName] = totalHours
        store.set('deepWorkHoursWithDates', deepWorkHoursWithDates)
        store.set('deepWorkHours', deepWorkHours)
      }

      // Trigger UI refresh
      if (mainWindow && mainWindow.webContents) {
        const { data, labels } = getChartDataInOrder(store)
        mainWindow.webContents.send('deep-work-data-response', { data, labels })
        // Also send updated manual entries for today if this entry is for today
        if (dayjs(entry.date).isSame(dayjs(), 'day')) {
          const todayEntries = manualTimeEntries.filter((e) => e.date === entry.date)
          mainWindow.webContents.send('manual-time-entries-response', todayEntries)
        }
      }
    } catch (error) {
      log.error('Error adding manual time entry:', error)
    }
  })

  // Fetch manual time entries
  ipcMain.on('fetch-manual-time-entries', (event, dateFilter?: string) => {
    try {
      const manualTimeEntries = store.get('manualTimeEntries', []) as ManualTimeEntry[]
      let filteredEntries = manualTimeEntries

      // Filter by date if provided
      if (dateFilter) {
        filteredEntries = manualTimeEntries.filter((entry) => entry.date === dateFilter)
      }

      // Sort by date (newest first) and then by creation time
      filteredEntries.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date)
        if (dateCompare !== 0) return dateCompare
        return b.createdAt - a.createdAt
      })

      event.reply('manual-time-entries-response', filteredEntries)
    } catch (error) {
      log.error('Error fetching manual time entries:', error)
      event.reply('manual-time-entries-response', [])
    }
  })

  // Delete manual time entry
  ipcMain.on('delete-manual-time-entry', (_event, entryId: string) => {
    try {
      const manualTimeEntries = store.get('manualTimeEntries', []) as ManualTimeEntry[]
      const entryToDelete = manualTimeEntries.find((e) => e.id === entryId)
      
      if (!entryToDelete) {
        log.warn(`Manual time entry not found: ${entryId}`)
        return
      }

      // Remove the entry
      const updatedEntries = manualTimeEntries.filter((e) => e.id !== entryId)
      store.set('manualTimeEntries', updatedEntries)

      log.info(`Deleted manual time entry: ${entryId}`)

      // Recalculate deep work hours for the entry's date
      const entryDate = dayjs(entryToDelete.date)
      const entryDayName = entryDate.format('dddd') as keyof DeepWorkHours
      
      if (entryDate.isSame(dayjs(), 'day')) {
        // Recalculate today
        calculateDeepWorkHours(currentSiteTimeTrackers, deepWorkHours, store)
      } else {
        // For past dates, recalculate that day's total
        const deepWorkHoursWithDates = store.get('deepWorkHoursWithDates', {}) as DeepWorkHoursWithDates
        const dayData = deepWorkHoursWithDates[entryDayName]
        
        // Get all remaining manual hours for this date
        const manualHoursForDate = updatedEntries
          .filter((e) => e.date === entryToDelete.date)
          .reduce((sum, e) => sum + e.hours, 0)
        
        // For past dates, assume stored hours are automatic only
        const baseHours = (dayData && dayData.date === entryToDelete.date) ? dayData.hours : 0
        const totalHours = Number((baseHours + manualHoursForDate).toFixed(2))
        
        deepWorkHoursWithDates[entryDayName] = {
          hours: totalHours,
          date: entryToDelete.date
        }
        deepWorkHours[entryDayName] = totalHours
        store.set('deepWorkHoursWithDates', deepWorkHoursWithDates)
        store.set('deepWorkHours', deepWorkHours)
      }

      // Trigger UI refresh
      if (mainWindow && mainWindow.webContents) {
        const { data, labels } = getChartDataInOrder(store)
        mainWindow.webContents.send('deep-work-data-response', { data, labels })
        // Also send updated manual entries for today if this entry was for today
        if (dayjs(entryToDelete.date).isSame(dayjs(), 'day')) {
          const todayEntries = updatedEntries.filter((e) => e.date === entryToDelete.date)
          mainWindow.webContents.send('manual-time-entries-response', todayEntries)
        }
      }
    } catch (error) {
      log.error('Error deleting manual time entry:', error)
    }
  })
}

export async function handleDailyReset(): Promise<void> {
  const now = dayjs()

  log.info('lastResetDate is ', store.get('lastResetDate'))
  const lastResetDate = dayjs(store.get('lastResetDate', now.subtract(1, 'day').toISOString()))
  // Email sending is now handled automatically by the backend at 5:00 AM
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

/**
 * Check if the device is online by attempting to fetch from the API
 */
async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    // Try to fetch the base URL or use a simple HEAD request
    await fetch(`${API_BASE_URL}`, {
      method: 'HEAD',
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return true // If we get any response, we're online
  } catch (error) {
    return false
  }
}

/**
 * Add data to the offline queue for later retry
 */
function addToOfflineQueue(
  dailyData: Array<{ url: string; title: string; timeSpent: number; date: string }>,
  username: string
): void {
  const queue: QueuedActivityData[] = store.get('offlineQueue', [])

  const queuedItem: QueuedActivityData = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username,
    dailyData,
    timestamp: Date.now(),
    retryCount: 0
  }

  queue.push(queuedItem)
  store.set('offlineQueue', queue)
  log.info(`Added ${dailyData.length} activities to offline queue. Queue size: ${queue.length}`)
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(retryCount: number): number {
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY)
  return delay
}

/**
 * Process the offline queue and retry failed syncs
 */
async function processOfflineQueue(): Promise<void> {
  const queue: QueuedActivityData[] = store.get('offlineQueue', [])

  if (queue.length === 0) {
    return
  }

  const online = await isOnline()
  if (!online) {
    log.info('Device is offline. Skipping queue processing.')
    return
  }

  log.info(`Processing offline queue with ${queue.length} items`)

  const now = Date.now()
  const updatedQueue: QueuedActivityData[] = []

  for (const item of queue) {
    // Check if enough time has passed since last retry attempt
    const timeSinceLastRetry = item.lastRetryAttempt ? now - item.lastRetryAttempt : Infinity
    const retryDelay = getRetryDelay(item.retryCount)

    if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
      log.warn(`Item ${item.id} has exceeded max retry attempts. Removing from queue.`)
      continue // Skip this item, effectively removing it
    }

    if (timeSinceLastRetry < retryDelay) {
      // Not time to retry yet, keep in queue
      updatedQueue.push(item)
      continue
    }

    // Attempt to sync this item
    try {
      const success = await syncActivityData(item.dailyData, item.username)

      if (success) {
        log.info(`Successfully synced queued item ${item.id}`)
        // Remove from queue on success
        continue
      } else {
        // Update retry count and last retry attempt
        item.retryCount += 1
        item.lastRetryAttempt = now
        updatedQueue.push(item)
        log.info(`Failed to sync item ${item.id}. Retry count: ${item.retryCount}`)
      }
    } catch (error) {
      log.error(`Error processing queued item ${item.id}:`, error)
      item.retryCount += 1
      item.lastRetryAttempt = now
      updatedQueue.push(item)
    }
  }

  store.set('offlineQueue', updatedQueue)

  if (updatedQueue.length > 0) {
    log.info(`Queue processing complete. ${updatedQueue.length} items remaining.`)
  } else {
    log.info('Queue processing complete. All items synced successfully.')
  }
}

/**
 * Sync activity data to the backend
 */
async function syncActivityData(
  dailyData: Array<{ url: string; title: string; timeSpent: number; date: string }>,
  username: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/activity/persist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        dailyData
      })
    })

    if (response.ok) {
      log.info(`Successfully synced ${dailyData.length} activities for ${username}`)
      store.set('lastSyncTimestamp', Date.now())
      return true
    } else {
      const errorText = await response.text().catch(() => 'Unknown error')
      log.error(
        `Failed to persist daily data: ${response.status} ${response.statusText} - ${errorText}`
      )
      return false
    }
  } catch (error) {
    log.error('Error persisting daily data:', error)
    return false
  }
}

/**
 * Persist daily data with offline queue support
 */
async function persistDailyData(
  dailyData: Array<{ url: string; title: string; timeSpent: number; date: string }>,
  username: string
): Promise<boolean> {
  if (!username) {
    log.warn('Cannot persist data: user not logged in')
    return false
  }

  // Check if online
  const online = await isOnline()

  if (!online) {
    log.info('Device is offline. Adding data to queue.')
    addToOfflineQueue(dailyData, username)
    return false
  }

  // Try to sync
  const success = await syncActivityData(dailyData, username)

  if (!success) {
    // If sync failed, add to queue for retry
    log.info('Sync failed. Adding data to offline queue.')
    addToOfflineQueue(dailyData, username)
  }

  return success
}
function startPersistenceInterval(): void {
  if (!persistenceInterval && !isSystemSuspended) {
    persistenceInterval = setInterval(async () => {
      if (!user || !user.username) {
        log.info('User not logged in. Skipping persistence.')
        return
      }

      const today = dayjs().format('YYYY-MM-DD') // Use ISO date format
      const username = user.username
      const MIN_TIME_THRESHOLD = 10

      const filteredTrackers = currentSiteTimeTrackers.filter(
        (tracker) => tracker.timeSpent >= MIN_TIME_THRESHOLD
      )

      if (filteredTrackers.length === 0) {
        log.info('No trackers to persist (all below threshold).')
        return
      }

      // Create an array of activity objects with ISO date format
      const dailyData = filteredTrackers.map((tracker: SiteTimeTracker) => ({
        url: tracker.url ? tracker.url.slice(0, 200) : 'unknown',
        title: tracker.title ? tracker.title.slice(0, 100) : 'Untitled',
        timeSpent: tracker.timeSpent,
        date: today
      }))

      // Add manual time entries for today
      const manualTimeEntries = store.get('manualTimeEntries', []) as ManualTimeEntry[]
      const todayManualEntries = manualTimeEntries.filter((entry) => entry.date === today)

      // Convert manual entries to activity format with type marker
      const manualActivities = todayManualEntries.map((entry) => ({
        url: 'manual-entry',
        title: entry.taskName.slice(0, 100),
        timeSpent: Math.round(entry.hours * 60 * 60), // Convert hours to seconds
        date: entry.date,
        type: 'manual' // Marker to identify manual entries
      }))

      const allDailyData = [...dailyData, ...manualActivities]

      log.info(
        `Persisting ${allDailyData.length} activities (${dailyData.length} automatic, ${manualActivities.length} manual) for ${username}`
      )
      await persistDailyData(allDailyData, username)

      // Also process any queued items
      await processOfflineQueue()
    }, PERSISTENCE_INTERVAL)
    log.info('Persistence interval started (every 5 minutes).')
  }
}

/**
 * Start the retry queue processor
 */
function startRetryQueueProcessor(): void {
  if (!retryQueueInterval) {
    // Process queue every 2 minutes
    retryQueueInterval = setInterval(
      async () => {
        await processOfflineQueue()
      },
      2 * 60 * 1000
    )
    log.info('Retry queue processor started.')
  }
}

/**
 * Stop the retry queue processor
 */
function stopRetryQueueProcessor(): void {
  if (retryQueueInterval) {
    clearInterval(retryQueueInterval)
    retryQueueInterval = null
    log.info('Retry queue processor stopped.')
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
    const daysSinceLastEmail = today.diff(lastEmailDate, 'day')

    log.info('checking and sending missed emails')
    log.info(
      'lastEmailDate',
      lastEmailDate.format('YYYY-MM-DD'),
      'today',
      today.format('YYYY-MM-DD'),
      'daysSinceLastEmail',
      daysSinceLastEmail
    )

    // If there's a large gap (more than 1 day), skip sending missed emails for days in between
    // The user wasn't using the app during those days, so there's no need to send emails
    // But still send an email for today when they check in
    if (daysSinceLastEmail > 1) {
      log.info(
        `Large gap detected (${daysSinceLastEmail} days). Skipping missed emails for days in between, but sending email for today.`
      )
      // Only send email for today
      if (!lastEmailDate.isSame(today, 'day')) {
        log.info(`Sending email for today: ${today.format('YYYY-MM-DD')}`)
        const sendEmailResponse = await sendDailyEmail()
        if (sendEmailResponse) {
          store.set('lastEmailDate', today.toISOString())
        } else {
          log.info('Email not sent. Retrying in 10 minutes.')
          new Notification({
            title: 'Deep Focus',
            body: 'Email not sent. Retrying in 10 minutes.'
          }).show()
        }
      }
      return
    }

    // Normal flow: send missed emails for small gaps (1 day or less)
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
