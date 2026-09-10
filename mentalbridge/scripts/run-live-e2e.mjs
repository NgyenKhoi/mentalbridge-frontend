import { spawn } from 'node:child_process'

if (!process.env.PLAYWRIGHT_BASE_URL) {
  console.error(
    'Live cross-stack E2E requires PLAYWRIGHT_BASE_URL pointing to an approved environment.',
  )
  process.exit(2)
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(command, ['playwright', 'test', ...process.argv.slice(2)], {
  env: { ...process.env, E2E_RUNTIME: 'live-cross-stack' },
  stdio: 'inherit',
  windowsHide: true,
})

child.once('error', (error) => {
  console.error(`[live-cross-stack-e2e] ${error.message}`)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
