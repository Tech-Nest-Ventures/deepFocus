import path from 'path'
import fs from 'fs'
import os from 'os'

const appName = 'Deep Focus' // Replace with your actual app name
const appDataPath = path.join(os.homedir(), 'Library', 'Application Support', appName)
console.log(appDataPath) // /Users/timeo/Library/Application Support/deepfocus

fs.rm(appDataPath, { recursive: true, force: true }, (err) => {
  if (err) {
    console.error('Failed to delete app data:', err)
  } else {
    console.log('App data deleted successfully.')
  }
})
