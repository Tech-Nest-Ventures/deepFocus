import appPath from 'app-path'
import fs from 'fs'
import path from 'path'

interface AppInfo {
  name: string
  path: string
  icon: string
}

// Helper function to find the .icns file within an app bundle
function findIcnsFile(appFullPath: string): string | null {
  const resourcesPath = path.join(appFullPath, 'Contents', 'Resources')
  if (!fs.existsSync(resourcesPath)) return null

  // Try to find a file that ends with .icns in the Resources directory
  const files = fs.readdirSync(resourcesPath)
  const icnsFile = files.find(file => file.endsWith('.icns'))
  return icnsFile ? path.join(resourcesPath, icnsFile) : null
}

// Function to fetch the icon as a base64 string
async function getAppIcon(appFullPath: string): Promise<string> {
  const icnsFilePath = findIcnsFile(appFullPath)
  if (!icnsFilePath) {
    console.warn(`No .icns file found for app at ${appFullPath}`)
    return getFallbackIconBase64()
  }

  try {
    const iconBuffer = await fs.promises.readFile(icnsFilePath)
    return 'data:image/icns;base64,' + iconBuffer.toString('base64')
  } catch (error) {
    console.warn(`Failed to read icon file at ${icnsFilePath}: ${error.message}`)
    return getFallbackIconBase64()
  }
}

// Function to return a base64-encoded fallback icon
function getFallbackIconBase64(): string {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAABIVJREFUWIXNVztvJEUQ/qqnex67M2ffYowgJrqQE+h+AhIJKSHB/Y/7D0hkCIkACZDQkR0BOiEkogsvICFw5jut117Ps98EM9Me27uLMRioYNU7U931VdVX1TXAfyz0D+nsEv+XD1dKvR9F0WMi+oCI3gLwJoDoFsbX3vtXAF46577inP+wU/v58+fcWvu59975OxDn3NPj4+P51mhYaz+7C8NXQHw/jXxYNE3zKMuyX8dnylisqhpNpyC1gfceB3s5Ts7rrREkIiyKGZbrCkSEWESYJQmKNEGeJUHPGPOhEOLHKQAyxnwRRdGno/Gzurlhmm8mszgOIKy133DOPwHg+QV4ejQqr6oajAjLdRUOSGOBPEtgrIPUGtpYON8TnBFB8AiJEOARQ9VKdEqHqLxxb46ykwEAEb03OB8AMCJ6ZzRWdxJFlsJ5DyJCkaWIeV8Eq3JzCpSxaKXGwV6OWRKDRxHKtgMG'
}

// Main function to get installed apps with name, path, and icon
export async function getInstalledApps(): Promise<AppInfo[]> {
  const appsToFetch = [
    'Safari',
    'Visual Studio Code',
    'Docker',
    'Google Chrome',
    'Firefox',
    'Microsoft Word',
    'Microsoft Excel',
    'Microsoft PowerPoint',
    'Spotify',
    'Slack',
    'Discord',
    'Zoom.us',
    'Mail',
    'Messages',
    'Calendar',
    'Photos',
    'Reminders',
    'Notes',
    'Preview',
    'TextEdit',
    'App Store',
    'System Preferences',
    'Terminal',
    'Finder',
    'Xcode'
  ]

  const appPromises = appsToFetch.map(async (appName) => {
    try {
      console.log('appName', appName)
      const appFullPath = await appPath(appName)
      console.log('appFullPath', appFullPath)
      const icon = await getAppIcon(appFullPath)

      return {
        name: appName,
        path: appFullPath,
        icon
      }
    } catch (error) {
      console.warn(`Failed to fetch app info for ${appName}: ${error.message}`)
      return null // Skip if app path or icon can't be retrieved
    }
  })

  const apps = await Promise.all(appPromises)
  return apps.filter(Boolean) as AppInfo[]
}
