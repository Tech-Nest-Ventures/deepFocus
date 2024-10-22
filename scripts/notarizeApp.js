// notarizeApp.js
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { notarize } from '@electron/notarize'

// Define __dirname in an ES module environment
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function notarizeApp() {
  const appPath = join(__dirname, '../dist/Deep Focus-darwin-arm64/Deep Focus.app') // Path to the .app file
  console.log('staring notarization')
  console.log(process.env.appleId)
  console.log('appPath', appPath)
  fs.readFileSync(appPath)
  try {
    await notarize({
      appBundleId: 'com.electron.deepfocus',
      appPath: appPath,
      appleId: process.env.APPLE_ID, // Your Apple ID (used for notarization)
      appleIdPassword: process.env.APPLE_ID_PASSWORD, // Your app-specific password
      teamId: '3Y4F3KTSJA' // Your Apple Developer Team ID
    })

    console.log('Notarization completed successfully!')
  } catch (err) {
    console.error('Error during notarization:', err)
  }
}

notarizeApp()
