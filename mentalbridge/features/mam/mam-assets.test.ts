import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MAM_ASSET,
  MAM_BEHAVIORS,
  MAM_LOOPING_BEHAVIORS,
  MAM_ONE_SHOTS,
  MAM_ONE_SHOT_MS,
} from './mam-contract'

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

  it('keeps the v0.6 asset inside the 160 KB budget and drops the old file', () => {
    expect(MAM_ASSET.src).toBe('/mam/mam-v06.riv')
    expect(statSync(publicFile(MAM_ASSET.src)).size).toBeLessThanOrEqual(
      160 * 1024,
    )
    expect(existsSync(publicFile('/mam/mam-v05.riv'))).toBe(false)
  })

  it('appends the v0.6 states in the documented order after the unchanged v0.5 IDs', () => {
    expect(MAM_BEHAVIORS.slice(14)).toEqual([
      'drowsy',
      'wake',
      'giggle',
      'tickled',
      'dangle',
      'nod',
      'stretch',
      'look_around',
      'scratch',
      'point',
    ])
    // Only dangle loops; every other new state is a one-shot with its own duration.
    expect(MAM_LOOPING_BEHAVIORS).toContain('dangle')
    const added = MAM_BEHAVIORS.slice(14).filter((b) => b !== 'dangle')
    expect(MAM_ONE_SHOTS.slice(3)).toEqual(added)
    for (const kind of MAM_ONE_SHOTS)
      expect(MAM_ONE_SHOT_MS[kind]).toBeGreaterThan(0)
    expect(MAM_LOOPING_BEHAVIORS).not.toContain('nod')
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
