import { execSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { notarize } from '@electron/notarize'

dotenv.config()

export default async function signBinaries(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  console.log('Signing Binaries for macOS...')

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  console.log('App Path is: ', appPath)
  console.log('App name is: ', appName)
  console.log('Team ID is: ', process.env.APPLE_TEAM_ID)

  const binaries = [
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libEGL.dylib'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libGLESv2.dylib'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib'
    ),
    path.join(appPath, 'Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt')
  ]

  const signBinary = (binary, extraFlags = '') => {
    try {
      execSync(
        `codesign --entitlements build/entitlements.mac.plist --force  ${extraFlags} --sign "Developer ID Application: Timeo Williams (3Y4F3KTSJA)" --timestamp "${binary}"`,
        { stdio: 'inherit' }
      )
      console.log(`Successfully signed ${binary}`)

      execSync(`codesign -vvv --strict --verbose "${binary}"`, { stdio: 'inherit' })
      console.log(`Codesigning verification succeeded for ${binary}`)
    } catch (err) {
      console.error(`Failed to sign ${binary}`, err)
    }
  }

  // Sign each binary
  for (const binary of binaries) {
    if (fs.existsSync(binary)) {
      if (binary.includes('ShipIt')) {
        // Special case for ShipIt: enable hardened runtime
        signBinary(binary, '--options runtime')
      } else {
        signBinary(binary)
      }
    } else {
      console.warn(`Binary not found: ${binary}`)
    }
  }

  // Now sign and verify the whole app
  try {
    console.log(`Signing the app at path: ${appPath}`)
    execSync(
      `codesign --entitlements build/entitlements.mac.plist --force --deep --options runtime --sign "Developer ID Application: Timeo Williams (3Y4F3KTSJA)" --timestamp "${appPath}"`,
      { stdio: 'inherit' }
    )
    console.log(`Successfully signed the app: ${appName}`)

    execSync(`codesign -vvv --deep --strict "${appPath}"`, { stdio: 'inherit' })
    console.log(`Codesigning verification succeeded for the app: ${appName}`)

    console.log('Notarizing the signed APP...')
    await notarize({
      appBundleId: 'com.electron.deepfocus',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })
  } catch (err) {
    console.error(`Failed to sign or verify the app: ${appName}`, err)
    return
  } finally {
    console.log('Exiting.')
    process.exit(1)
  }
}
