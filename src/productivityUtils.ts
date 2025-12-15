import {
  browser,
  SiteTimeTracker,
  WorkContext,
  AppIcon,
  DeepWorkHours,
  DeepWorkHoursWithDates,
  TrackerType
} from './types'
import { TypedStore } from './main'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import log from 'electron-log/main'
import path, { format } from 'path'
import { app } from 'electron'
import fs from 'fs'
import { platform, tmpdir } from 'os'

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

// Dynamically get the user's data path for icon storage
const ICONS_BASE_PATH = path.join(app.getPath('userData'), 'icons')

function findBestIconMatch(appName: string): string | null {
  const sanitizedAppName = appName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const icons = fs.readdirSync(ICONS_BASE_PATH)
  const matchedIcon = icons.find((icon) => icon.toLowerCase().includes(sanitizedAppName))
  if (matchedIcon) {
    // log.info(`Found matching icon: ${matchedIcon} for app: ${appName}`)
    return path.join(ICONS_BASE_PATH, matchedIcon)
  }
  return null
}

function getBase64Icon(iconPath: string): string {
  const iconBuffer = fs.readFileSync(iconPath)
  return `data:image/png;base64,${iconBuffer.toString('base64')}`
}

export function updateSiteTimeTracker(
  appName: string,
  timeTrackers: SiteTimeTracker[],
  url?: string
): SiteTimeTracker {
  const currentTime = Number((Date.now() / 1000).toString().slice(0, -3))

  let trackerKey = ''
  let trackerTitle = ''
  let trackerType: TrackerType
  let iconUrl = ''

  if (url && isValidURL(url)) {
    // For URLs, use the base URL as the tracker key and the title as the URL's base domain
    trackerKey = url
    trackerTitle = url
    trackerType = TrackerType.Website
    iconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${trackerTitle}`
  } else {
    // If it's a desktop app (no valid URL), use the app path and name for the tracker
    trackerKey = appName || 'Unknown App'
    trackerTitle = appName || 'Unknown App'
    trackerType = TrackerType.App

    // Attempt to find the cached icon for this app
    const iconPath = findBestIconMatch(appName)

    if (fs.existsSync(iconPath)) {
      iconUrl = getBase64Icon(iconPath) // Use Base64 data URI for the icon
      // log.info(`Using cached icon: ${iconPath}`)
    } else {
      iconUrl = 'https://cdn-icons-png.freepik.com/512/7022/7022186.png'
    }
  }

  // Find an existing tracker or create a new one
  let tracker = timeTrackers.find((t) => t.url === trackerKey)
  if (tracker) {
    log.info('Updating existing tracker', tracker.title, tracker.timeSpent)
    tracker.timeSpent += 5
    tracker.lastActiveTimestamp = currentTime
    tracker.iconUrl = iconUrl
  } else {
    tracker = {
      url: trackerKey,
      title: trackerTitle,
      timeSpent: 0,
      lastActiveTimestamp: currentTime,
      type: trackerType,
      iconUrl
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
    const validUnproductiveApps: AppIcon[] =
      Array.isArray(unproductiveApps) &&
      unproductiveApps.every((item) => typeof item === 'object' && 'appName' in item)
        ? (unproductiveApps as AppIcon[])
        : []
    if (
      validUnproductiveApps.some((app) =>
        formattedItem.includes(app.appName.toLowerCase().replaceAll(' ', ''))
      )
    ) {
      // console.log('Unproductive app detected:', formattedItem)
      //console.log(validUnproductiveApps.map((app) => app.appName))
      return false
    }
  }
  return true
}
// Function to get the active window and its title
export function getActiveWindowApp(): Promise<string | browser> {
  return new Promise<string | browser>((resolve, _reject) => {
    const currentPlatform = platform()

    if (currentPlatform === 'win32') {
      // Windows: Use PowerShell with Windows API calls to get the foreground window's process name
      // This approach uses the same Windows APIs as get-windows: GetForegroundWindow and GetWindowThreadProcessId
      // We write a temporary PowerShell script to avoid complex escaping issues
      const psScriptContent = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
public class Win32Helper {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
  public static string GetForegroundProcessName() {
    IntPtr hwnd = GetForegroundWindow();
    if (hwnd == IntPtr.Zero) return "";
    int pid = 0;
    GetWindowThreadProcessId(hwnd, out pid);
    if (pid == 0) return "";
    try {
      Process proc = Process.GetProcessById(pid);
      return proc.ProcessName;
    } catch { return ""; }
  }
}
"@
[Win32Helper]::GetForegroundProcessName()
`.trim()

      const tempScriptPath = path.join(tmpdir(), `get-active-window-${Date.now()}.ps1`)
      fs.writeFileSync(tempScriptPath, psScriptContent, 'utf8')

      exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
        { maxBuffer: 1024 * 1024 },
        (err, stdout, stderr) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath)
          } catch (cleanupErr) {
            // Ignore cleanup errors
          }
          if (err) {
            console.error(`Error getting active application: ${stderr}`)
            resolve('')
          } else {
            let appName = stdout.trim()

            if (!appName) {
              resolve('')
              return
            }

            // Map Windows process names to friendly names
            const processNameMap: Record<string, string> = {
              chrome: 'Google Chrome',
              msedge: 'Microsoft Edge',
              firefox: 'Firefox',
              Code: 'Visual Studio Code',
              notepad: 'Notepad',
              winword: 'Microsoft Word',
              excel: 'Microsoft Excel',
              powerpnt: 'Microsoft PowerPoint',
              Teams: 'Microsoft Teams',
              OUTLOOK: 'Microsoft Outlook',
              Discord: 'Discord',
              Spotify: 'Spotify',
              slack: 'Slack',
              powershell: 'PowerShell',
              pwsh: 'PowerShell',
              WindowsTerminal: 'Windows Terminal',
              explorer: 'Windows Explorer'
            }

            // Check if we have a mapping, otherwise use the process name as-is (capitalize first letter)
            const lowerName = appName.toLowerCase()
            const friendlyName = processNameMap[lowerName] || processNameMap[appName] || appName
            resolve(friendlyName)
          }
        }
      )
    } else {
      // macOS: Use osascript
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
    }
  })
}

