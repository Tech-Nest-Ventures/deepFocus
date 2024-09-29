import { _electron as electron } from 'playwright'
import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers'

test.describe('Electron App', () => {
  let electronApp: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    // Launch the Electron app
    const latestBuild = findLatestBuild('dist')
    const appInfo = parseElectronApp(latestBuild)

    electronApp = await electron.launch({
      args: [appInfo.main],
      executablePath: appInfo.executable,
      env: {
        ELECTRON_ENABLE_LOGGING: 'true'
      },
      recordVideo: {
        dir: '/test-results/videos',
        size: {
          width: 1200,
          height: 1200
        }
      }
    })

    electronApp.on('window', async (page) => {
      const filename = page.url()?.split('/').pop()
      console.log(`Window opened: ${filename}`)

      // capture errors
      page.on('pageerror', (error) => {
        console.error(error)
      })
      // capture console messages
      page.on('console', (msg) => {
        console.log(msg.text())
      })
    })
    window = await electronApp.firstWindow()
  })

  test.afterAll(async () => {
    // Close the Electron app
    await electronApp.close()
  })

  test('should load the main window', async () => {
    // Get the first window of the Electron app

    // Ensure the Electron app loads correctly
    const title = await window.title()
    expect(title).toBe('deepFocus')
  })
})
