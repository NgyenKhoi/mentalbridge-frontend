import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAM_ASSET, MAM_BEHAVIORS, MAM_LOOPING_BEHAVIORS } from './mam-contract'

const sha256 = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex')
const publicFile = (url: string) => join(process.cwd(), 'public', url)

describe('Mầm committed assets', () => {
  it('serve the frozen rig', () => {
    expect(sha256(publicFile(MAM_ASSET.src))).toBe(MAM_ASSET.sha256)
  })

  it('appends speaking as the 14th loop after the unchanged v0.4 order', () => {
    expect(MAM_BEHAVIORS.slice(0, 13)).toEqual([
      'idle',
      'curious',
      'listening',
      'thinking',
      'gentle',
      'explaining',
      'light_success',
      'celebrate_soft',
      'celebrate_hero',
      'rest',
      'sad',
      'happy',
      'sleep',
    ])
    expect(MAM_BEHAVIORS[13]).toBe('speaking')
    expect(MAM_LOOPING_BEHAVIORS).toContain('speaking')
  })

  it('serve the WASM of the installed runtime version', () => {
    const require = createRequire(import.meta.url)
    const runtimeDir = join(
      require.resolve('@rive-app/canvas-lite/package.json'),
      '..',
    )
    const { version } = require('@rive-app/canvas-lite/package.json') as {
      version: string
    }
    expect(MAM_ASSET.wasmUrl).toBe(`/mam/rive-lite-${version}.wasm`)
    expect(sha256(publicFile(MAM_ASSET.wasmUrl))).toBe(
      sha256(join(runtimeDir, 'rive.wasm')),
    )
  })
})
