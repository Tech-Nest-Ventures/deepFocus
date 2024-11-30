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

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Deep Focus',
    icon: './resources/icon.icns',
    osxSign: {
      identity: 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)',
      type: 'distribution',
      provisioningProfile: '/Users/timeo/Desktop/Deep Focus/deepWork/distribution.provisionprofile'
    },
    appBundleId: 'com.electron.deepfocus',
    extraResource: [
      'resources/.env',
      'resources/icon.icns',
      'resources/icon.png',
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
      appPath: './out/Deep Focus-darwin-arm64/Deep Focus.app',
      name: 'Deep Focus',
      icon: './resources/icon.icns',
      format: 'ULFO',
      overwrite: true,
      contents: (opts) => [
        { x: 130, y: 220, type: 'file', path: opts.appPath },
        { x: 410, y: 220, type: 'link', path: '/Applications' }
      ]
    }),
    new MakerPKG({
      name: 'Deep Focus',
      identity: 'Developer ID Installer: Timeo Williams (3Y4F3KTSJA)'
    })
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
        },
        {
          entry: 'src/worker.ts',
          config: 'vite.worker.config.ts',
          target: 'main'
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
