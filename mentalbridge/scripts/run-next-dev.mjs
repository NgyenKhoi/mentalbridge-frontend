import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const runId = `${process.pid}-${Date.now()}`
const relativeDistDirectory = `.next-dev-runs/${runId}`
const distDirectory = resolve(root, relativeDistDirectory)
const relativeTsconfigPath = `.next-dev-configs/${runId}.json`
const tsconfigDirectory = resolve(root, '.next-dev-configs')
const tsconfigPath = resolve(root, relativeTsconfigPath)

if (relative(root, distDirectory).startsWith('..')) {
  throw new Error(
    'Refusing to use a Next.js dev directory outside the project.',
  )
}

mkdirSync(tsconfigDirectory, { recursive: true })
writeFileSync(
  tsconfigPath,
  `${JSON.stringify({ extends: '../tsconfig.json' }, null, 2)}\n`,
  'utf8',
)

const next = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', ...process.argv.slice(2)],
  {
    cwd: root,
    env: {
      ...process.env,
      NEXT_DEV_DIST_DIR: relativeDistDirectory,
      NEXT_DEV_TSCONFIG: relativeTsconfigPath,
    },
    stdio: 'inherit',
    windowsHide: true,
  },
)

const result = await new Promise((resolveCode, reject) => {
  next.once('error', reject)
  next.once('exit', (code) => resolveCode(code ?? 1))
})

try {
  rmSync(distDirectory, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 100,
  })
} catch {
  // The next run gets a new ignored directory if Windows retains a file lock.
}
try {
  rmSync(tsconfigPath, { force: true, maxRetries: 3, retryDelay: 100 })
} catch {
  // The next run gets a new ignored config if Windows retains a file lock.
}

process.exitCode = result
