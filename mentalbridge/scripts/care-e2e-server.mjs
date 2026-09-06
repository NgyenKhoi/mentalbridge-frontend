import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const applicationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
)
const backendDirectory = resolve(
  applicationDirectory,
  '..',
  '..',
  'mentalbridge-backend',
)
const careDirectory = resolve(backendDirectory, 'care-service')
const carePom = resolve(careDirectory, 'pom.xml')
const wrapper = resolve(
  careDirectory,
  process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw',
)

const child = spawn(
  wrapper,
  [
    '-f',
    carePom,
    'spring-boot:test-run',
    '-Dspring-boot.run.arguments=--server.port=3202',
  ],
  {
    cwd: careDirectory,
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      JAVA_TOOL_OPTIONS: [process.env.JAVA_TOOL_OPTIONS, '-Duser.timezone=UTC']
        .filter(Boolean)
        .join(' '),
    },
    stdio: 'inherit',
  },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error(`[care-e2e] ${error.message}`)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