// Helper function to get URL from Chrome DevTools Protocol (CDP) for Chromium-based browsers
// Works for both Chrome and Edge since they're both Chromium-based
async function getURLFromCDP(browser: string): Promise<string> {
  // First, try to find the browser's debugging port from its user data directory
  // This works when DevTools is open (which auto-enables remote debugging)
  const port = await findBrowserDebuggingPort(browser)

  if (port > 0) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout
      const response = await fetch(`http://localhost:${port}/json`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (response.ok) {
        const tabs = await response.json()

        // Find the active tab (prefer pages over other types, exclude internal pages)
        // Edge and Chrome use the same CDP structure
        const activeTab =
          tabs.find(
            (tab: any) =>
              tab.type === 'page' &&
              !tab.url.startsWith('chrome-extension://') &&
              !tab.url.startsWith('edge://') &&
              !tab.url.startsWith('chrome://') &&
              !tab.url.startsWith('about:')
          ) ||
          tabs.find((tab: any) => tab.type === 'page') ||
          tabs[0]

        if (activeTab && activeTab.url) {
          return activeTab.url
        }
      }
    } catch (error) {
      // Failed to connect to this port
    }
  }

  // Fallback: Try common CDP ports (if browser was launched with --remote-debugging-port)
  const cdpPorts = [9222, 9223, 9224, 9225]
  for (const port of cdpPorts) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000) // 1 second timeout per port
      const response = await fetch(`http://localhost:${port}/json`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (!response.ok) continue

      const tabs = await response.json()

      // Same logic for both Edge and Chrome
      const activeTab =
        tabs.find(
          (tab: any) =>
            tab.type === 'page' &&
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('about:')
        ) ||
        tabs.find((tab: any) => tab.type === 'page') ||
        tabs[0]

      if (activeTab && activeTab.url) {
        return activeTab.url
      }
    } catch (error) {
      // Port not available, try next one
      continue
    }
  }

  // If no CDP port found, try to find the browser's debugging port via process inspection
  return await getURLFromBrowserProcess(browser)
}

// Find the browser's debugging port by checking its user data directory
async function findBrowserDebuggingPort(browser: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const browserConfig: Record<string, { processName: string; dataDir: string }> = {
      'Google Chrome': {
        processName: 'chrome',
        dataDir: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data')
      },
      'Microsoft Edge': {
        processName: 'msedge',
        dataDir: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data')
      },
      'Brave Browser': {
        processName: 'brave',
        dataDir: path.join(
          process.env.LOCALAPPDATA || '',
          'BraveSoftware',
          'Brave-Browser',
          'User Data'
        )
      }
    }

    const config = browserConfig[browser]
    if (!config) {
      resolve(0)
      return
    }

    // Check for DevToolsActivePort file in the browser's user data directory
    const devToolsPortFile = path.join(config.dataDir, 'DevToolsActivePort')

    if (fs.existsSync(devToolsPortFile)) {
      try {
        const content = fs.readFileSync(devToolsPortFile, 'utf8')
        const lines = content.split('\n').filter((line) => line.trim())
        // The port is usually on the first line
        const port = parseInt(lines[0]?.trim() || '0', 10)
        if (!isNaN(port) && port > 0) {
          resolve(port)
          return
        }
      } catch (error) {
        // Failed to read file
      }
    }

    // Fallback: Check command line arguments for remote debugging port
    const script = `powershell -Command "$process = Get-Process | Where-Object {$_.ProcessName -eq '${config.processName}'} | Select-Object -First 1; if ($process) { try { $cmdLine = (Get-CimInstance Win32_Process -Filter \\\"ProcessId = $($process.Id)\\\").CommandLine; if ($cmdLine -match '--remote-debugging-port=(\\d+)') { $matches[1] } else { '' } } catch { '' } } else { '' }"`

    exec(script, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(0)
        return
      }

      const port = parseInt(stdout.trim(), 10)
      resolve(!isNaN(port) && port > 0 ? port : 0)
    })
  })
}

