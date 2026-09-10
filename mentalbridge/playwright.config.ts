import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'

const port = 3100
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const identityFixtureURL = 'http://127.0.0.1:3201'
const standaloneDirectory = resolve('.next', 'standalone')
const liveCrossStack = process.env.E2E_RUNTIME === 'live-cross-stack'
const useCareFixture = !liveCrossStack
const careServiceURL = 'http://127.0.0.1:3202'
const browserChannel =
  process.env.PLAYWRIGHT_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined
const inheritedEnvironment = Object.entries(process.env).reduce<
  Record<string, string>
>((environment, [key, value]) => {
  if (value !== undefined) environment[key] = value
  return environment
}, {})

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/playwright',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [process.env.CI ? 'line' : 'html', { open: 'never' }],
    ['./scripts/fail-on-unexpected-skip.mjs'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: browserChannel },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          name: 'identity-fixture',
          command: 'node scripts/identity-e2e-server.mjs',
          url: `${identityFixtureURL}/health`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
        useCareFixture
          ? {
              name: 'care-fixture',
              command: 'node scripts/identity-e2e-server.mjs',
              url: `${careServiceURL}/health`,
              env: {
                ...inheritedEnvironment,
                IDENTITY_E2E_PORT: '3202',
              },
              reuseExistingServer: false,
              timeout: 30_000,
            }
          : {
              name: 'care-service',
              command: 'node scripts/care-e2e-server.mjs',
              url: `${careServiceURL}/actuator/health`,
              reuseExistingServer: false,
              timeout: 180_000,
            },
        {
          name: 'mentalbridge-production-standalone',
          command: 'node server.js',
          cwd: standaloneDirectory,
          url: baseURL,
          env: {
            ...inheritedEnvironment,
            IDENTITY_API_BASE_URL: identityFixtureURL,
            CARE_API_BASE_URL: careServiceURL,
            CARE_API_TIMEOUT_MS: '3000',
            CARE_QUESTIONNAIRE_LOCALE: 'vi-VN',
            CONTENT_SERVICE_URL: identityFixtureURL,
            HOSTNAME: '127.0.0.1',
            PORT: String(port),
          },
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
})
