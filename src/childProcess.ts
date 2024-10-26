import fs from 'fs'
import path from 'path'
import os from 'os'

// Interface to represent application icon information
interface AppIcon {
  appName: string
  iconPath: string
}

export function getApplicationIcons(): AppIcon[] {
  const appFolders = [
    path.join(os.homedir(), 'Applications'), // User-specific Applications
    '/Applications' // System-wide Applications
  ]

  const appIcons: AppIcon[] = []

  appFolders.forEach((appsFolder) => {
    if (!fs.existsSync(appsFolder)) return

    const apps = fs.readdirSync(appsFolder)
    console.log('Apps in', appsFolder, ':', apps)

    apps.forEach((appName) => {
      const appPath = path.join(appsFolder, appName)
      const resourcesPath = path.join(appPath, 'Contents', 'Resources')

      // Check if it's a valid .app bundle and if the Resources folder exists
      if (appName.endsWith('.app') && fs.existsSync(resourcesPath)) {
        // Get all files in the Resources folder
        const resourceFiles = fs.readdirSync(resourcesPath)
        // Find the .icns file
        const icnsFile = resourceFiles.find((file) => file.endsWith('.icns'))

        if (icnsFile) {
          appIcons.push({
            appName: appName.replace('.app', ''),
            iconPath: path.join(resourcesPath, icnsFile)
          })
        }
      } else if (fs.lstatSync(appPath).isDirectory()) {
        // Search subfolders like Utilities
        const subfolderIcons = getApplicationIconsInSubfolder(appPath)
        appIcons.push(...subfolderIcons)
      }
    })
  })

  return appIcons
}

// Helper function to search for app icons in subfolders (like Utilities)
function getApplicationIconsInSubfolder(folderPath: string): AppIcon[] {
  const appIcons: AppIcon[] = []
  const apps = fs.readdirSync(folderPath)

  apps.forEach((appName) => {
    const appPath = path.join(folderPath, appName)
    const resourcesPath = path.join(appPath, 'Contents', 'Resources')

    // Check if it's a valid .app bundle and if the Resources folder exists
    if (appName.endsWith('.app') && fs.existsSync(resourcesPath)) {
      const resourceFiles = fs.readdirSync(resourcesPath)
      const icnsFile = resourceFiles.find((file) => file.endsWith('.icns'))

      if (icnsFile) {
        appIcons.push({
          appName: appName.replace('.app', ''),
          iconPath: path.join(resourcesPath, icnsFile)
        })
      }
    }
  })

  return appIcons
}

// // Example usage
const icons = getApplicationIcons()
console.log('Application Icons:', icons)
