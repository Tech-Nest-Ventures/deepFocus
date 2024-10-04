import { parse } from 'url'
import { MacOSResult, Result, SiteTimeTracker, FocusInterval } from './types'
import { TypedStore } from './index'
import pkg from 'node-mac-permissions'
const {
  getAuthStatus,
  askForAccessibilityAccess,
  askForScreenCaptureAccess,
  askForMicrophoneAccess,
  askForRemindersAccess
} = pkg

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

export function getBaseURL(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.hostname}` // This gives you the base URL
  } catch (error) {
    console.error('Invalid URL:', error)
    return null
  }
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
  windowInfo: Result,
  timeTrackers: SiteTimeTracker[]
): SiteTimeTracker {
  const currentTime = Date.now()

  // Check if the windowInfo has a valid URL, and if so, extract the base URL
  const url = getUrlFromResult(windowInfo)
  let trackerKey = ''
  let trackerTitle = ''

  if (url && isValidURL(url)) {
    // For URLs, use the base URL as the tracker key and the title as the URL's base domain
    trackerKey = getBaseURL(url) as string
    trackerTitle = getBaseURL(url) as string
  } else if (windowInfo.owner.name === 'Arc') {
    // If it's a browser, use the page title or URL
    trackerKey = windowInfo.title
    trackerTitle = windowInfo.title
  } else {
    // If it's a desktop app (no valid URL), use the app path and name for the tracker
    trackerKey = windowInfo.owner?.path || 'Unknown App'
    trackerTitle = windowInfo.owner?.path.split('/').pop()?.replace('.app', '') || 'Unknown App'
  }

  // Find an existing tracker or create a new one
  let tracker = timeTrackers.find((t) => t.url === trackerKey)
  if (tracker) {
    console.log('Updating existing tracker')
    tracker.timeSpent += currentTime - tracker.lastActiveTimestamp
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

export function mergeOverlappingIntervals(intervals: FocusInterval[]) {
  if (!intervals.length) return []

  // Sort intervals by the start time
  intervals.sort((a, b) => a.start - b.start)

  const mergedIntervals = [intervals[0]]

  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i]
    const lastMerged = mergedIntervals[mergedIntervals.length - 1]

    // If intervals overlap, merge them
    if (current.start <= lastMerged.end) {
      lastMerged.end = Math.max(lastMerged.end, current.end)
    } else {
      // Otherwise, add the current interval
      mergedIntervals.push(current)
    }
  }

  return mergedIntervals
}

// Helper function to check if an app/site is "deep work"
export function isDeepWork(item: string) {
  const deepWorkSites = ['code', 'notion', 'github', 'chatgpt', 'leetcode', 'electron']
  const formattedItem = item.replaceAll(' ', '').toLowerCase()
  return deepWorkSites.some((site) => formattedItem.includes(site))
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

  // Microphone
  accessStatus = getAuthStatus('microphone')
  if (accessStatus !== 'authorized') {
    console.log('Requesting Microphone Access...')
    await askForMicrophoneAccess()
  } else {
    console.log('Microphone access already granted.')
  }

  // Reminders
  accessStatus = getAuthStatus('reminders')
  if (accessStatus !== 'authorized') {
    console.log('Requesting Reminders Access...')
    await askForRemindersAccess()
  } else {
    console.log('Reminders access already granted.')
  }
}
