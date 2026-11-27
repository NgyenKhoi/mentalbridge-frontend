// The Mầm scene orchestrator (MB-896, docs/ADR_MAM_RIVE_V2_CONTRACT.md "Orchestrator"). One behaviour, many looks:
// a caller asks for a semantic INTENT, the orchestrator picks one VARIATION (filtered by route mode, viewport, the
// served asset and the host's gates, then weighted random, never the same one twice in a row) and runs its steps
// through a `MamStageHost`. Pure core: the host adapter (`use-mam-stage.ts`) owns React, Rive and the DOM.
import {
  mamAssetServes,
  type MamAssetVersion,
  type MamLoopingBehavior,
  type MamOneShot,
} from './mam-contract'
import type { MamPropId } from './MamProps'
import type { MamRouteMode } from './mam-routes'

export const MAM_INTENTS = [
  'WELCOME',
  'IDLE',
  'HAPPY',
  'CELEBRATE',
  'ENCOURAGE',
  'COMFORT',
  'LISTEN',
  'THINK',
  'GUIDE',
  'REST',
] as const
export type MamIntent = (typeof MAM_INTENTS)[number]
export const isMamIntent = (value: string | null): value is MamIntent =>
  (MAM_INTENTS as readonly string[]).includes(value ?? '')

export type MamGrade = 'light' | 'soft' | 'hero'
export type MamTier = 'micro' | 'expressive' | 'cinematic'
/** The host gates a variation needs for as long as it runs; the host reports them in `MamPlayContext`. */
export type MamGate =
  | 'calm'
  // A save's acknowledgement: calm, and nothing open or yielding.
  | 'present'
  // A celebration: calm, not muted, nothing open (the page may yield; it was already playing).
  | 'festive'
  | 'touch'
  | 'autonomous'
export type MamSceneId = 'airplane' | 'parachute' | 'sleep' | 'dance' | 'spin'

/**
 * Higher wins; a lower one never interrupts a higher one. Safety, hide and reduced motion sit above all of
 * these: they are not a priority but gates (`MamPlayContext`) that cancel everything.
 */
export const MAM_PRIORITY = {
  idle: 0,
  welcome: 1,
  activity: 2,
  summon: 3,
  user: 4,
} as const
const INTENT_PRIORITY: Record<MamIntent, number> = {
  IDLE: MAM_PRIORITY.idle,
  // The yawn of a nap is the host's own one-shot, which takes the stage from idle looks: rest ranks above them.
  REST: MAM_PRIORITY.welcome,
  WELCOME: MAM_PRIORITY.welcome,
  HAPPY: MAM_PRIORITY.activity,
  CELEBRATE: MAM_PRIORITY.activity,
  ENCOURAGE: MAM_PRIORITY.activity,
  COMFORT: MAM_PRIORITY.activity,
  LISTEN: MAM_PRIORITY.summon,
  THINK: MAM_PRIORITY.summon,
  GUIDE: MAM_PRIORITY.summon,
}

/** A step runs `at` ms after the variation starts. */
export type MamStep = Readonly<{ at: number }> &
  (
    | Readonly<{ oneShot: MamOneShot }>
    | Readonly<{ loop: MamLoopingBehavior | null }>
    | Readonly<{ prop: MamPropId; show: boolean }>
    | Readonly<{ conceal: boolean }>
    | Readonly<{ gaze: number }>
    | Readonly<{ scene: MamSceneId }>
  )

export interface MamVariation {
  id: string
  intent: MamIntent
  tier: MamTier
  /** Route modes it may play on (QUIET only for micro and expressive ones that are marked so). */
  modes: readonly Exclude<MamRouteMode, 'hidden'>[]
  /** The narrowest viewport width (px) it may play at. */
  minViewport: number
  /** `v08` when it needs the Rive ids 28 and up: it then drops out while the v0.7 asset is served. */
  minAsset: MamAssetVersion
  gate: MamGate
  weight: number
  /** `false` keeps an expressive look from growing at the dock (a migrated idle or rest look). */
  grow?: boolean
  /** CELEBRATE only: the celebration it answers (`light` is a Bingo, `soft` and `hero` an achievement). */
  grade?: MamGrade
  /** Declared length; the sequence ends then, once any scene has finished. */
  durationMs: number
  steps: readonly MamStep[]
}

export type MamSkipReason =
  | 'disposed'
  | 'hidden'
  | 'reduced'
  | 'route'
  | 'viewport'
  | 'none'
  | 'blocked'
  | 'busy'
  | 'queue_full'
export type MamCancelReason =
  | 'preempted'
  | 'hidden'
  | 'reduced'
  | 'route'
  | 'gate'
  | 'input'
  | 'modal'
  | 'account'
  | 'renderer'
  | 'scene'
  | 'unmount'
  | 'host'

export type MamPlayResult =
  | { status: 'played'; variation: string }
  | { status: 'queued' }
  | { status: 'skipped'; reason: MamSkipReason }

