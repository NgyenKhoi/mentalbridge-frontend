import { describe, expect, it } from 'vitest'

import {
  MAM_BEHAVIORS,
  MAM_LOOPING_BEHAVIORS,
  MAM_ONE_SHOT_MS,
  MAM_ONE_SHOTS,
  mamAssetServes,
} from './mam-contract'
import { MAM_INTENTS, type MamStep } from './mam-orchestrator'
import { CINEMATIC_MIN_MS, MAM_VARIATIONS, TIER_MAX_MS } from './mam-variations'

const v08Ids = new Set(MAM_BEHAVIORS.slice(28))
const stateOf = (step: MamStep) =>
  'oneShot' in step ? step.oneShot : 'loop' in step ? step.loop : null

describe('Mầm variation catalogue', () => {
  it('has unique ids, every intent, and about a dozen new looks', () => {
    const ids = MAM_VARIATIONS.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const intent of MAM_INTENTS)
      expect(MAM_VARIATIONS.some((v) => v.intent === intent)).toBe(true)
    const added = [
      'parachute',
      'plant_pot',
      'spin',
      'tiny_dance',
      'clap',
      'cheer_sign',
      'thumbs_up',
      'fist_pump',
      'sit_hug',
      'umbrella',
      'butterfly',
      'blanket_tuck',
    ]
    for (const id of added) expect(ids).toContain(id)
    // The existing looks are kept under the intents the brief names.
    for (const id of [
      'airplane',
      'happy',
      'celebrate_soft',
      'celebrate_hero',
      'nod',
      'gentle',
      'look_around',
      'stretch',
      'scratch',
      'drowsy_sleep',
    ])
      expect(ids).toContain(id)
  })

  it('keeps each tier inside its length: micro to 2 s, expressive to 5 s, cinematic 5 to 9 s', () => {
    for (const v of MAM_VARIATIONS) {
      expect(v.durationMs, v.id).toBeGreaterThan(0)
      expect(v.durationMs, v.id).toBeLessThanOrEqual(TIER_MAX_MS[v.tier])
      if (v.tier === 'cinematic')
        expect(v.durationMs, v.id).toBeGreaterThanOrEqual(CINEMATIC_MIN_MS)
    }
  })

  it('lets only micro and expressive looks onto QUIET routes; cinematic ones are FULL only (welcome only)', () => {
    for (const v of MAM_VARIATIONS) {
      if (v.tier === 'cinematic') {
        expect(v.modes, v.id).toEqual(['full'])
        expect(v.intent, v.id).toBe('WELCOME')
      }
    }
    // Travel and props that would cover page text stay on FULL routes.
    for (const id of [
      'spin',
      'tiny_dance',
      'cheer_sign',
      'butterfly',
      'umbrella',
    ])
      expect(MAM_VARIATIONS.find((v) => v.id === id)!.modes).toEqual(['full'])
  })

  it('the idle glance and every REST look opt out of growing; the others in the tier list grow', () => {
    for (const id of ['look_around', 'drowsy_sleep', 'blanket_tuck']) {
      const v = MAM_VARIATIONS.find((x) => x.id === id)!
      expect(v.grow, id).toBe(false)
    }
    for (const id of [
      'spin',
      'tiny_dance',
      'clap',
      'celebrate_soft',
      'happy',
    ]) {
      const v = MAM_VARIATIONS.find((x) => x.id === id)!
      expect(v.tier, id).toBe('expressive')
      expect(v.grow, id).not.toBe(false)
    }
    // The sign reads on every screen now (a bigger board and text on the compact dock).
    expect(MAM_VARIATIONS.find((x) => x.id === 'cheer_sign')!.minViewport).toBe(
      0,
    )
  })

  it('grows the looks seen at the dock: spin, dance, clap, thumbs up, fist pump, sit hug, soft celebration, happy', () => {
    const expressive = MAM_VARIATIONS.filter(
      (v) => v.tier === 'expressive',
    ).map((v) => v.id)
    for (const id of [
      'spin',
      'tiny_dance',
      'clap',
      'thumbs_up',
      'fist_pump',
      'sit_hug',
      'celebrate_soft',
      'happy',
    ])
      expect(expressive, id).toContain(id)
    for (const id of ['nod', 'cheer_sign', 'listening'])
      expect(expressive, id).not.toContain(id)
  })

  it('declares minAsset v08 for exactly the looks that use a state with id 28 or up', () => {
    for (const v of MAM_VARIATIONS) {
      const uses = v.steps.some((step) => {
        const state = stateOf(step)
        return state !== null && v08Ids.has(state)
      })
      // A v0.8 scene (the parachute) is backed by `hang`, so the same rule holds; the pot by `pop_up`.
      if (uses) expect(v.minAsset, v.id).toBe('v08')
      if (v.minAsset === 'v08')
        expect(uses || v.steps.some((s) => 'prop' in s), v.id).toBe(true)
    }
    expect(mamAssetServes('v08', 'v07')).toBe(false)
    expect(mamAssetServes('v07', 'v07')).toBe(true)
    expect(mamAssetServes('v08', 'v08')).toBe(true)
  })

  it('only uses states the contract knows, as the right kind, and one-shots fit their asset length', () => {
    for (const v of MAM_VARIATIONS) {
      for (const step of v.steps) {
        if ('oneShot' in step)
          expect(MAM_ONE_SHOTS as readonly string[], v.id).toContain(
            step.oneShot,
          )
        if ('loop' in step && step.loop !== null)
          expect(MAM_LOOPING_BEHAVIORS as readonly string[], v.id).toContain(
            step.loop,
          )
        expect(step.at, v.id).toBeGreaterThanOrEqual(0)
        expect(step.at, v.id).toBeLessThanOrEqual(v.durationMs)
        if ('oneShot' in step)
          expect(
            step.at + MAM_ONE_SHOT_MS[step.oneShot],
            v.id,
          ).toBeLessThanOrEqual(v.durationMs + 100)
      }
    }
  })

  it('removes every prop it shows, and no variation leaves a loop it set', () => {
    for (const v of MAM_VARIATIONS) {
      const shown = new Set(
        v.steps.flatMap((s) => ('prop' in s && s.show ? [s.prop] : [])),
      )
      const hidden = new Set(
        v.steps.flatMap((s) => ('prop' in s && !s.show ? [s.prop] : [])),
      )
      for (const prop of shown)
        expect(hidden.has(prop), `${v.id}:${prop}`).toBe(true)
      const concealed = v.steps.filter((s) => 'conceal' in s)
      if (concealed.length)
        expect(concealed.at(-1)).toMatchObject({ conceal: false })
    }
  })

  it('a celebration answers each of its three grades', () => {
    for (const grade of ['light', 'soft', 'hero'] as const)
      expect(
        MAM_VARIATIONS.some(
          (v) => v.intent === 'CELEBRATE' && v.grade === grade,
        ),
        grade,
      ).toBe(true)
  })
})
