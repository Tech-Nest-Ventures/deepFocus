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
  isBrowser,
  isValidURL
} from './productivityUtils'
import { getInstalledApps } from './childProcess.js'
import { checkForUpdates, getIconPath, updateIconBasedOnProgress } from './utils'
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
let iconPath = ''
let mainWindow: BrowserWindow | null = null
log.transports.file.level = 'debug'
log.transports.file.maxSize = 10 * 1024 * 1024

log.info('Log from the main process')
const resourcesPath: string = setupEnvironment()
log.info('Set up Environment')

// Initialize environment variables based on the environment
function setupEnvironment() {
  try {
    log.info('Setting up environment...')

    // Initialize resourcesPath within this function
    const resourcesPath = app.isPackaged ? path.join(process.resourcesPath) : path.join(__dirname, 'resources');
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
            handleDailyReset()
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
  const today = dayjs().format('dddd') as keyof typeof deepWorkHours;
  log.info(
    'Periodic save triggered (updating siteTimeTrackers, deepWorkHours, currentDeepWork and icon): '
  )
  store.set('siteTimeTrackers', currentSiteTimeTrackers)
  store.set('deepWorkHours', deepWorkHours)

  currentDeepWork = deepWorkHours[today] || 0
  deepWorkHours[today] = 0;
}

export async function resetCounters(type: 'daily' | 'weekly') {
  const now = dayjs();
  log.info('Invoked resetCounters');

  stopActivityMonitoring();

  if (type === 'daily') {
    currentSiteTimeTrackers?.forEach((tracker) => {
      tracker.timeSpent = 0;
      tracker.lastActiveTimestamp = 0;
    });
    const lastResetDate = now.toISOString();
    store?.set('lastResetDate', lastResetDate);
    const today = now.format('dddd') as keyof typeof deepWorkHours;
    deepWorkHours[today] = 0;
    store.set('deepWorkHours', deepWorkHours);
    store.set('siteTimeTrackers', currentSiteTimeTrackers);
    log.info('currentSiteTimeTrackers', currentSiteTimeTrackers, 'deepWorkHours', deepWorkHours);
  } else if (type === 'weekly') {
    currentSiteTimeTrackers = [];
    store.set('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    });
    store.set('siteTimeTrackers', []);
  }

  startActivityMonitoring();

  log.info(`${type.charAt(0).toUpperCase() + type.slice(1)} reset performed. Activity monitoring restarted.`);
}

// Periodic saving of time trackers, deep work hours, and icon progress every 2 minutes
function setupPeriodicSave() {
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

export function startActivityMonitoring() {
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
function stopActivityMonitoring() {
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
    width: 600,
    height: 670,
    show: false,
    autoHideMenuBar: false,
    icon: join(resourcesPath, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInWorker: true,
      sandbox: false
    }
  })
  app.dock.setIcon(getIconPath('icon.png', resourcesPath))

  // log.info('Loading loader.html', path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/loader.html`))
  //  mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/loader.html`));


  mainWindow.on('ready-to-show', async () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // setTimeout(() => {
  //   if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
  //     mainWindow?.loadURL(process.env['ELECTRON_RENDERER_URL'])
  //   } else {
  //        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));

  //   }
  //   mainWindow?.once('ready-to-show', () => {
  //     mainWindow?.show()
  //   })
  // }, 5000)

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
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
  log.info('Checking for updates in app software')
  checkForUpdates()
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
export function handleUserLogout() {
  log.info('Handling user logout')
  store.delete('user')
  store.set('lastResetDate', dayjs().toISOString())
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
  resetCounters('daily')
  log.info('new reset date is ', store.get('lastResetDate'))
})

// Schedule a weekly reset for 11:55 PM on Sunday
schedule.scheduleJob('55 23 * * 0', () => {
  log.info('Scheduled weekly reset at 11:55 PM on Sunday')
  resetCounters('weekly')
  log.info('Weekly counters have been reset')
})

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

  // Fetch the user's site time trackers
  ipcMain.on('fetch-site-trackers', async (event) => {
    log.info('Received event for fetch-site-trackers')

    const trackers = store.get('siteTimeTrackers', [])
    const apps = [] // Fetch the list of installed apps with their icons

    const formattedTrackers = trackers.map((tracker) => {
      let iconUrl = ''

      // Determine if the tracker is a website or an app
      if (isValidURL(tracker.url)) {
        // If it's a valid URL (website), use the Google favicon service
        iconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${tracker.url}`
      } else {
        // If it's not a valid URL (assume it's an app), find its icon from the list of installed apps
        const matchingApp = apps.find((app) => app.name === tracker.title)
        iconUrl = matchingApp ? matchingApp.icon : ''
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
    let deepWorkTarget = store.get('deepWorkTarget', 8) as number
    event.reply('deep-work-target-response', deepWorkTarget)
  })
  // Update the user's deep work target daily
  ipcMain.on('update-deep-work-target', (_event, newTarget: number) => {
    store.set('deepWorkTarget', newTarget)
    updateAppMenu()
    console.log(`Updated Deep Work Target: ${newTarget}`)
  })
  // Fetch the user's current deep work hours daily
  ipcMain.on('fetch-deep-work-data', (event) => {
    log.info('Received event for fetch-deep-work-data')
    handleDailyReset()

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

      const apps = await getInstalledApps()
      // console.log('Apps are ', apps)
      event.reply('app-icons-response', apps)
    } catch (error) {
      console.error('Error fetching app icons:', error)
      event.reply('app-icons-response', [])
    }
  })
}

export function handleDailyReset() {
  const now = dayjs()

  log.info('lastResetDate is ', store.get('lastResetDate'))
  const lastResetDate = dayjs(store.get('lastResetDate', now.subtract(1, 'day').toISOString()))

  // Perform daily reset if the last reset was not today
  if (!lastResetDate.isSame(now, 'day')) {
    log.info('Performing daily reset. Previous reset date:', lastResetDate.format('YYYY-MM-DD'))
    resetCounters('daily')
    log.info(`Daily reset performed. New reset date stored: ${now.format('YYYY-MM-DD')}`)

    // Check if we need to do a full weekly reset (if last reset was more than a week ago)
    if (now.diff(lastResetDate, 'week') >= 1) {
      log.info('Performing full weekly reset for the previous week.')
      resetCounters('weekly')
      log.info(`Weekly reset performed. New reset date stored: ${now.format('YYYY-MM-DD')}`)
    } else if (now.day() === 0) {
      // Perform weekly reset if today is Sunday and it's a new week
      resetCounters('weekly')
      log.info(`Weekly reset performed. New reset date stored: ${now.format('YYYY-MM-DD')}`)
    }
  }
}