export interface MamPlayOptions {
  /** Who asked (welcome, idle, celebration, saved, dev): for telemetry and tests. */
  source: string
  priority?: number
  /** Only this celebration's variations are candidates. */
  grade?: MamGrade
  /** Force one variation (a trigger with a fixed look, or QA); every gate still applies. */
  variation?: string
}

/** What the host knows right now. The orchestrator reads it on every `play` and `refresh`. */
export interface MamPlayContext {
  routeMode: MamRouteMode
  viewportWidth: number
  /** Reduced motion (the OS or Mầm's own switch). */
  reduced: boolean
  /** Hidden by the user, away, suppressed, dizzy or without a renderer. */
  hidden: boolean
  gates: Readonly<Record<MamGate, boolean>>
}

export interface MamStageHost {
  oneShot(kind: MamOneShot | null): void
  loop(behavior: MamLoopingBehavior | null): void
  prop(id: MamPropId, show: boolean): void
  conceal(on: boolean): void
  /** An `attentionDirection` (-1 to 1); null gives the gaze back to the pointer. */
  gaze(direction: number | null): void
  /** Starts a scene; resolves false when it was cut short. */
  scene(id: MamSceneId): Promise<boolean>
  /** A normal end: props, loop, concealment and gaze off; a one-shot is left to finish. */
  settle(): void
  /** A cancel: all of the above, plus a running one-shot and any scene motion. Must be cheap and idempotent. */
  clear(): void
}

export interface MamClock {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface MamCurrent {
  intent: MamIntent
  variation: string
  tier: MamTier
  /** Whether the host may scale her up while this runs: an expressive look that has not opted out. */
  grow: boolean
  priority: number
  source: string
}

export interface MamOrchestratorConfig {
  catalogue: readonly MamVariation[]
  host: MamStageHost
  context: () => MamPlayContext
  random?: () => number
  clock?: MamClock
  /** The served asset's generation; defaults to the contract's. */
  asset?: MamAssetVersion
  onChange?: (current: MamCurrent | null) => void
  onCancel?: (reason: MamCancelReason) => void
}

/** A small seeded generator (mulberry32) for tests and deterministic captures. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Running {
  current: MamCurrent
  variation: MamVariation
  timers: unknown[]
  scenes: number
  elapsed: boolean
  serial: number
}
interface Queued {
  intent: MamIntent
  options: MamPlayOptions
  priority: number
}

export function createMamOrchestrator(config: MamOrchestratorConfig) {
  const { catalogue, host, context } = config
  const random = config.random ?? Math.random
  const clock: MamClock = config.clock ?? {
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as number),
  }
  let running: Running | null = null
  let queued: Queued | null = null
  let serial = 0
  let disposed = false
  /** The last variation each intent played, for the no-repeat rule. */
  const last = new Map<MamIntent, string>()

  const gateOf = (ctx: MamPlayContext, variation: MamVariation) =>
    ctx.gates[variation.gate]

  function choose(
    intent: MamIntent,
    options: MamPlayOptions,
    ctx: MamPlayContext,
  ): MamVariation | MamSkipReason {
    if (ctx.hidden) return 'hidden'
    if (ctx.reduced) return 'reduced'
    if (ctx.routeMode === 'hidden') return 'route'
    const mode = ctx.routeMode
    let pool = catalogue.filter((v) => v.intent === intent)
    if (options.variation) pool = pool.filter((v) => v.id === options.variation)
    if (options.grade)
      pool = pool.filter((v) => !v.grade || v.grade === options.grade)
    pool = pool.filter((v) => mamAssetServes(v.minAsset, config.asset))
    if (!pool.length) return 'none'
    pool = pool.filter((v) => v.modes.includes(mode))
    if (!pool.length) return 'route'
    pool = pool.filter((v) => ctx.viewportWidth >= v.minViewport)
    if (!pool.length) return 'viewport'
    pool = pool.filter((v) => gateOf(ctx, v))
    if (!pool.length) return 'blocked'
    // A weight of 0 switches a look off.
    pool = pool.filter((v) => v.weight > 0)
    if (!pool.length) return 'none'
    // Never the same variation twice in a row while another one qualifies.
    const previous = last.get(intent)
    const fresh = pool.filter((v) => v.id !== previous)
    if (fresh.length) pool = fresh
    const total = pool.reduce((sum, v) => sum + v.weight, 0)
    let roll = random() * total
    for (const v of pool) {
      roll -= v.weight
      if (roll < 0) return v
    }
    return pool.at(-1)!
  }

  function stop(reason: MamCancelReason | null) {
    const run = running
    if (!run) return
    running = null
    for (const timer of run.timers) clock.clearTimeout(timer)
    if (reason) {
      host.clear()
      config.onCancel?.(reason)
    } else host.settle()
    config.onChange?.(null)
  }

  function finish(run: Running) {
    if (running !== run || !run.elapsed || run.scenes > 0) return
    stop(null)
    const next = queued
    queued = null
    if (next) start(next.intent, next.options, next.priority)
  }

