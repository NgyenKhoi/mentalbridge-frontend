import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

if (!process.env.PLAYWRIGHT_BASE_URL) {
  console.error(
    'Live cross-stack E2E requires PLAYWRIGHT_BASE_URL pointing to an approved environment.',
  )
  process.exit(2)
}

for (const variable of [
  'E2E_USER_A_EMAIL',
  'E2E_USER_B_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_CONTENT_CONTROL_URL',
  'E2E_CONTENT_TEST_SECRET',
]) {
  if (!process.env[variable]) {
    console.error(
      `Live cross-stack E2E requires ${variable} for synthetic accounts.`,
    )
    process.exit(2)
  }
}

const readinessChecks = [
  ['Identity', process.env.E2E_IDENTITY_HEALTH_URL],
  ['Care', process.env.E2E_CARE_HEALTH_URL],
  ['Content', process.env.E2E_CONTENT_HEALTH_URL],
].filter(([, url]) => url)

async function waitForReadiness(name, url) {
  const deadline = Date.now() + 90_000
  let lastFailure = 'no response'

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (response.ok) return
      lastFailure = `HTTP ${response.status}`
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(`${name} did not become ready at ${url}: ${lastFailure}`)
}

try {
  for (const [name, url] of readinessChecks) {
    await waitForReadiness(name, url)
  }
} catch (error) {
  console.error(`[live-cross-stack-e2e] ${error.message}`)
  process.exit(1)
}

const playwrightCli = resolve('node_modules', '@playwright', 'test', 'cli.js')
const child = spawn(
  process.execPath,
  [playwrightCli, 'test', ...process.argv.slice(2)],
  {
    env: { ...process.env, E2E_RUNTIME: 'live-cross-stack' },
    stdio: 'inherit',
    windowsHide: true,
  },
)

child.once('error', (error) => {
  console.error(`[live-cross-stack-e2e] ${error.message}`)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
