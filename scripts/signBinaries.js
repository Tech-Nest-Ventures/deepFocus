import { execSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'

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
      'Contents/Resources/app.asar.unpacked/node_modules/node-mac-permissions/build/Release/permissions.node'
    ),
    path.join(
      appPath,
      'Contents/Resources/app.asar.unpacked/node_modules/node-mac-permissions/build/node_gyp_bins/python3'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework'
    ), // Add Electron Framework
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libEGL.dylib'
    ),
    path.join(
      appPath,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib'
    )
  ]

  // Sign each binary
  for (const binary of binaries) {
    try {
      execSync(
        `codesign --entitlements build/entitlements.mac.plist --force --options runtime --sign "Developer ID Application: Timeo Williams (3Y4F3KTSJA)" "${binary}"`,
        {
          stdio: 'inherit'
        }
      )
      console.log(`Successfully signed ${binary}`)

      // Verify the codesigning
      execSync(`codesign -vvv --strict --verbose "${binary}"`, {
        stdio: 'inherit'
      })
      console.log(`Codesigning verification succeeded for ${binary}`)
    } catch (err) {
      console.error(`Failed to sign ${binary}`, err)
    }
  }

  // Now sign and verify the whole app
  try {
    console.log(`Signing the app at path: ${appPath}`)
    execSync(
      `codesign --entitlements build/entitlements.mac.plist --force --deep --options runtime --sign "Developer ID Application: Timeo Williams (3Y4F3KTSJA)" "${appPath}"`,
      {
        stdio: 'inherit'
      }
    )
    console.log(`Successfully signed the app: ${appName}`)

    // Verify the app's codesigning
    execSync(`codesign -vvv --deep --strict "${appPath}"`, {
      stdio: 'inherit'
    })
    console.log(`Codesigning verification succeeded for the app: ${appName}`)
  } catch (err) {
    console.error(`Failed to sign or verify the app: ${appName}`, err)
  }
}
