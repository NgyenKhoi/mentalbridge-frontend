import { defineConfig, devices } from '@playwright/test'

const port = 3100
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const identityFixtureURL = 'http://127.0.0.1:3201'
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
  reporter: process.env.CI ? 'line' : 'html',
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
        {
          name: 'mentalbridge-frontend',
          command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
          url: baseURL,
          env: {
            ...inheritedEnvironment,
            IDENTITY_API_BASE_URL: identityFixtureURL,
          },
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
})
