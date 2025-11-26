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
    afterExtract: [
      (buildPath, electronVersion, platform, arch) => {
        // Also update package.json after asar extraction if needed
        const packageJsonPath = path.join(buildPath, 'package.json')
        try {
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
            if (packageJson.main !== 'main.js') {
              packageJson.main = 'main.js'
              fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
              console.log('Updated package.json main field after extraction')
            }
          }
        } catch (error) {
          console.error('Failed to update package.json main field after extraction:', error)
        }
      }
    ],
    osxSign: {
      identity: 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)',
      type: 'distribution',
      optionsForFile: () => ({
        entitlements: './build/entitlements.mac.plist',
        hardenedRuntime: true
      })
    },
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
    }),
    // Temporarily disabled until we have the correct certificate
    // new MakerPKG({
    //   name: 'Deep Focus',
    //   identity: 'Developer ID Installer: Timeo Williams (3Y4F3KTSJA)'
    // })
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
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
}

export default config
