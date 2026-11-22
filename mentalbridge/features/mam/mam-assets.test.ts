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

  it('serves v0.7 inside the V2 budget and keeps v0.6 for rollback', () => {
    expect(MAM_ASSET.src).toBe('/mam/mam-v07.riv')
    // V1 froze 160 KB; V2 (docs/ADR_MAM_RIVE_V2_CONTRACT.md) raises it to 180 KB for the four new states.
    expect(statSync(publicFile(MAM_ASSET.src)).size).toBeLessThanOrEqual(
      180 * 1024,
    )
    expect(existsSync(publicFile('/mam/mam-v06.riv'))).toBe(true)
    expect(sha256(publicFile('/mam/mam-v06.riv'))).toBe(
      '6abc31b75f180fa58506e2ff1b48f9322818fe72652b20e8df9c03a0992ad644',
    )
    expect(existsSync(publicFile('/mam/mam-v05.riv'))).toBe(false)
  })

  it('appends the v0.7 states after the unchanged 24 ids', () => {
    expect(MAM_BEHAVIORS).toHaveLength(28)
    expect(MAM_BEHAVIORS.slice(24)).toEqual([
      'pilot',
      'pilot_wave',
      'hop_down',
      'wave',
    ])
    expect(MAM_BEHAVIORS[23]).toBe('point')
    // pilot and pilot_wave are host-set loops; hop_down and wave are one-shots.
    expect(MAM_LOOPING_BEHAVIORS).toEqual(
      expect.arrayContaining(['pilot', 'pilot_wave']),
    )
    expect(MAM_ONE_SHOTS.slice(-2)).toEqual(['hop_down', 'wave'])
    expect(MAM_ONE_SHOT_MS.hop_down).toBeGreaterThanOrEqual(900)
    expect(MAM_ONE_SHOT_MS.wave).toBeGreaterThanOrEqual(1400)
  })

  it('appends the v0.6 states in the documented order after the unchanged v0.5 IDs', () => {
    expect(MAM_BEHAVIORS.slice(14, 24)).toEqual([
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
    const added = MAM_BEHAVIORS.slice(14, 24).filter((b) => b !== 'dangle')
    expect(MAM_ONE_SHOTS.slice(3, 12)).toEqual(added)
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
