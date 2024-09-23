import { _electron as electron } from 'playwright'
import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { electronAPI } from '@electron-toolkit/preload'
import {
  clickMenuItemById,
  findLatestBuild,
  ipcMainCallFirstListener,
  ipcRendererCallFirstListener,
  parseElectronApp,
  ipcMainInvokeHandler,
  ipcRendererInvoke
} from 'electron-playwright-helpers'
import { User } from '../../src/main/types'

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

    await window.waitForSelector('span')
    const text = await window.$eval('span', (el) => el.textContent)
    expect(text).toBe('deep')
  })

  test(`"create new window" button exists`, async () => {
    expect(await window.$('#new-window')).toBeTruthy()
  })

  test('trigger IPC listener via main process', async () => {
    electronApp.evaluate(({ ipcMain }) => {
      ipcMain.emit('new-window')
    })
    const newPage = await electronApp.waitForEvent('window')
    expect(newPage).toBeTruthy()
    window = newPage
  })

  test('send IPC message from renderer', async () => {
    // evaluate this script in render process
    // requires webPreferences.nodeIntegration true and contextIsolation false
    await window.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('electron').ipcRenderer.send('new-window')
    })
    const newPage = await electronApp.waitForEvent('window')
    expect(newPage).toBeTruthy()
    expect(await newPage.title()).toBe('Window 4')
    window = newPage
  })

  test('receive synchronous data via ipcRendererCallFirstListener()', async () => {
    const data = await ipcRendererCallFirstListener(window, 'get-synchronous-data')
    expect(data).toBe('Synchronous Data')
  })

  test('receive asynchronous data via ipcRendererCallFirstListener()', async () => {
    const data = await ipcRendererCallFirstListener(window, 'get-asynchronous-data')
    expect(data).toBe('Asynchronous Data')
  })

  test('receive synchronous data via ipcMainCallFirstListener()', async () => {
    const data = await ipcMainCallFirstListener(electronApp, 'main-synchronous-data')
    expect(data).toBe('Main Synchronous Data')
  })

  test('receive asynchronous data via ipcMainCallFirstListener()', async () => {
    const data = await ipcMainCallFirstListener(electronApp, 'main-asynchronous-data')
    expect(data).toBe('Main Asynchronous Data')
  })

  test('should handle user login', async () => {
    // Interact with the login form
    await window.title()
    await window.click('xpath=/html/body/div/header/nav/a[2]', { delay: 1500 })
    await window.click('input[name="email"]')
    await window.fill('input[name="email"]', 'timeo.j.williams@gmail.com', { force: true })
    await window.click('input[name="password"]')
    await window.fill('input[name="password"]', 'test', { force: true })
    await window.click('button:has-text("Login")')

    // Validate login success by checking the URL
    await window.waitForURL('*/') // Wait for navigation to the root URL
    const currentURL = window.url()
    expect(currentURL).toBe('http://localhost:5173/') // Adjust the expected URL as needed
  })

  // test('should send data via IPC', async () => {

  //     // Simulate sending data from the renderer process to the main process
  //     await window.evaluate(() => {
  //       const user = {
  //         username: 'timeo.j.williams@gmail.com',
  //         language: 'English',
  //         country: 'USA',
  //         firstName: 'Timeo',
  //         lastName: 'Williams'
  //       }
  //       window.sendUserData(user) // Use the exposed API from the preload script
  //     })

  //     // Simulate listening on the main process for the IPC event
  //     const userData: User = await electronApp.evaluate(({ ipcMain }) => {
  //       return new Promise((resolve) => {
  //         ipcMain.on('send-user-data', (_, data) => resolve(data))
  //       })
  //     })

  //     expect(userData.username).toBe('timeo.j.williams@gmail.com')

  // })
})
