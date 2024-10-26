import {
  browser,
  MacOSResult,
  Result,
  SiteTimeTracker,
  WorkContext,
  App,
  DeepWorkHours
} from './types'
import { TypedStore } from './main'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import log from 'electron-log/node.js'

export function getUrlFromResult(result: Result): string | undefined {
  if ('url' in result) {
    return (result as MacOSResult).url
  }
  return undefined
}

export function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function getBaseURL(url: string): string {
  const urlObj = new URL(url)
  return `${urlObj.protocol}//${urlObj.hostname}` // This gives you the base URL
}
export function getTrimmedURL(url: string): string {
  const urlObj = new URL(url)
  return `${urlObj.hostname}`
}

export function formatUrl(input: string): string {
  // Regular expression to check if the input looks like a URL
  const urlPattern = /^(https?:\/\/)?([^\s$.?#].[^\s]*)$/i

  if (urlPattern.test(input)) {
    // If it looks like a URL, try to create a URL object
    try {
      const url = new URL(input.startsWith('http') ? input : `http://${input}`)
      const { hostname } = url
      const parts = hostname.split('.').filter((part) => part !== 'www')

      if (parts.length > 2) {
        // There is a subdomain, so format it as Subdomain.Domain
        const subdomain = parts.slice(0, -2).join('.') // Everything before the domain and TLD
        const domain = parts.slice(-2).join('.') // The domain and TLD
        return `${capitalizeFirstLetter(subdomain)}.${capitalizeFirstLetter(domain)}`
      } else {
        // No subdomain, just return the domain
        const domain = parts.join('.') // The domain and TLD
        return capitalizeFirstLetter(domain)
      }
    } catch (error) {
      console.error('Error formatting URL:', error)
      return input
    }
  } else {
    // If the input is not a valid URL, return it as is
    return input
  }
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url) // URL constructor will throw an error if it's not a valid URL
    return true
  } catch (_) {
    return false
  }
}

export function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}
export function updateSiteTimeTracker(
  appName: string,
  timeTrackers: SiteTimeTracker[],
  url?: string
): SiteTimeTracker {
  const currentTime = Number((Date.now() / 1000).toString().slice(0, -3))

  let trackerKey = ''
  let trackerTitle = ''

  if (url && isValidURL(url)) {
    // For URLs, use the base URL as the tracker key and the title as the URL's base domain
    trackerKey = url
    trackerTitle = url
  } else {
    // If it's a desktop app (no valid URL), use the app path and name for the tracker
    trackerKey = appName || 'Unknown App'
    trackerTitle = appName || 'Unknown App'
  }

  // Find an existing tracker or create a new one
  let tracker = timeTrackers.find((t) => t.url === trackerKey)
  if (tracker) {
    log.info('Updating existing tracker', tracker.title, tracker.timeSpent)
    tracker.timeSpent += 5
    tracker.lastActiveTimestamp = currentTime
  } else {
    tracker = {
      url: trackerKey,
      title: trackerTitle,
      timeSpent: 0,
      lastActiveTimestamp: currentTime
    }
    timeTrackers.push(tracker)
  }

  return tracker
}

// Helper function to check if an app/site is "deep work"
export function isDeepWork(context: WorkContext, store: TypedStore): boolean {
  const formattedItem = context.value?.replaceAll(' ', '')?.toLowerCase()
  if (context.type === 'URL') {
    // Handle the case for URL
    const unproductiveURLs = store.get('unproductiveUrls', [])
    if (
      unproductiveURLs?.some((site) => formattedItem.includes(getTrimmedURL(site).toLowerCase()))
    ) {
      return false
    }
  } else if (context.type === 'appName') {
    const unproductiveApps: unknown = store.get('unproductiveApps', [])

    const validUnproductiveApps: App[] =
      Array.isArray(unproductiveApps) &&
      unproductiveApps.every((item) => typeof item === 'object' && 'name' in item)
        ? (unproductiveApps as App[])
        : []

    if (validUnproductiveApps.some((app) => formattedItem.includes(app.name.toLowerCase()))) {
      console.log('Unproductive app detected:', formattedItem)
      return false
    }
  }
  return true
}
// Function to get the active window and its title
export function getActiveWindowApp(): Promise<string | browser> {
  return new Promise<string | browser>((resolve, _reject) => {
    const script = `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
    exec(script, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error getting active application: ${stderr}`)
        resolve('')
      } else {
        let appName = stdout.trim()

        // Handle VSCode specifically
        if (appName === 'Electron') {
          const checkVSCodeScript = `osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'`
          exec(checkVSCodeScript, (err, stdout, stderr) => {
            if (err) {
              console.error(`Error checking bundle identifier of App ${appName}: ${stderr}`)
              resolve('')
            } else {
              const bundleIdentifier = stdout.trim()
              if (bundleIdentifier === 'com.microsoft.VSCode') {
                appName = 'Visual Studio Code'
              }
              resolve(appName)
            }
          })
        } else {
          resolve(appName) // Return other app names as-is
        }
      }
    })
  })
}
// Function to get the URL for a specific browser
export function getBrowserURL(browser: browser): Promise<string> {
  return new Promise<string>((resolve, _reject) => {
    let script = `osascript -e 'tell application "${browser}" to get URL of active tab of front window'`
    if (browser === 'Safari') {
      script = `osascript -e 'tell application "${browser}" to get URL of front document'`
    }

    exec(script, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error getting URL for ${browser}: ${stderr}`)
        resolve('') // Return an empty string if there's an error
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

export function calculateDeepWorkHours(
  siteTrackers: SiteTimeTracker[],
  deepWorkHours: DeepWorkHours,
  store: TypedStore
): DeepWorkHours {
  const today = dayjs().format('dddd')
  let totalDeepWorkTime = 0

  // Filter and sum the time spent on deep work apps/sites
  siteTrackers.forEach((tracker) => {
    if (tracker.title.includes('https://') || tracker.title.includes('http://')) {
      if (isDeepWork({ type: 'URL', value: tracker.url }, store)) {
        totalDeepWorkTime += tracker.timeSpent
      }
    } else {
      if (isDeepWork({ type: 'appName', value: tracker.title }, store)) {
        totalDeepWorkTime += tracker.timeSpent
      }
    }
  })
  const timeSpentInHours = Number((totalDeepWorkTime / (60 * 60)).toFixed(2)) // Convert from sec to hours
  deepWorkHours[today] = timeSpentInHours
  // log.info(`Deep work hours for ${today}: ${deepWorkHours[today]} hours`)
  store.set('deepWorkHours', deepWorkHours)
  return deepWorkHours
}

export function isBrowser(appName: string): appName is browser {
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