  function apply(step: MamStep) {
    if ('oneShot' in step) host.oneShot(step.oneShot)
    else if ('loop' in step) host.loop(step.loop)
    else if ('prop' in step) host.prop(step.prop, step.show)
    else if ('conceal' in step) host.conceal(step.conceal)
    else if ('gaze' in step) host.gaze(step.gaze)
  }

  function start(
    intent: MamIntent,
    options: MamPlayOptions,
    priority: number,
  ): MamPlayResult {
    const picked = choose(intent, options, context())
    if (typeof picked === 'string') return { status: 'skipped', reason: picked }
    last.set(intent, picked.id)
    const run: Running = {
      current: {
        intent,
        variation: picked.id,
        tier: picked.tier,
        grow: picked.tier === 'expressive' && picked.grow !== false,
        priority,
        source: options.source,
      },
      variation: picked,
      timers: [],
      scenes: 0,
      elapsed: false,
      serial: (serial += 1),
    }
    running = run
    config.onChange?.(run.current)
    const alive = () => running === run
    for (const step of picked.steps) {
      const fire = () => {
        if (!alive()) return
        if ('scene' in step) {
          run.scenes += 1
          // A scene that throws or rejects ends the sequence like one that was cut short: the priority is released
          // and the host goes back to the dock (`clear`). `new Promise` also catches a synchronous throw.
          void new Promise<boolean>((resolve) =>
            resolve(host.scene(step.scene)),
          )
            .catch(() => false)
            .then((finished) => {
              run.scenes -= 1
              if (!alive()) return
              // A scene cut short outside the orchestrator (a snap) ends the whole sequence.
              if (!finished) cancel('scene')
              else finish(run)
            })
        } else apply(step)
      }
      if (step.at <= 0) fire()
      else run.timers.push(clock.setTimeout(fire, step.at))
    }
    if (alive())
      run.timers.push(
        clock.setTimeout(() => {
          run.elapsed = true
          finish(run)
        }, picked.durationMs),
      )
    return { status: 'played', variation: picked.id }
  }

  function play(intent: MamIntent, options: MamPlayOptions): MamPlayResult {
    if (disposed) return { status: 'skipped', reason: 'disposed' }
    const priority = options.priority ?? INTENT_PRIORITY[intent]
    if (running) {
      if (priority < running.current.priority)
        return { status: 'skipped', reason: 'busy' }
      if (priority === running.current.priority) {
        // Same rank: one waits its turn, any more are dropped.
        if (queued) return { status: 'skipped', reason: 'queue_full' }
        const ctx = context()
        const probe = choose(intent, options, ctx)
        // `choose` consumed a random roll only to learn that something qualifies; the real pick happens at the start.
        if (typeof probe === 'string')
          return { status: 'skipped', reason: probe }
        queued = { intent, options, priority }
        return { status: 'queued' }
      }
      const result = choose(intent, options, context())
      if (typeof result === 'string')
        return { status: 'skipped', reason: result }
      cancel('preempted')
    }
    return start(intent, options, priority)
  }

  /** Cancels what runs and what waits: the host's way out (route change, modal, account, renderer failure, unmount). */
  function cancel(reason: MamCancelReason) {
    const had = running !== null || queued !== null
    queued = null
    if (running) stop(reason)
    return had
  }

  return {
    play,
    cancel,
    /** Drops a waiting play of a source (the welcome that has since been marked as attempted). */
    dequeue(source: string) {
      if (queued?.options.source === source) queued = null
    },
    /** Any pointer, key, wheel or touch: a cinematic variation ends at once; the rest play on. */
    input() {
      if (running?.current.tier === 'cinematic') cancel('input')
    },
    /** A higher-ranked actor (a poke, a drag, a summon) takes the stage: lower sequences stop. */
    claim(priority: number) {
      if (queued && queued.priority < priority) queued = null
      if (running && running.current.priority < priority) cancel('preempted')
    },
    /** The host's gates changed: drop what no longer qualifies. */
    refresh() {
      const ctx = context()
      if (queued && (ctx.hidden || ctx.reduced || ctx.routeMode === 'hidden'))
        queued = null
      const run = running
      if (!run) return
      if (ctx.hidden) cancel('hidden')
      else if (ctx.reduced) cancel('reduced')
      else if (
        ctx.routeMode === 'hidden' ||
        !(run.variation.modes as readonly string[]).includes(ctx.routeMode)
      )
        cancel('route')
      else if (!gateOf(ctx, run.variation)) cancel('gate')
    },
    current: (): MamCurrent | null => running?.current ?? null,
    /** The candidate variations of an intent for a context, in catalogue order (tests and tooling). */
    candidates(intent: MamIntent, ctx: MamPlayContext = context()) {
      return catalogue.filter(
        (v) =>
          v.intent === intent &&
          mamAssetServes(v.minAsset, config.asset) &&
          v.modes.includes(ctx.routeMode as 'full' | 'quiet') &&
          ctx.viewportWidth >= v.minViewport,
      )
    },
    dispose() {
      cancel('unmount')
      disposed = true
    },
  }
}

export type MamOrchestrator = ReturnType<typeof createMamOrchestrator>
