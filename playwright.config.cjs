// @ts-check
import { defineConfig } from '@playwright/test'
import path from 'path'

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
  workers: 3,
  fullyParallel: true,
  retries: 0,
  reporter: 'html'
})
