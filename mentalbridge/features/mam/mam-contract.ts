// Mầm Rive contract: V1 (docs/ADR_MAM_RIVE_V1_CONTRACT.md, MB-MAM-RIVE-001) amended by V2
// (docs/ADR_MAM_RIVE_V2_CONTRACT.md, MB-894). Changing any value here is a contract change and
// needs a new asset hash and QA pass. Rollback: set `MAM_WELCOME_ENABLED` to false and point
// `src`/`sha256` back at mam-v06.riv (still shipped); the host never reads the v0.7 ids then.
// Reverting the MB-894 change removes them for good.

/** The welcome flight uses the v0.7 ids; with v0.6 served this must be false. */
export const MAM_WELCOME_ENABLED = true

export const MAM_ASSET = {
  src: '/mam/mam-v07.riv',
  sha256: 'b440cb6f097a5ae12cb7ad3d44cf4f4f5055000156c823b09530d1e85ea653c3',
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
  'sleep',
  'speaking',
  // v0.6 (MB-818): appended in this order.
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
  // v0.7 (MB-894): appended in this order.
  'pilot',
  'pilot_wave',
  'hop_down',
  'wave',
] as const

export type MamBehavior = (typeof MAM_BEHAVIORS)[number]

/** Looping states a host may set. `sad` and `rest` are reserved; `dangle` is held for a whole drag; `pilot` and `pilot_wave` only for the welcome flight. */
export const MAM_LOOPING_BEHAVIORS = [
  'idle',
  'curious',
  'listening',
  'thinking',
  'gentle',
  'explaining',
  'happy',
  'sleep',
  'speaking',
  'dangle',
  'pilot',
  'pilot_wave',
] as const satisfies readonly MamBehavior[]

export type MamLoopingBehavior = (typeof MAM_LOOPING_BEHAVIORS)[number]

/** One-shots start only through `playOnce`; the asset returns to `idle` itself. */
export const MAM_ONE_SHOTS = [
  'light_success',
  'celebrate_soft',
  'celebrate_hero',
  'drowsy',
  'wake',
  'giggle',
  'tickled',
  'nod',
  'stretch',
  'look_around',
  'scratch',
  'point',
  'hop_down',
  'wave',
] as const satisfies readonly MamBehavior[]

export type MamOneShot = (typeof MAM_ONE_SHOTS)[number]

/** The asset's length per one-shot, in ms, plus a margin: when the host may drop the command. */
export const MAM_ONE_SHOT_MS = {
  light_success: 1400,
  celebrate_soft: 1100,
  celebrate_hero: 1700,
  drowsy: 2600,
  wake: 1300,
  giggle: 900,
  tickled: 1700,
  nod: 800,
  stretch: 1900,
  look_around: 2300,
  scratch: 1700,
  point: 1700,
  hop_down: 1000,
  wave: 1500,
} as const satisfies Record<MamOneShot, number>

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
