// Frozen Mầm Rive V1 contract (docs/ADR_MAM_RIVE_V1_CONTRACT.md, MB-MAM-RIVE-001).
// Changing any value here is a contract change and needs a new asset hash and QA pass.

export const MAM_ASSET = {
  src: '/mam/mam-v03.riv',
  sha256: '2fbd1dacf9845f03e8710b61ab0110df616028467bd287fe9001a573a44e53a6',
  wasmUrl: '/mam/rive-lite-2.47.1.wasm',
  fallbackSrc: '/mam/mam-v03-idle.svg',
  artboard: 'companion_main',
  stateMachine: 'MamBehaviorController',
} as const

/** Enum order is the asset's ID order; do not reorder. */
export const MAM_BEHAVIORS = [
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
] as const

export type MamBehavior = (typeof MAM_BEHAVIORS)[number]

/** Looping states a V1 host may set. `sad` and `rest` are reserved. */
export const MAM_LOOPING_BEHAVIORS = [
  'idle',
  'curious',
  'listening',
  'thinking',
  'gentle',
  'explaining',
  'happy',
] as const satisfies readonly MamBehavior[]

export type MamLoopingBehavior = (typeof MAM_LOOPING_BEHAVIORS)[number]

/** One-shots start only through `playOnce`; the asset returns to `idle` itself. */
export const MAM_ONE_SHOTS = [
  'light_success',
  'celebrate_soft',
  'celebrate_hero',
] as const satisfies readonly MamBehavior[]

export type MamOneShot = (typeof MAM_ONE_SHOTS)[number]

export const MAM_VIEW_MODEL = {
  behavior: 'behaviorState',
  attention: 'attentionDirection',
  tier: 'celebrationTier',
  playOnce: 'playOnce',
  returnToDock: 'returnToDock',
  reducedMotion: 'reducedMotion',
  visible: 'isVisible',
} as const

export const isMamLoopingBehavior = (
  value: string,
): value is MamLoopingBehavior =>
  (MAM_LOOPING_BEHAVIORS as readonly string[]).includes(value)

export const isMamOneShot = (value: string): value is MamOneShot =>
  (MAM_ONE_SHOTS as readonly string[]).includes(value)
