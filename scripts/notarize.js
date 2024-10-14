import { notarize } from '@electron/notarize'
import { execSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  console.log('Notarizing macOS app...')

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  console.log('appPath is ', appPath)
  console.log('App name is', appName)
  console.log('teamID is ', process.env.APPLE_TEAM_ID)

  const binaries = [
    path.join(
      appPath,
      'Contents/Resources/app.asar.unpacked/node_modules/node-mac-permissions/build/Release/permissions.node'
    ),
    path.join(
      appPath,
      'Contents/Resources/app.asar.unpacked/node_modules/@deepfocus/get-windows/main'
    ),
    path.join(
      appPath,
      'Contents/Resources/app.asar.unpacked/node_modules/node-mac-permissions/build/node_gyp_bins/python3'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libEGL.dylib'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib'
    )
  ]

  // Sign each binary using the correct command
  for (const binary of binaries) {
    try {
      // Surround the path with quotes to handle spaces in file paths
      execSync(
        `codesign --force --deep --sign "Apple Distribution: Timeo Williams (3Y4F3KTSJA)" "${binary}"`,
        {
          stdio: 'inherit'
        }
      )
      console.log(`Successfully signed ${binary}`)
    } catch (err) {
      console.error(`Failed to sign ${binary}`, err)
    }
  }

  // Notarize the app
  try {
    await notarize({
      appBundleId: 'com.electron.deepfocus',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })
    console.log('Notarization complete.')
  } catch (err) {
    console.error('Notarization failed:', err)
  }
}
