import { parse } from 'url'
import { currentSiteTimeTrackers } from '.'
import { MacOSResult, Result, SiteTimeTracker } from './types'

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
  isProductiveUrl(parsedUrl.hostname || '')
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
