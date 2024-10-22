// @ts-check
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    headless: false,
    viewport: null,
    use: {
      video: 'on'
    }
  },
  timeout: 120000,
  expect: {
    timeout: 60000
  },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'html'
})