// Fallback: Try to get URL by finding the browser's debugging port via process inspection
async function getURLFromBrowserProcess(browser: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const browserProcessMap: Record<string, string> = {
      'Google Chrome': 'chrome',
      'Microsoft Edge': 'msedge',
      'Brave Browser': 'brave'
    }

    const processName = browserProcessMap[browser] || browser.toLowerCase()

    // Try to find if the browser process has remote debugging enabled
    // by checking command line arguments or user data directory
    const script = `powershell -Command "$process = Get-Process | Where-Object {$_.ProcessName -eq '${processName}'} | Select-Object -First 1; if ($process) { $cmdLine = (Get-CimInstance Win32_Process -Filter \"ProcessId = $($process.Id)\").CommandLine; if ($cmdLine -match '--remote-debugging-port=(\\d+)') { $matches[1] } else { '' } } else { '' }"`

    exec(script, { maxBuffer: 1024 * 1024 }, async (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve('')
        return
      }

      const port = parseInt(stdout.trim(), 10)
      if (!isNaN(port) && port > 0) {
        try {
          const response = await fetch(`http://localhost:${port}/json`)
          if (response.ok) {
            const tabs = await response.json()
            const activeTab =
              tabs.find(
                (tab: any) =>
                  tab.type === 'page' &&
                  !tab.url.startsWith('chrome-extension://') &&
                  !tab.url.startsWith('edge://') &&
                  !tab.url.startsWith('chrome://')
              ) || tabs[0]

            if (activeTab && activeTab.url) {
              resolve(activeTab.url)
              return
            }
          }
        } catch (error) {
          // Failed to connect
        }
      }

      resolve('')
    })
  })
}

