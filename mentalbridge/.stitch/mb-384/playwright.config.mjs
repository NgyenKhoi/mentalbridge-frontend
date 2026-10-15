import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*prototype.spec.mjs',
  outputDir: '../../test-results/mb-384-prototype',
  workers: 1,
  timeout: 45000,
  reporter: 'line',
  use: { browserName: 'chromium', channel: 'chrome', trace: 'off' },
})
