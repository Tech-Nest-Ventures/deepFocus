import { parse } from 'url'
import { MacOSResult, Result } from 'get-windows'

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

export function calculateProductivityScore(windows: MacOSResult[]): number {
  const browserWindows = windows.filter((win) => win.url)
  if (browserWindows.length === 0) return 1 // No browser windows open, assume productive

  const productiveWindows = browserWindows.filter((win) => isProductiveUrl(win.url!))
  return productiveWindows.length / browserWindows.length
}
