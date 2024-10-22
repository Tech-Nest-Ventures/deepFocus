import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true, 
    name: 'Deep Focus',
    icon: './resources/icon.icns',
    osxSign: {
      identity: 'Developer ID Application: Timeo Williams (3Y4F3KTSJA)',
    },
    extraResource: [
      'resources/.env',
      'resources/icon.icns',
      'resources/icon.png',
      'resources/icon_green.png',
      'resources/icon_red.png',
      'resources/icon_yellow.png',
      'resources/icon_blue.png',
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({})
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts', // Main process entry point
          config: 'vite.main.config.ts', // Path to Vite config for main process
          target: 'main',
        },
        {
          entry: 'src/preload.ts', // Preload script entry point
          config: 'vite.preload.config.ts', // Path to Vite config for preload script
          target: 'preload',
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
          config: 'vite.renderer.config.mts', // Path to Vite config for renderer process
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
