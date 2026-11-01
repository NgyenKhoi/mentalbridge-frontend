import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/community-safety',
  outputDir: './test-results/mb693-browser',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.MB693_WEB_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
})
