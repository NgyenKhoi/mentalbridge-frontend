import { describe, expect, it } from 'vitest'

import { MAM_BEHAVIORS, type MamLoopingBehavior } from './mam-contract'
import {
  createMamControls,
  MamContractError,
  type MamViewModelPort,
} from './mam-controls'

function enumValue(value: string) {
  const listeners = new Set<() => void>()
  return {
    value,
    listeners,
    on: (cb: () => void) => void listeners.add(cb),
    off: (cb?: () => void) =>
      void (cb ? listeners.delete(cb) : listeners.clear()),
  }
}

function fakeViewModel(missing?: string) {
  const values = {
    behaviorState: enumValue('idle'),
    celebrationTier: enumValue('none'),
    attentionDirection: { value: 0 },
    reducedMotion: { value: false },
    isVisible: { value: true },
  }
  const fired: string[] = []
  const trigger = (path: string) => ({ trigger: () => fired.push(path) })
  const pick = <T>(path: string, value: T) => (path === missing ? null : value)
  const port: MamViewModelPort = {
    enum: (path) =>
      pick(path, values[path as 'behaviorState' | 'celebrationTier'] ?? null),
    number: (path) =>
      pick(
        path,
        path === 'attentionDirection' ? values.attentionDirection : null,
      ),
    boolean: (path) =>
      pick(path, values[path as 'reducedMotion' | 'isVisible'] ?? null),
    trigger: (path) =>
      pick(
        path,
        path === 'playOnce' || path === 'returnToDock' ? trigger(path) : null,
      ),
  }
  return { port, values, fired }
}

describe('createMamControls', () => {
  it('fails closed when the asset lacks a frozen property', () => {
    for (const property of ['behaviorState', 'playOnce', 'isVisible']) {
      expect(() => createMamControls(fakeViewModel(property).port)).toThrow(
        MamContractError,
      )
    }
  })

  it('sets looping states but never starts a one-shot from a plain set', () => {
    const { port, values, fired } = fakeViewModel()
    const controls = createMamControls(port)

    controls.setBehavior('explaining')
    expect(values.behaviorState.value).toBe('explaining')

    controls.setBehavior('celebrate_hero' as MamLoopingBehavior)
    controls.setBehavior('sad' as MamLoopingBehavior)
    expect(values.behaviorState.value).toBe('explaining')
    expect(fired).toEqual([])
  })

  it('plays a one-shot only on command, with the tier cleared first', () => {
    const { port, values, fired } = fakeViewModel()
    values.celebrationTier.value = 'hero'
    const controls = createMamControls(port)

    expect(controls.playOnce('celebrate_hero')).toBe(true)
    expect(values.behaviorState.value).toBe('celebrate_hero')
    expect(values.celebrationTier.value).toBe('none')
    expect(fired).toEqual(['playOnce'])
  })

  it('refuses one-shots while hidden or in reduced motion', () => {
    const { port, fired } = fakeViewModel()
    const controls = createMamControls(port)

    controls.setReducedMotion(true)
    expect(controls.playOnce('light_success')).toBe(false)
    controls.setReducedMotion(false)
    controls.setVisible(false)
    expect(controls.playOnce('celebrate_soft')).toBe(false)
    expect(fired).toEqual([])
  })

  it('clamps attention and maps non-finite input to centre', () => {
    const { port, values } = fakeViewModel()
    const controls = createMamControls(port)

    controls.setAttention(4)
    expect(values.attentionDirection.value).toBe(1)
    controls.setAttention(-2)
    expect(values.attentionDirection.value).toBe(-1)
    controls.setAttention(Number.NaN)
    expect(values.attentionDirection.value).toBe(0)
  })

  it('reads state back from the asset instead of the last write', () => {
    const { port, values } = fakeViewModel()
    const controls = createMamControls(port)

    controls.playOnce('celebrate_soft')
    values.behaviorState.value = 'idle' // the asset finished the one-shot
    expect(controls.read().behavior).toBe('idle')

    values.behaviorState.value = 'unknown'
    expect(controls.read().behavior).toBe('idle')
  })

  it('notifies on behaviour changes until unsubscribed', () => {
    const { port, values } = fakeViewModel()
    const controls = createMamControls(port)
    const listener = () => undefined
    const stop = controls.onBehaviorChange(listener)
    expect(values.behaviorState.listeners.has(listener)).toBe(true)
    stop()
    expect(values.behaviorState.listeners.size).toBe(0)
  })

  it('returns to the dock through the trigger', () => {
    const { port, fired } = fakeViewModel()
    createMamControls(port).returnToDock()
    expect(fired).toEqual(['returnToDock'])
  })

  it('keeps the asset enum order frozen', () => {
    expect(MAM_BEHAVIORS).toEqual([
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
    ])
  })
})