// Function to get the URL for a specific browser
export function getBrowserURL(browser: string): Promise<string> {
  return new Promise<string>((resolve, _reject) => {
    const currentPlatform = platform()

    if (currentPlatform === 'win32') {
      // Windows: Use Chrome DevTools Protocol (CDP) for Chromium-based browsers (Edge, Chrome, etc.)
      // Edge and Chrome support CDP, which allows us to query the active tab URL
      const chromiumBrowsers = ['Google Chrome', 'Microsoft Edge', 'Brave Browser']

      if (chromiumBrowsers.includes(browser)) {
        // Try to get URL using Chrome DevTools Protocol
        // Note: This requires remote debugging to be enabled (either via --remote-debugging-port flag
        // or by having DevTools open, which auto-enables it)
        getURLFromCDP(browser)
          .then((url) => {
            if (url) {
              resolve(url)
            } else {
              // On Windows, URL detection is limited without remote debugging enabled
              // The app will still track browser usage by app name (e.g., "Microsoft Edge", "Google Chrome")
              // To enable URL detection: Open DevTools (F12) or launch browser with --remote-debugging-port=9222
              log.debug(
                `Could not get URL for ${browser} via CDP. Remote debugging may not be enabled. Tracking by app name only.`
              )
              resolve('')
            }
          })
          .catch((error) => {
            log.debug(`Error getting URL for ${browser} via CDP: ${error.message}`)
            resolve('')
          })
      } else if (browser.toLowerCase() === 'firefox') {
        // Firefox on Windows doesn't support CDP easily
        log.debug('Firefox URL detection on Windows is not yet implemented.')
        resolve('')
      } else {
        log.debug(`URL detection for ${browser} on Windows is not yet implemented.`)
        resolve('')
      }
    } else {
      // macOS: Use osascript
      let script = `osascript -e 'tell application "${browser}" to get URL of active tab of front window'`
      if (browser === 'Safari' || browser === 'Orion') {
        script = `osascript -e 'tell application "${browser}" to get URL of front document'`
      } else if (browser.toLowerCase() === 'firefox') {
        script = `
      osascript -e 'tell application "System Events" to get value of UI element 1 of combo box 1 of toolbar "Navigation" of first group of front window of application process "Firefox"'
    `
      }

      exec(script, (err, stdout, stderr) => {
        if (err) {
          console.error(`Error getting URL for ${browser}: ${stderr}`)
          resolve('')
        } else {
          resolve(stdout.trim())
        }
      })
    }
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
  deepWorkHours[today as keyof DeepWorkHours] = timeSpentInHours

  // Also store with date information
  const todayDate = dayjs().format('YYYY-MM-DD')
  const deepWorkHoursWithDates = store.get('deepWorkHoursWithDates', {}) as DeepWorkHoursWithDates
  deepWorkHoursWithDates[today as keyof DeepWorkHoursWithDates] = {
    hours: timeSpentInHours,
    date: todayDate
  }
  store.set('deepWorkHoursWithDates', deepWorkHoursWithDates)

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
    'Firefox',
    'firefox',
    'Orion'
  ].includes(appName)
}

// Function to close the active browser tab
export function closeBrowserTab(browser: string): Promise<boolean> {
  return new Promise<boolean>((resolve, _reject) => {
    const currentPlatform = platform()

    if (currentPlatform === 'win32') {
      // Windows: Use keyboard shortcut Ctrl+W to close tab
      // This works for most browsers on Windows
      const script = `powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^w')"`

      exec(script, (err, stdout, stderr) => {
        if (err) {
          log.error(`Error closing tab for ${browser}: ${stderr}`)
          resolve(false)
        } else {
          log.info(`Successfully closed tab in ${browser}`)
          resolve(true)
        }
      })
    } else {
      // macOS: Use osascript
      let script = ''

      if (
        browser === 'Google Chrome' ||
        browser === 'Brave Browser' ||
        browser === 'Microsoft Edge' ||
        browser === 'Vivaldi' ||
        browser === 'Opera' ||
        browser === 'Arc'
      ) {
        script = `osascript -e 'tell application "${browser}" to close active tab of front window'`
      } else if (browser === 'Safari' || browser === 'Orion') {
        script = `osascript -e 'tell application "${browser}" to close front document'`
      } else if (browser.toLowerCase() === 'firefox') {
        // Firefox requires a different approach - use keyboard shortcut
        script = `osascript -e 'tell application "System Events" to keystroke "w" using {command down}'`
      } else {
        log.warn(`Unsupported browser for closing tab: ${browser}`)
        resolve(false)
        return
      }

      exec(script, (err, stdout, stderr) => {
        if (err) {
          log.error(`Error closing tab for ${browser}: ${stderr}`)
          resolve(false)
        } else {
          log.info(`Successfully closed tab in ${browser}`)
          resolve(true)
        }
      })
    }
  })
}

// Function to quit an application
export function quitApplication(appName: string): Promise<boolean> {
  return new Promise<boolean>((resolve, _reject) => {
    // Don't quit Deep Focus itself
    if (appName === 'Deep Focus' || appName === 'Electron') {
      log.warn('Attempted to quit Deep Focus itself, ignoring')
      resolve(false)
      return
    }

    const currentPlatform = platform()

    if (currentPlatform === 'win32') {
      // Windows: Use taskkill to terminate the process
      // Map friendly names back to process names
      const processNameMap: Record<string, string> = {
        'Google Chrome': 'chrome.exe',
        'Microsoft Edge': 'msedge.exe',
        Firefox: 'firefox.exe',
        'Visual Studio Code': 'Code.exe',
        Notepad: 'notepad.exe',
        'Microsoft Word': 'WINWORD.EXE',
        'Microsoft Excel': 'EXCEL.EXE',
        'Microsoft PowerPoint': 'POWERPNT.EXE',
        'Microsoft Teams': 'Teams.exe',
        'Microsoft Outlook': 'OUTLOOK.EXE',
        Discord: 'Discord.exe',
        Spotify: 'Spotify.exe',
        Slack: 'slack.exe'
      }

      const processName = processNameMap[appName] || `${appName}.exe`
      const script = `taskkill /F /IM "${processName}"`

      exec(script, (err, stdout, stderr) => {
        if (err) {
          log.error(`Error quitting application ${appName}: ${stderr}`)
          resolve(false)
        } else {
          log.info(`Successfully quit application: ${appName}`)
          resolve(true)
        }
      })
    } else {
      // macOS: Use osascript
      const script = `osascript -e 'tell application "${appName}" to quit'`

      exec(script, (err, stdout, stderr) => {
        if (err) {
          log.error(`Error quitting application ${appName}: ${stderr}`)
          resolve(false)
        } else {
          log.info(`Successfully quit application: ${appName}`)
          resolve(true)
        }
      })
    }
  })
}
