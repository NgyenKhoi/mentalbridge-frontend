import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  outputDir:
    process.env.REALTIME_E2E_OUTPUT_DIR ?? 'test-results/realtime-browser',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.REALTIME_E2E_BASE_URL ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
