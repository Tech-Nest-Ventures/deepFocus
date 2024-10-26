// packager.js
import { join } from 'path'
import packager from '@electron/packager'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import fs from 'fs-extra'
import { notarize } from '@electron/notarize'
import { signAsync } from '@electron/osx-sign'

// Define __dirname in an ES module environment
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
console.log('dirname:', __dirname)

async function copyRequiredFiles() {
  try {
    // Copy package.json
    await fs.copyFile('./package.json', 'out/package.json')
    console.log('Copied package.json to out/')

    // Copy .env
    await fs.copyFile('.env', 'out/.env')
    console.log('Copied .env to out/')

    // Copy resources folder
    await fs.copy('resources', 'out/resources')
    console.log('Copied resources folder to out/')

    // Copy build folder
    await fs.copy('build', 'out/build')
    console.log('Copied build folder to out/')

    // Update the main entry point in package.json
    const packageJsonPath = 'out/package.json'
    const packageJson = await fs.readJson(packageJsonPath)
    packageJson.main = 'main/main.js' // Update this to point to the actual built main file
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
    console.log('Updated main entry point in package.json')
    const nodeModulesPath = 'out/node_modules'
    if (!fs.existsSync(nodeModulesPath) || (await fs.readdir(nodeModulesPath)).length === 0) {
      await fs.copy('node_modules', nodeModulesPath)
      console.log('Copied node_modules to out/')
    } else {
      console.log('node_modules already exists in out/ and is not empty.')
    }
  } catch (err) {
    console.error('Error copying files:', err)
    throw err
  }
}

const signApp = async () => {
  const opts = {
    app: 'dist/Deep Focus-darwin-arm64/Deep Focus.app',
    platform: 'darwin', // Use "darwin" for non-Mac App Store distribution
    identity: 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)',
    hardenedRuntime: true,
    entitlements: join(__dirname, '../out/build/entitlements.mac.plist'),
    'entitlements-inherit': join(__dirname, '../out/build/entitlements.mac.plist'),
    'gatekeeper-assess': true,
    verbose: true
  }
  console.log('signing opts:', opts)

  await signAsync(opts)
    .then(function () {
      console.log('Application signed successfully')
    })
    .catch(function (err) {
      console.error('Error signing application:', err)
    })

  // Notarize the app

  // try {
  //   console.log('Notarizing the app...');
  //   await notarize({
  //     appBundleId: 'com.electron.deepfocus',
  //     appPath: 'dist/Deep Focus-darwin-arm64/Deep Focus.app',
  //     appleId: process.env.APPLE_ID,
  //     appleIdPassword: process.env.APPLE_ID_PASSWORD,
  //   })
  //     .then(async (result) => {
  //       if (result.status === 'error') {
  //         console.error('Notarization failed:', result.error);
  //       } else {
  //         console.log('Notarization succeeded:', result.notarized);
  //       }
  //     })
  //     .catch((error) => {
  //       console.error('Notarization failed:', error);
  //     });
  // }
  // catch (err) {
  //   console.error('Error notarizing the app:', err)
  // }
}

const packageApp = async () => {
  // Copy required files before packaging
  await copyRequiredFiles()
  console.log('Finished copying required files. Starting packaging...')

  try {
    await packager({
      dir: 'out', // Use the 'out' folder as the source directory
      out: 'dist', // Output directory for the packaged app
      overwrite: true,
      prune: true,
      asar: false, // Enable asar archiving for the packaged app
      appBundleId: 'com.electron.deepfocus', // Bundle identifier
      appCopyright: 'Copyright © 2024 Tech Nest Ventures LLC', // Copyright notice
      appCategoryType: 'public.app-category.productivity', // Mac App Store category
      icon: join(__dirname, '../out/resources/icon.icns'), // Correct path to the icon
      platform: 'darwin', // Target platform
      arch: 'arm64', // Architecture
      name: 'Deep Focus', // Product name
      extraResource: [
        'out/resources/.env', // Include the .env file
        'out/resources/icon_blue.png',
        'out/resources/icon_green.png',
        'out/resources/icon_red.png',
        'out/resources/icon_yellow.png',
        'out/resources/icon.png'
      ], // Extra resources must be an array of file paths
      electronVersion: '33.0.1',
      // Mac-specific options
      // osxSign: {
      //   identity: 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)',
      //   hardenedRuntime: true,
      //   entitlements: join(__dirname, '../out/build/entitlements.mac.plist'),
      //   'entitlements-inherit': join(__dirname, '../out/build/entitlements.mac.plist'),
      //   'gatekeeper-assess': true,
      //   'extend-info': {
      //     NSAppleEventsUsageDescription:
      //       'Please allow access to script browser applications to detect the current URL when triggering instant lookup.'
      //   },
      //   'dark-mode-support': true
      // },
      appVersion: '1.0.0', // Specify your app version here
      buildVersion: '1.0.0' // Optional: Specify the build version
    })

    console.log('Packaging completed successfully!')
  } catch (err) {
    console.error('Error during packaging:', err)
  }
}
;(async () => {
  await packageApp()
  await signApp()
})()
