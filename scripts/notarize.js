import { notarize } from '@electron/notarize'
import { execSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

export default async function afterAllArtifactBuild(context) {
  const { artifactPaths } = context

  console.log('invoking afterAllArtifactBuild...')
  console.log('is there .app', context)
  /*
  // Find the .pkg file from artifactPaths
  const pkgPath = artifactPaths.find((p) => p.endsWith('.pkg'))
  console.log('PKG Path is:', pkgPath)

  if (!pkgPath || !fs.existsSync(pkgPath)) {
    console.error('PKG file does not exist:', pkgPath)
  } else {
    // Create a new path for the signed PKG
    const signedPkgPath = path.join(path.dirname(pkgPath), 'Deep Focus-1.2.0-arm64-signed.pkg')

    try {
      // Sign the PKG using productsign
      execSync(
        `productsign --sign "Developer ID Installer: Timeo Williams (3Y4F3KTSJA)" "${pkgPath}" "${signedPkgPath}"`,
        { stdio: 'inherit' }
      )
      console.log('Successfully signed the PKG.')

      // Notarize the signed PKG
      console.log('Notarizing the signed PKG...')
      await notarize({
        appBundleId: 'com.electron.deepfocus',
        appPath: signedPkgPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      })
      console.log('PKG Notarization complete.')

      // Staple the notarization to the signed PKG (turning off for now)
      // console.log('Stapling the notarization...')
      // execSync(`xcrun stapler staple "${signedPkgPath}"`, { stdio: 'inherit' })
      // console.log('Successfully stapled the notarization to the PKG.')

      // Verify the codesigning of the stapled PKG
      console.log('Verifying the codesigning of the stapled PKG...')
      execSync(`spctl -a -v --type install "${signedPkgPath}"`, { stdio: 'inherit' })
      console.log('Codesigning verification succeeded.')
    } catch (err) {
      console.error('PKG Notarization or Signing failed:', err)
    }
  }
    */

  // Sign the app
  const appPath = '/Users/timeo/deepFocus/deepWork/dist/mac-arm64/Deep Focus.app'
  console.log('app Path is:', appPath)

  if (!appPath || !fs.existsSync(appPath)) {
    console.error('APP file does not exist:', appPath)
  } else {
    try {
      // Sign the APP
      // execSync(
      //   `codesign --entitlements build/entitlements.mac.plist --force  --timestamp --deep --options runtime --sign "Developer ID Application: Timeo Williams (3Y4F3KTSJA)" "${appPath}"`,
      //   { stdio: 'inherit' }
      // )
      // console.log('Successfully signed the APP.')

      // Notarize the signed app
      console.log('Notarizing the signed APP...')
      await notarize({
        appBundleId: 'com.electron.deepfocus',
        appPath: appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      })
      // console.log('APP Notarization complete.')

      // Staple the notarization to the signed APP (turning off for now)
      // console.log('Stapling the notarization...')
      // execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' })
      // console.log('Successfully stapled the notarization to the APP.')

      // Verify the codesigning of the stapled PKG
      // console.log('Verifying the codesigning of the stapled APP...')
      // execSync(`spctl -a -v --type install "${appPath}"`, { stdio: 'inherit' })
      //console.log('Codesigning verification succeeded.')
    } catch (err) {
      console.error('APP Notarization or Signing failed:', err)
    }
  }
}
