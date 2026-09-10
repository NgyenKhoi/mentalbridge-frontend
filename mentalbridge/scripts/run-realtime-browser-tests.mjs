import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const cacheDirectory = resolve(
  root,
  '.vite-realtime-e2e',
  `${process.pid}-${Date.now()}`,
)
const outputDirectory = resolve(
  root,
  '.playwright-realtime-e2e',
  `${process.pid}-${Date.now()}`,
)
const server = await createServer({
  root,
  cacheDir: cacheDirectory,
  logLevel: 'error',
  resolve: {
    alias: { '@': root },
  },
  server: { host: '127.0.0.1', port: 0, strictPort: true },
})

let result = 1
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') {
    throw new Error('Vite Browser E2E server did not expose a TCP port.')
  }
  const baseUrl = `http://127.0.0.1:${address.port}`
  const response = await fetch(`${baseUrl}/tests/browser-harness/`)
  if (!response.ok) {
    throw new Error(
      `Vite Browser E2E harness returned HTTP ${response.status}.`,
    )
  }

  const playwright = spawn(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'playwright.realtime.config.ts',
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        REALTIME_E2E_BASE_URL: baseUrl,
        REALTIME_E2E_OUTPUT_DIR: outputDirectory,
      },
      stdio: 'inherit',
      windowsHide: true,
    },
  )
  result = await new Promise((resolveCode) =>
    playwright.once('exit', (code) => resolveCode(code ?? 1)),
  )
} finally {
  await server.close()
  try {
    rmSync(cacheDirectory, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    })
  } catch {
    // Every run uses a new ignored cache path if Windows retains a temporary lock.
  }
  try {
    rmSync(outputDirectory, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    })
  } catch {
    // A new ignored output path prevents a retained Playwright lock blocking tests.
  }
}

process.exitCode = result
