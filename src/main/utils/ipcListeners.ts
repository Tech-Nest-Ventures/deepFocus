import { DeepWorkHours, User } from '../types'
import { getInstalledApps } from '../childProcess'
import { resetCounters } from './utils'
import {
  getDeepWorkHours,
  startActivityMonitoring,
  handleUserLogout,
  handleUserData,
  TypedStore,
  loadUserData,
  updateAppMenu
} from '../index'
import { isValidURL } from '../productivityUtils'

export function setupIPCListeners(
  ipcMain: Electron.IpcMain,
  store: TypedStore,
  mainWindow: Electron.BrowserWindow | null
) {
  ipcMain.setMaxListeners(20)
  ipcMain.on('login-user', (_event, user: User) => {
    user = handleUserData(user, store)
    if (user && mainWindow) {
      console.log('setting up listeners & monitoring')
      startActivityMonitoring(mainWindow)
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
    const trackers = store.get('siteTimeTrackers', [])
    const apps = await getInstalledApps() // Fetch the list of installed apps with their icons

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

  ipcMain.on('reset-deep-work-data', () => {
    console.log('Resetting deep work data')
    const siteTrackers = store.get('siteTimeTrackers', [])
    const deepWorkHours = store.get('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    }) as DeepWorkHours

    // Perform reset
    resetCounters('daily', store, siteTrackers, deepWorkHours)

    // Notify frontend about the reset
    mainWindow?.webContents.send('deep-work-reset')
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
