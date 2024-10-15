import dayjs from 'dayjs'
import { SiteTimeTracker, DeepWorkHours } from './types'
import { autoUpdater, dialog, app, Notification } from 'electron'
import log from 'electron-log/node.js';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs'
import fetch from 'node-fetch';

export function resetCounters(
  type: 'daily' | 'weekly',
  store: any,
  siteTrackers: SiteTimeTracker[],
  deepWorkHours: DeepWorkHours
) {
  const now = dayjs()
  if (type === 'daily') {
    siteTrackers.forEach((tracker) => {
      tracker.timeSpent = 0
      tracker.lastActiveTimestamp = 0
    })
    store.set('lastResetDate', dayjs().format('YYYY-MM-DD'))
    deepWorkHours[now.format('dddd')] = 0
    store.set('deepWorkHours', deepWorkHours)
    store.set('siteTimeTrackers', siteTrackers)
  } else if (type === 'weekly') {
    siteTrackers = []
    store.set('deepWorkHours', {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    })
    store.set('siteTimeTrackers', [])
  }
}

export function checkForUpdates() {

autoUpdater.checkForUpdates()

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'DeepFocus',
    message: 'Update available',
    detail: 'A new version of DeepFocus is available. Please update to the latest version.'
  })
})

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'DeepFocus',
    message: 'No updates available',
    detail: 'You are currently running the latest version of DeepFocus.'
  })
})

autoUpdater.on('error', (error) => {
  log.info('Error in auto-updater:', error);
  dialog.showMessageBox({
    type: 'error',
    title: 'DeepFocus',
    message: 'Error',
    detail: 'An error occurred while checking for updates.'
  })
})

autoUpdater.on('update-downloaded', async () => {
  log.info('Update downloaded. Installing now...');
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Install Updates',
    message: 'Updates downloaded, the application will quit for update...',
    detail: 'New version downloaded. Quitting.',
    buttons: ['Restart Now']
  });

  if (response === 0) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
});
}
export function getIconPath(iconName) {
  if (app.isPackaged) {
    // In production, resolve the path from the asar-unpacked resources
    return path.join(process.resourcesPath, 'resources', iconName)
  } else {
    // In development mode, resolve the path from your local development folder
    return path.join(__dirname, '../../resources', iconName)
  }
}


export function updateIconBasedOnProgress(iconPath: string, deepWorkTarget: number, currentDeepWork: number): string {
  console.log('deepWorkTarget', deepWorkTarget, 'currentDeepWork', currentDeepWork)
  let newIconPath = iconPath
  let message: string = ''

  if (currentDeepWork >= deepWorkTarget) {
    console.log('Greater than or equal to target. Setting to green icon')
    message = `🎉 You've reached your target of ${deepWorkTarget} hours of deep work.`
    iconPath = getIconPath('icon_green.png')
  } else if (currentDeepWork > 0 && currentDeepWork < Math.floor(deepWorkTarget / 2)) {
    console.log('Greater than 1 but less than 1/2 of target. Setting to yellow icon')
    message = `🚧 You're halfway there. Keep up the good work.`
    iconPath = getIconPath('icon_yellow.png')
  } else if (currentDeepWork > 0 && currentDeepWork > Math.floor(deepWorkTarget / 2)) {
    console.log('Half way there. Setting to blue icon')
    message = `💡 You're close to the target. Keep it up.`
    iconPath = getIconPath('icon_blue.png')
  } else {
    console.log('Still at 0')
    message = ` 🏁 Let's get started on your deep work!`
    iconPath = getIconPath('icon_red.png')
  }
  const isIconPathChanged = iconPath !== newIconPath
  if (isIconPathChanged) {
    log.info('Comparison of icon paths is ', iconPath, newIconPath)
    app.dock.setIcon(iconPath)
    new Notification({
      title: 'DeepFocus',
      body: message,
      icon: iconPath
    }).show()
  }
  return iconPath
}

export async function uploadLogs() {
  const logFilePath = log.transports.file.getFile().path;
  
  const formData = new FormData();
  const logStream = fs.createReadStream(logFilePath);

  formData.append('logFile', logStream);

  try {
    const response = await fetch(`${process.env.VITE_SERVER_URL_PROD}/api/v1/upload-log`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),  // Properly format the headers
    });

    if (!response.ok) {
      throw new Error(`Failed to upload logs, server responded with: ${response.status}`);
    }

    const data = await response.json();
    log.info('Log uploaded successfully:', data);
  } catch (error) {
    log.error('Failed to upload logs:', error);
  }
}