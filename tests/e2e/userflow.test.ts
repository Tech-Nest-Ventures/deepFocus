import { _electron as electron, ElectronApplication, Page } from 'playwright';  
import { test, expect } from '@playwright/test';
import { 
  clickMenuItemById,
  findLatestBuild, 
  ipcMainCallFirstListener, 
  ipcRendererCallFirstListener, 
  parseElectronApp,
  ipcMainInvokeHandler,
  ipcRendererInvoke
} from 'electron-playwright-helpers'

test.describe('Electron App', () => {
  let electronApp: ElectronApplication;

  test.beforeAll(async () => {
    // Launch the Electron app
    const latestBuild = findLatestBuild('dist')
    const appInfo = parseElectronApp(latestBuild)

    electronApp = await electron.launch({
      args: [appInfo.main],
      executablePath: appInfo.executable
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
  
  })

  test.afterAll(async () => {
    // Close the Electron app
    await electronApp.close();
  });

  test('should load the main window', async () => {
    // Get the first window of the Electron app
    const window = await electronApp.firstWindow();

    // Ensure the Electron app loads correctly
    const title = await window.title();
    expect(title).toBe('deepFocus');
  });

  test('should handle user login', async () => {
    const window = await electronApp.firstWindow();

    // Interact with the login form
    await window.fill('input[name="email"]', 'timeo.j.williams@gmail.com');
    await window.fill('input[name="password"]', 'test');
    await window.click('button:has-text("Login")');

    // Validate login success
    const logoutButton = window.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible();
  });

  test('should send data via IPC', async () => {
    const window = await electronApp.firstWindow();
  
    // Simulate sending data from the renderer process to the main process
    await window.evaluate(() => {
      window?.electron.ipcRenderer.send('send-user-data', { username: 'testuser' });
    });
  
    // Simulate listening on the main process for the IPC event
    const userData = await electronApp.evaluate(async ({ ipcMain }) => {
      return new Promise((resolve) => {
        ipcMain.on('send-user-data', (_, data) => resolve(data));
      });
    });
  
    expect(userData.username).toBe('testuser');
  });
});
