import { notarize } from '@electron/notarize'
import { execSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

export default async function afterAllArtifactBuild(context) {
  const { artifactPaths } = context

  console.log('invoking afterAllArtifactBuild...')

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

  // Sign the DMG
  // Find the .pkg file from artifactPaths
  const dmgPath = artifactPaths.find((p) => p.endsWith('.dmg'))
  console.log('DMG Path is:', dmgPath)

  if (!dmgPath || !fs.existsSync(dmgPath)) {
    console.error('DMG file does not exist:', dmgPath)
  } else {
    try {
      // Sign the DMG
      execSync(
        `codesign --entitlements build/entitlements.mac.plist --force --deep --options runtime --sign "Developer ID Application: Timeo Williams (3Y4F3KTSJA)" "${dmgPath}"`,
        { stdio: 'inherit' }
      )
      console.log('Successfully signed the DMG.')

      // Notarize the signed PKG
      console.log('Notarizing the signed DMG...')
      await notarize({
        appBundleId: 'com.electron.deepfocus',
        appPath: dmgPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      })
      console.log('DMG Notarization complete.')

      // Staple the notarization to the signed DMG (turning off for now)
      // console.log('Stapling the notarization...')
      // execSync(`xcrun stapler staple "${dmgPath}"`, { stdio: 'inherit' })
      // console.log('Successfully stapled the notarization to the DMG.')

      // Verify the codesigning of the stapled PKG
      console.log('Verifying the codesigning of the stapled DMG...')
      execSync(`spctl -a -v --type install "${dmgPath}"`, { stdio: 'inherit' })
      console.log('Codesigning verification succeeded.')
    } catch (err) {
      console.error('DMG Notarization or Signing failed:', err)
    }
  }
}
