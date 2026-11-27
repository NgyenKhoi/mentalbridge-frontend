// Mầm Rive contract: V1 (docs/ADR_MAM_RIVE_V1_CONTRACT.md, MB-MAM-RIVE-001) amended by V2
// (docs/ADR_MAM_RIVE_V2_CONTRACT.md, MB-894). Changing any value here is a contract change and
// needs a new asset hash and QA pass. Rollback: set `MAM_WELCOME_ENABLED` to false and point
// `src`/`sha256` back at mam-v06.riv (still shipped); the host never reads the v0.7 ids then.
// Reverting the MB-894 change removes them for good. v0.8 (MB-896) appends ids 28-35 (see
// ADR V2, "v0.8 amendment"); mam-v07.riv is still shipped for rollback to the MB-894 states.

/** The welcome flight uses the v0.7 ids; with v0.6 served this must be false. */
export const MAM_WELCOME_ENABLED = true

export const MAM_ASSET = {
  src: '/mam/mam-v08.riv',
  sha256: 'e54ddc955c0f4fc1b7a190a06b33e1e8e7eeb050409c083f9e56b5a4fb86b021',
  wasmUrl: '/mam/rive-lite-2.47.1.wasm',
  fallbackSrc: '/mam/mam-v03-idle.svg',
  artboard: 'companion_main',
  stateMachine: 'MamBehaviorController',
} as const

/** The served asset's generation. A variation that needs ids 28 and up declares `minAsset: 'v08'` and drops out of the catalogue while this is 'v07' (rollback). */
export type MamAssetVersion = 'v07' | 'v08'
/** Read from the served file, so a rollback that only repoints `src` also drops the v0.8 looks. */
export const MAM_ASSET_VERSION: MamAssetVersion = MAM_ASSET.src.endsWith(
  '/mam-v08.riv',
)
  ? 'v08'
  : 'v07'
export const mamAssetServes = (
  minAsset: MamAssetVersion,
  served: MamAssetVersion = MAM_ASSET_VERSION,
) => minAsset === 'v07' || served === 'v08'

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
  // v0.8 (MB-896): appended in this order.
  'spin',
  'dance',
  'clap',
  'thumbs_up',
  'fist_pump',
  'sit_hug',
  'hang',
  'pop_up',
] as const

export type MamBehavior = (typeof MAM_BEHAVIORS)[number]

/** Looping states a host may set. `sad` and `rest` are reserved; `dangle` is held for a whole drag; `pilot` and `pilot_wave` only for the welcome flight; `sit_hug` and `hang` only inside a variation sequence. */
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
  'sit_hug',
  'hang',
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
  'spin',
  'dance',
  'clap',
  'thumbs_up',
  'fist_pump',
  'pop_up',
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
  spin: 1200,
  dance: 2500,
  clap: 1700,
  thumbs_up: 1400,
  fist_pump: 1300,
  pop_up: 1200,
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
