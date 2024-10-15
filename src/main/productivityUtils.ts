import { parse } from 'url'
import { browser, MacOSResult, Result, SiteTimeTracker } from './types'
import { TypedStore } from './index'
import { exec } from 'child_process'
import { app, dialog, MessageBoxSyncOptions } from 'electron'
import pkg from 'node-mac-permissions'
const { getAuthStatus, askForAccessibilityAccess, askForScreenCaptureAccess } = pkg

//TODO: Needs to be updated with user's specific sites
const unproductiveSites = ['instagram.com', 'facebook.com']

export function getUrlFromResult(result: Result): string | undefined {
  if ('url' in result) {
    return (result as MacOSResult).url
  }
  return undefined
}

export function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function getDomainFromUrl(url: string): string {
  const parsedUrl = parse(url)
  isProductiveUrl(parsedUrl.hostname || '')
  return parsedUrl.hostname || ''
}

export function getBaseURL(url: string): string {
  const urlObj = new URL(url)
  return `${urlObj.protocol}//${urlObj.hostname}` // This gives you the base URL
}

function isProductiveUrl(url: string): boolean {
  const domain = getDomainFromUrl(url)
  console.log(
    'domain is ',
    domain,
    'isProductive? ',
    !unproductiveSites.some((site) => domain.includes(site.toLowerCase()))
  )
  return !unproductiveSites.some((site) => domain.includes(site.toLowerCase()))
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

function isValidURL(url: string): boolean {
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
    console.log('Updating existing tracker')
    tracker.timeSpent += 15
    tracker.lastActiveTimestamp = currentTime
  } else {
    console.log('Creating new tracker')
    tracker = {
      url: trackerKey,
      title: trackerTitle,
      timeSpent: 0,
      lastActiveTimestamp: currentTime
    }
    timeTrackers.push(tracker)
  }

  console.log('tracker is ', tracker)
  return tracker
}

export function addUnproductiveURL(url, store: TypedStore) {
  const unproductiveSites = store.get('unproductiveSites', [])
  if (unproductiveSites && !unproductiveSites.includes(url)) {
    unproductiveSites.push(url)
    store.set('unproductiveSites', unproductiveSites)
  }
}

// Remove an unproductive URL from store
export function removeUnproductiveURL(url, store: TypedStore) {
  let unproductiveSites = store.get('unproductiveSites', [])
  unproductiveSites = unproductiveSites?.filter((site) => site !== url)
  store.set('unproductiveSites', unproductiveSites)
}

// Check if a site is unproductive
export function isUnproductiveSite(url, store: TypedStore): boolean {
  const unproductiveSites = store.get('unproductiveSites', [])
  return unproductiveSites?.includes(url) || false
}

// Helper function to check if an app/site is "deep work"
export function isDeepWork(item: string) {
  const deepWorkSites = ['code', 'notion', 'github', 'chatgpt', 'leetcode', 'electron']
  const formattedItem = item.replaceAll(' ', '').toLowerCase()
  return deepWorkSites.some((site) => formattedItem.includes(site))
}

// Function to get the active window and its title
export function getActiveWindowApp(): Promise<string | browser> {
  return new Promise<string | browser>((resolve, reject) => {
    const script = `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
    exec(script, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error getting active application: ${stderr}`)
        resolve('') // Return empty string on error
      } else {
        let appName = stdout.trim()

        // Handle VSCode specifically
        if (appName === 'Electron') {
          const checkVSCodeScript = `osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'`
          exec(checkVSCodeScript, (err, stdout, stderr) => {
            if (err) {
              console.error(`Error checking bundle identifier: ${stderr}`)
              resolve('') // Return empty string on error
            } else {
              const bundleIdentifier = stdout.trim()
              if (bundleIdentifier === 'com.microsoft.VSCode') {
                appName = 'Visual Studio Code' // Special case for VSCode
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
  return new Promise<string>((resolve, reject) => {
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

// Check for permissions and request if necessary
export async function checkAndRequestPermissions() {
  // Accessibility
  let accessStatus = getAuthStatus('accessibility')
  if (accessStatus !== 'authorized') {
    console.log('Requesting Accessibility Access...')
    await askForAccessibilityAccess()
  } else {
    console.log('Accessibility access already granted.')
  }

  // Screen Recording
  accessStatus = getAuthStatus('screen')
  if (accessStatus !== 'authorized') {
    console.log('Requesting Screen Capture Access...')
    await askForScreenCaptureAccess()
  } else {
    console.log('Screen capture access already granted.')
  }
}
