import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const host = '127.0.0.1'
const identityPort = 3201
const carePort = 3202
const frontendPort = 3100
const standaloneDirectory = resolve('.next', 'standalone')

const inheritedEnvironment = Object.entries(process.env).reduce(
  (environment, [key, value]) => {
    if (value !== undefined) environment[key] = value
    return environment
  },
  {},
)

const children = []
let cleaningUp = false

function start(command, args, environment, cwd = process.cwd()) {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  })
  child.once('error', (error) => {
    console.error(`[e2e] ${command}: ${error.message}`)
  })
  children.push(child)
  return child
}

async function waitFor(url, label, child) {
  const deadline = Date.now() + 120_000
  let lastError
  let childExit
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      childExit = { code, signal }
      resolve()
    })
  })

  while (Date.now() < deadline) {
    if (childExit) {
      throw new Error(
        `${label} exited before becoming ready (code=${childExit.code ?? 'null'}, signal=${childExit.signal ?? 'none'})`,
      )
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`received HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, 250)),
      exited,
    ])
  }

  throw new Error(
    `${label} did not become ready: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
  )
}

function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn(
        'taskkill',
        ['/pid', String(child.pid), '/T', '/F'],
        {
          stdio: 'ignore',
          windowsHide: true,
        },
      )
      killer.once('exit', resolve)
      killer.once('error', resolve)
    })
  }

  child.kill('SIGTERM')
  return new Promise((resolve) => child.once('exit', resolve))
}

async function cleanup() {
  if (cleaningUp) return
  cleaningUp = true
  await Promise.all([...children].reverse().map(terminate))
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await cleanup()
    process.exit(130)
  })
}

async function run() {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const playwright = start(
      command,
      ['playwright', 'test', ...process.argv.slice(2)],
      {
        ...inheritedEnvironment,
      },
    )
    const code = await new Promise((resolve) =>
      playwright.once('exit', resolve),
    )
    process.exitCode = code ?? 1
    return
  }

  const identityFixture = start(
    'node',
    ['scripts/identity-e2e-server.mjs'],
    inheritedEnvironment,
  )
  await waitFor(
    `http://${host}:${identityPort}/health`,
    'Identity fixture',
    identityFixture,
  )

  const careFixture = start('node', ['scripts/identity-e2e-server.mjs'], {
    ...inheritedEnvironment,
    IDENTITY_E2E_PORT: String(carePort),
  })
  await waitFor(
    `http://${host}:${carePort}/health`,
    'Care fixture',
    careFixture,
  )

  const frontend = start(
    'node',
    ['server.js'],
    {
      ...inheritedEnvironment,
      IDENTITY_API_BASE_URL: `http://${host}:${identityPort}`,
      CARE_API_BASE_URL: `http://${host}:${carePort}`,
      CARE_API_TIMEOUT_MS: '3000',
      CARE_QUESTIONNAIRE_LOCALE: 'vi-VN',
      CONTENT_SERVICE_URL: `http://${host}:${identityPort}`,
      HOSTNAME: host,
      PORT: String(frontendPort),
    },
    standaloneDirectory,
  )
  await waitFor(
    `http://${host}:${frontendPort}`,
    'Frontend standalone server',
    frontend,
  )

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const playwright = start(
    command,
    ['playwright', 'test', ...process.argv.slice(2)],
    {
      ...inheritedEnvironment,
      PLAYWRIGHT_BASE_URL: `http://${host}:${frontendPort}`,
    },
  )
  const code = await new Promise((resolve) => playwright.once('exit', resolve))
  process.exitCode = code ?? 1
}

try {
  await run()
} finally {
  await cleanup()
}
