import { parse } from 'url'
import { browser, MacOSResult, Result, SiteTimeTracker } from './types'
import { TypedStore } from './index'
import {exec} from 'child_process';

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
  timeTrackers: SiteTimeTracker[],
  parsedURL?: string
): SiteTimeTracker {
  const currentTime = Number((Date.now() / 1000).toString().slice(0, -3))

  // Check if the windowInfo has a valid URL, and if so, extract the base URL
  let url = getUrlFromResult(windowInfo) 
  if (parsedURL) {
    console.log("testing sanity, ", url)
    url = parsedURL
  }
  let trackerKey = ''
  let trackerTitle = ''

  if (url && isValidURL(url)) {
    // For URLs, use the base URL as the tracker key and the title as the URL's base domain
    trackerKey = getBaseURL(url) as string
    trackerTitle = getBaseURL(url) as string
  }  else {
    // If it's a desktop app (no valid URL), use the app path and name for the tracker
    trackerKey = windowInfo.owner?.path || 'Unknown App'
    trackerTitle = windowInfo.owner?.path.split('/').pop()?.replace('.app', '') || 'Unknown App'
  }

  // Find an existing tracker or create a new one
  let tracker = timeTrackers.find((t) => t.url === trackerKey)
  if (tracker) {
    console.log('Updating existing tracker')
    tracker.timeSpent += 5
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

// // Function to check Accessibility and Screen Capture permissions
// export function checkPermissions() {
//   const accessibilityStatus = systemPreferences.isTrustedAccessibilityClient(true); // false means don't prompt
//   const screenCaptureStatus = systemPreferences.getMediaAccessStatus('screen');

//   // Check Accessibility permission
//   if (accessibilityStatus === false) {
//     dialog.showMessageBox({
//       type: 'warning',
//       buttons: ['Quit', 'Cancel'],
//       message: 'Deep Focus requires Accessibility permissions to track your activity accurately. Please enable it in System Preferences > Security & Privacy > Accessibility.',
//     }).then(result => {
//       if (result.response === 0) {
//         app.quit();
//       }
//     });
//   }

//   // Check Screen Capture permission
//   if (screenCaptureStatus !== 'granted') {
//     dialog.showMessageBox({
//       type: 'warning',
//       buttons: ['Quit', 'Cancel'],
//       message: 'Deep Focus requires Screen Capture permissions. Please enable it in System Preferences > Security & Privacy > Screen Recording.',
//     }).then(result => {
//       if (result.response === 0) {
//         app.quit();
//       }
//     });
//   }
//       // Check accessibility permissions
//       console.log('Accessibility permission:', accessibilityStatus);

//       if (accessibilityStatus === false) {
//         new Notification({
//           title: 'DeepFocus',
//           body: 'Please enable Accessibility permissions in System Preferences to track your productivity.',
//           icon: join(__dirname, 'resources/icon.png')
//         }).show();
//         console.error("Accessibility permission is missing. Please enable it in System Preferences.");
//         return; // Stop execution if permissions are missing
//       }

// }

// Function to get the active window and its title
export function getActiveWindow() {
  return new Promise((resolve, reject) => {
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        set frontAppName to name of frontApp
        tell process frontAppName
          set winTitle to name of front window
        end tell
      end tell
      return frontAppName & "|" & winTitle
    `;
    
    exec(`osascript -e '${script}'`, (err, stdout, stderr) => {
      if (err) {
        reject(`Error: ${stderr}`);
      } else {
        const [appName, windowTitle] = stdout.trim().split('|');
        resolve({ appName, windowTitle });
      }
    });
  });
}

// Function to get the URL for a specific browser
export function getBrowserURL(browser: browser) {
  return new Promise((resolve, reject) => {
    let script = `osascript -e 'tell application "${browser}" to get URL of active tab of front window'`;
    if (browser === 'Safari') {
      script = `osascript -e 'tell application "${browser}" to get URL of front document'`;
    }

    exec(script, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error getting URL for ${browser}: ${stderr}`);
        resolve(''); // Return an empty string if there's an error
      } else {
        resolve(stdout.trim());
      }
    });
  });
}