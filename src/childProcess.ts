import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process';
import {app} from 'electron'
import { AppIcon } from './types';


const iconsDir = path.join(app.getPath('userData'), 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function convertAndCacheIcon(appName: string, icnsPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use the app name and icon file name for a unique cached file name
    const fileName = `${appName.replace(/\.app$/, '')}-${path.basename(icnsPath, '.icns')}.png`;
    const outputPath = path.join(iconsDir, fileName);

    // If the icon already exists, use the cached version
    if (fs.existsSync(outputPath)) {
      return resolve(outputPath);
    }

    // Convert .icns to .png using the sips command
    const command = `sips -s format png "${icnsPath}" --out "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error converting ${icnsPath} to PNG:`, stderr);
        return reject(error);
      }
      console.log(`Converted and cached icon: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

export async function getApplicationIcons(): Promise<AppIcon[]> {
  const appFolders = [
    path.join(os.homedir(), 'Applications'), // User-specific Applications
    '/Applications' // System-wide Applications
  ];

  const appIcons: AppIcon[] = [];

  for (const appsFolder of appFolders) {
    if (!fs.existsSync(appsFolder)) continue;

    const apps = fs.readdirSync(appsFolder);
    console.log('Apps in', appsFolder, ':', apps);

    for (const appName of apps) {
      const appPath = path.join(appsFolder, appName);
      const resourcesPath = path.join(appPath, 'Contents', 'Resources');

      // Check if it's a valid .app bundle and if the Resources folder exists
      if (appName.endsWith('.app') && fs.existsSync(resourcesPath)) {
        // Get all files in the Resources folder
        const resourceFiles = fs.readdirSync(resourcesPath);
        // Find the .icns file
        const icnsFile = resourceFiles.find((file) => file.endsWith('.icns'));

        if (icnsFile) {
          const icnsFilePath = path.join(resourcesPath, icnsFile);

          try {
            // Convert and cache the icon, then get the output path
            const cachedIconPath = await convertAndCacheIcon(appName, icnsFilePath);
            appIcons.push({
              appName: appName.replace('.app', ''),
              iconPath: cachedIconPath // Use the cached PNG path
            });
          } catch (error) {
            console.error(`Failed to convert icon for ${appName}:`, error);
          }
        }
      } else if (fs.lstatSync(appPath).isDirectory()) {
        // Search subfolders like Utilities
        const subfolderIcons = await getApplicationIconsInSubfolder(appPath);
        appIcons.push(...subfolderIcons);
      }
    }
  }

  return appIcons;
}

// Helper function to search for app icons in subfolders (like Utilities)
async function getApplicationIconsInSubfolder(folderPath: string): Promise<AppIcon[]> {
  const appIcons: AppIcon[] = [];
  const apps = fs.readdirSync(folderPath);

  for (const appName of apps) {
    const appPath = path.join(folderPath, appName);
    const resourcesPath = path.join(appPath, 'Contents', 'Resources');

    // Check if it's a valid .app bundle and if the Resources folder exists
    if (appName.endsWith('.app') && fs.existsSync(resourcesPath)) {
      const resourceFiles = fs.readdirSync(resourcesPath);
      const icnsFile = resourceFiles.find((file) => file.endsWith('.icns'));

      if (icnsFile) {
        const icnsFilePath = path.join(resourcesPath, icnsFile);

        try {
          // Convert and cache the icon, then get the output path
          const cachedIconPath = await convertAndCacheIcon(appName, icnsFilePath);
          appIcons.push({
            appName: appName.replace('.app', ''),
            iconPath: cachedIconPath // Use the cached PNG path
          });
        } catch (error) {
          console.error(`Failed to convert icon for ${appName}:`, error);
        }
      }
    }
  }

  return appIcons;
}

// // Example usage
const icons = getApplicationIcons()
console.log('Application Icons:', icons)
