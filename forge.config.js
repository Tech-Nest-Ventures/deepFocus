// import { notarize } from '@electron/notarize';
// import dotenv from 'dotenv';

// dotenv.config(); // Load environment variables from .env file

// export default {
//   packagerConfig: {
//     icon: 'resources/icon.png',
//     entitlements: 'build/entitlements.mac.plist',
//     ignore: [
//       /^\/src/,
//       /(.eslintrc.json)|(.gitignore)|(electron.vite.config.ts)|(forge.config.cjs)|(tsconfig.*)/,
//     ],
//     osxSign: {
//       identity: "Developer ID Application: Timeo Williams (3Y4F3KTSJA)",
//       'hardened-runtime': true, // Required for notarization
//       entitlements: 'build/entitlements.mac.plist',
//       'entitlements-inherit': 'build/entitlements.mac.plist',
//       'gatekeeper-assess': false,
//       // Ensure all files, including binaries, are signed
//       optionsForFile: (filePath) => {
//         console.log('Signing file:', filePath);
//         if (filePath.endsWith('.node')) {
//           return {
//             entitlements: 'build/entitlements.mac.plist',
//             'hardened-runtime': true,
//           };
//         }
//       }
//     },
//     osxNotarize: {
//       tool: "notarytool",
//       appleApiKey: process.env.APPLE_API_KEY,
//       appleApiKeyId: process.env.APPLE_API_KEY_ID,
//       appleApiIssuer: process.env.APPLE_API_ISSUER,
//     },
//   },
//   rebuildConfig: {}, // Add any rebuild configurations if required
//   makers: [
//     {
//       name: '@electron-forge/maker-zip',
//       platforms: ['darwin'],
//     }
//   ],
//   hooks: {
//     // Notarize the app after it’s packaged
//     postPackage: async (forgeConfig, options) => {
//       if (process.platform === 'darwin') {
//         const appPath = options.appPaths[0];
//         console.log(`Notarizing app at ${appPath}`);

//         try {
//           await notarize({
//             appBundleId: 'com.deepfocus.app',
//             appPath: `${appPath}`,
//             appleApiKey: process.env.APPLE_API_KEY,
//             appleApiKeyId: process.env.APPLE_API_KEY_ID,
//             appleApiIssuer: process.env.APPLE_API_ISSUER,
//           });
//           console.log('Notarization complete.');
//         } catch (error) {
//           console.error('Error during notarization:', error);
//         }
//       }
//     },
//   },
// };
