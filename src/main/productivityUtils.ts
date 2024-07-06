import { parse } from 'url'
import { MacOSResult, Result } from 'get-windows'
import { SiteTimeTracker } from './types'
import { currentSiteTimeTrackers } from '.'

//TODO: Needs to be updated with user's specific sites
const unproductiveSites = ['gmail.com', 'instagram.com', 'facebook.com']

export function getUrlFromResult(result: Result): string | undefined {
  if ('url' in result) {
    return (result as MacOSResult).url
  }
  return undefined
}

function getDomainFromUrl(url: string): string {
  const parsedUrl = parse(url)
  return parsedUrl.hostname || ''
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

//TODO: This logic doesn't really make sense haha.
export function calculateProductivityScore(windows: MacOSResult[]): number {
  const browserWindows = windows.filter((win) => win.url)
  if (browserWindows.length === 0) return 1 // No browser windows open, assume productive

  const productiveWindows = browserWindows.filter((win) => isProductiveUrl(win.url!))
  return productiveWindows.length / browserWindows.length
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

export function updateSiteTimeTracker(windowInfo: Result): SiteTimeTracker {
  const currentTime = Date.now()
  const url = getUrlFromResult(windowInfo) || windowInfo.title

  let tracker = currentSiteTimeTrackers.find((t) => t.url === url)
  if (tracker) {
    console.log('Updating existing tracker')
    tracker.timeSpent += currentTime - tracker.lastActiveTimestamp
    tracker.lastActiveTimestamp = currentTime
  } else {
    console.log('Creating new tracker')
    tracker = {
      url,
      title: windowInfo.title,
      timeSpent: 0,
      lastActiveTimestamp: currentTime
    }
    currentSiteTimeTrackers.push(tracker)
  }
  return tracker
}
