import { dialog, app, Notification, autoUpdater } from 'electron'
import log from 'electron-log/node.js'
import path from 'path'
// import FormData from 'form-data'
// import fs from 'fs'
// import fetch from 'node-fetch'

export function checkForUpdates(): void {
  const server = 'https://github.com/Tech-Nest-Ventures/deepFocus'
  const feedURL = `${server}/releases/download/${app.getVersion()}/`
  log.info('feedURL', feedURL)

  autoUpdater.setFeedURL({ url: feedURL })
  autoUpdater.checkForUpdates()

  let isCheckingForUpdates = false
  if (isCheckingForUpdates) {
    log.info('Update check already in progress')
    return
  }

  autoUpdater.checkForUpdates()
  log.info('Checking for updates in app software')

  autoUpdater.on('update-available', () => {
    log.info('Update available.')
    dialog.showMessageBox({
      type: 'info',
      title: 'DeepFocus',
      message: 'Update available',
      detail: 'A new version of DeepFocus is available. Please update to the latest version.'
    })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('No update available.')

    dialog.showMessageBox({
      type: 'info',
      title: 'DeepFocus',
      message: 'No updates available',
      detail: 'You are currently running the latest version of DeepFocus.'
    })
    isCheckingForUpdates = false
  })

  autoUpdater.on('error', (error) => {
    log.info('Error in auto-updater:', error)
    dialog.showMessageBox({
      type: 'error',
      title: 'DeepFocus',
      message: 'Error',
      detail: 'An error occurred while checking for updates.'
    })
    isCheckingForUpdates = false
  })

  autoUpdater.on('update-downloaded', async () => {
    log.info('Update downloaded. Installing now...')
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Install Updates',
      message: 'Updates downloaded, the application will quit for update...',
      detail: 'New version downloaded. Quitting.',
      buttons: ['Restart Now']
    })

    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall())
    }
    isCheckingForUpdates = false
  })
}
export function getIconPath(iconName: string, resourcesPath: string): string {
  if (app.isPackaged) {
    // In production, resolve the path from the asar-unpacked resources
    return path.join(resourcesPath, iconName)
  } else {
    // In development mode, resolve the path from your local development folder
    return path.join(__dirname, '../../resources', iconName)
    //return path.join(__dirname, 'resources', iconName);
  }
}

export function updateIconBasedOnProgress(
  iconPath: string,
  deepWorkTarget: number,
  currentDeepWork: number,
  resourcesPath: string
): string {
  console.log('deepWorkTarget', deepWorkTarget, 'currentDeepWork', currentDeepWork)
  const newIconPath = iconPath
  let message = ''

  if (currentDeepWork >= deepWorkTarget) {
    message = `🎉 You've reached your target of ${deepWorkTarget} hours of deep work.`
    iconPath = getIconPath('icon_green.png', resourcesPath)
  } else if (currentDeepWork > 0 && currentDeepWork < Math.floor(deepWorkTarget / 2)) {
    message = `🚧 You're halfway there. Keep up the good work.`
    iconPath = getIconPath('icon_yellow.png', resourcesPath)
  } else if (currentDeepWork > 0 && currentDeepWork > Math.floor(deepWorkTarget / 2)) {
    message = `💡 You're close to the target. Keep it up.`
    iconPath = getIconPath('icon_blue.png', resourcesPath)
  } else {
    message = ` 🏁 Let's get started on your deep work!`
    iconPath = getIconPath('icon_red.png', resourcesPath)
  }
  const isIconPathChanged = iconPath !== newIconPath
  if (isIconPathChanged) {
    log.info('Comparison of icon paths is ', iconPath, newIconPath)
    // app.dock.setIcon(iconPath)
    new Notification({
      title: 'DeepFocus',
      body: message,
      icon: iconPath
    }).show()
  }
  return iconPath
}

// export async function uploadLogs() {
//   const logFilePath = log.transports.file.getFile().path

//   const formData = new FormData()
//   const logStream = fs.createReadStream(logFilePath)

//   formData.append('logFile', logStream)
//   log.info(`${process.env.VITE_SERVER_URL_PROD}/api/v1/upload-log`)
//   try {
//     const response = await fetch(`${process.env.VITE_SERVER_URL_PROD}/api/v1/upload-log`, {
//       method: 'POST',
//       body: formData,
//       headers: formData.getHeaders() // Properly format the headers
//     })

//     if (!response.ok) {
//       throw new Error(`Failed to upload logs, server responded with: ${response.status}`)
//     }

//     const data = await response.json()
//     log.info('Log uploaded successfully:', data)
//   } catch (error) {
//     log.error('Failed to upload logs:', error)
//   }
// }
