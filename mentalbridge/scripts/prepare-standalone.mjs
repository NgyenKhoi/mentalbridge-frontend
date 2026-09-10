import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const applicationDirectory = process.cwd()
const standaloneDirectory = resolve(applicationDirectory, '.next', 'standalone')

await mkdir(resolve(standaloneDirectory, '.next'), { recursive: true })
await cp(
  resolve(applicationDirectory, '.next', 'static'),
  resolve(standaloneDirectory, '.next', 'static'),
  { recursive: true },
)
await cp(
  resolve(applicationDirectory, 'public'),
  resolve(standaloneDirectory, 'public'),
  { recursive: true },
)
