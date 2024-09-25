import { parse } from 'url'
import { MacOSResult, Result, SiteTimeTracker } from './types'

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
  const url = getUrlFromResult(windowInfo) || windowInfo.title

  // Check if this is a URL or an app (if URL extraction fails)
  let trackerKey = url
  if (url && isValidURL(url)) {
    trackerKey = getBaseURL(url) as string // Use base URL to track all paths under one domain
  } else {
    trackerKey = windowInfo.title || 'Unknown App'
  }

  let tracker = timeTrackers.find((t) => t.url === trackerKey)
  if (tracker) {
    console.log('Updating existing tracker')
    tracker.timeSpent += currentTime - tracker.lastActiveTimestamp
    tracker.lastActiveTimestamp = currentTime
  } else {
    console.log('Creating new tracker')
    tracker = {
      url: trackerKey,
      title: windowInfo.title || 'Unknown App',
      timeSpent: 0,
      lastActiveTimestamp: currentTime
    }
    timeTrackers.push(tracker)
  }
  return tracker
}
