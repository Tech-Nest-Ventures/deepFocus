import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerPKG } from '@electron-forge/maker-pkg'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

// Check if code signing certificate is available
function isCodeSigningAvailable(): boolean {
  try {
    const identity = 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)'
    execSync(`security find-identity -v -p codesigning | grep -q "${identity}"`, { stdio: 'ignore' })
    return true
  } catch {
    console.log('⚠️  Code signing certificate not found. Skipping code signing for local build.')
    return false
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Deep Focus',
    icon: './resources/icon.icns',
    executableName: 'Deep Focus',
    // Override main field for packaged app - Vite plugin outputs main.js at root of asar
    // This ensures the packaged app uses the correct entry point
    afterCopy: [
      (buildPath, electronVersion, platform, arch) => {
        const packageJsonPath = path.join(buildPath, 'package.json')
        try {
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            packageJson.main = 'main.js'
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
            console.log('Updated package.json main field to main.js')
          }
        } catch (error) {
          console.error('Failed to update package.json main field:', error)
        }
      }
    ],
    // Simplified afterExtract - only update if needed, with timeout protection
    afterExtract: [
      (buildPath, electronVersion, platform, arch) => {
        try {
          const packageJsonPath = path.join(buildPath, 'package.json')
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            if (packageJson.main && packageJson.main !== 'main.js') {
              packageJson.main = 'main.js'
              fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
              console.log('✓ Updated package.json main field after extraction')
            }
          }
        } catch (error) {
          // Silently fail - don't block the build
          console.warn('Warning: Could not update package.json after extraction:', error.message)
        }
      }
    ],
    // Only enable code signing if certificate is available
    osxSign: isCodeSigningAvailable()
      ? {
          identity: 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)',
          type: 'distribution',
          optionsForFile: () => ({
            entitlements: './build/entitlements.mac.plist',
            hardenedRuntime: true
          })
        }
      : undefined,
    osxNotarize: process.env.APPLE_ID && process.env.APPLE_ID_PASS && process.env.APPLE_TEAM_ID
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_ID_PASS,
          teamId: process.env.APPLE_TEAM_ID
        }
      : undefined,
    appBundleId: 'com.electron.deepfocus',
    extraResource: [
      'resources/icon.icns',
      'resources/icon_green.png',
      'resources/icon_red.png',
      'resources/icon_yellow.png',
      'resources/icon_blue.png',
      'resources/DOG_MEME.avif',
      'resources/trayIcon.png'
    ]
  },
  rebuildConfig: {},
  makers: [
    // For local builds, only use ZIP maker to avoid hanging
    // Full makers are used in CI/CD with 'npm run make'
    ...(process.env.CI === 'true' ? [
      new MakerSquirrel({}),
      new MakerZIP({}, ['darwin']),
      new MakerRpm({}),
      new MakerDeb({}),
      new MakerDMG({
        name: 'Deep Focus',
        icon: './resources/icon.icns',
        format: 'ULFO',
        overwrite: true,
        contents: (opts) => [
          { x: 130, y: 220, type: 'file', path: './out/Deep Focus-darwin-arm64/Deep Focus.app' },
          { x: 410, y: 220, type: 'link', path: '/Applications' }
        ]
      })
    ] : [
      // Minimal makers for local builds
      new MakerZIP({}, ['darwin'])
    ])
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main'
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts' // Path to Vite config for renderer process
        }
      ]
    }),
    // Temporarily disable FusesPlugin for local builds to avoid hanging
    // Re-enable for production builds
    ...(process.env.CI === 'true' ? [
      new FusesPlugin({
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true
      })
    ] : [])
  ]
}

export default config
