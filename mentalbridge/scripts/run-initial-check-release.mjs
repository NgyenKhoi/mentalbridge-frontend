import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const modes = new Set(['fixture', 'service', 'live'])
const mode = process.argv[2]

if (!modes.has(mode)) {
  console.error(
    'Usage: node scripts/run-initial-check-release.mjs <fixture|service|live> [Playwright arguments]',
  )
  process.exit(2)
}

const environment = { ...process.env, MB273_E2E_MODE: mode }
const applicationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
)

if (mode === 'fixture') {
  environment.CARE_E2E_MODE = 'fixture'
}

if (mode === 'service') {
  delete environment.CARE_E2E_MODE
  const backendDirectory = environment.CARE_BACKEND_DIRECTORY
    ? resolve(environment.CARE_BACKEND_DIRECTORY)
    : resolve(applicationDirectory, '..', '..', 'mentalbridge-backend')
  if (!existsSync(resolve(backendDirectory, 'care-service', 'pom.xml'))) {
    console.error(
      'Service mode requires CARE_BACKEND_DIRECTORY to point to the reviewed backend checkout.',
    )
    process.exit(2)
  }
  environment.CARE_BACKEND_DIRECTORY = backendDirectory
}

if (mode === 'live') {
  const required = [
    'PLAYWRIGHT_BASE_URL',
    'MB273_SYNTHETIC_EMAIL',
    'MB273_SYNTHETIC_PASSWORD',
    'MB273_FOREIGN_SYNTHETIC_EMAIL',
    'MB273_FOREIGN_SYNTHETIC_PASSWORD',
    'MB273_ENVIRONMENT_ID',
    'MB273_FRONTEND_COMMIT',
    'MB273_BACKEND_COMMIT',
  ]
  const missing = required.filter((name) => !environment[name])
  if (missing.length > 0 || environment.MB273_LIVE_APPROVED !== 'true') {
    console.error(
      `Live mode requires MB273_LIVE_APPROVED=true and these values: ${required.join(', ')}`,
    )
    process.exit(2)
  }

  const baseUrl = new URL(environment.PLAYWRIGHT_BASE_URL)
  const loopback = new Set(['127.0.0.1', 'localhost', '::1']).has(
    baseUrl.hostname,
  )
  if (baseUrl.protocol !== 'https:' && !loopback) {
    console.error(
      'Live mode requires HTTPS unless the target is loopback-only.',
    )
    process.exit(2)
  }
  if (baseUrl.username || baseUrl.password) {
    console.error('PLAYWRIGHT_BASE_URL must not contain credentials.')
    process.exit(2)
  }
}

console.log(
  `[mb-273] evidence=${mode === 'fixture' ? 'fixture-browser' : mode === 'service' ? 'service-integration' : 'live-cross-stack'}`,
)
if (mode === 'live') {
  console.log(
    `[mb-273] environment=${environment.MB273_ENVIRONMENT_ID} frontend=${environment.MB273_FRONTEND_COMMIT} backend=${environment.MB273_BACKEND_COMMIT}`,
  )
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(
  command,
  [
    'playwright',
    'test',
    'tests/e2e/initial-check-release.spec.ts',
    '--workers=1',
    '--reporter=line',
    ...process.argv.slice(3),
  ],
  {
    cwd: applicationDirectory,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
  },
)

child.once('error', (error) => {
  console.error(`[mb-273] ${error.message}`)
  process.exitCode = 1
})

child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
