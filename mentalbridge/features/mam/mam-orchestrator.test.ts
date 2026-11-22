import { describe, expect, it, vi } from 'vitest'

import {
  createMamOrchestrator,
  MAM_PRIORITY,
  seededRandom,
  type MamCancelReason,
  type MamPlayContext,
  type MamStageHost,
  type MamVariation,
} from './mam-orchestrator'
import { MAM_VARIATIONS } from './mam-variations'

/** Lets the promise chain behind a scene settle (a few microtasks). */
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

/** A clock the test advances by hand: no real timers, so a leak shows as a pending timer. */
function fakeClock() {
  let now = 0
  let next = 1
  const timers = new Map<number, { at: number; callback: () => void }>()
  return {
    setTimeout(callback: () => void, ms: number) {
      const id = next++
      timers.set(id, { at: now + ms, callback })
      return id
    },
    clearTimeout(handle: unknown) {
      timers.delete(handle as number)
    },
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        now = due[1].at
        timers.delete(due[0])
        due[1].callback()
      }
      now = end
    },
    pending: () => timers.size,
  }
}

const baseContext: MamPlayContext = {
  routeMode: 'full',
  viewportWidth: 1440,
  reduced: false,
  hidden: false,
  gates: {
    calm: true,
    present: true,
    festive: true,
    touch: true,
    autonomous: true,
  },
}
const quietHost: MamStageHost = {
  oneShot() {},
  loop() {},
  prop() {},
  conceal() {},
  gaze() {},
  scene: async () => true,
  settle() {},
  clear() {},
}

function setup(
  overrides: Partial<MamPlayContext> = {},
  options: { catalogue?: readonly MamVariation[]; asset?: 'v07' | 'v08' } = {},
) {
  const clock = fakeClock()
  const log: string[] = []
  const scenes: Array<(finished: boolean) => void> = []
  const host: MamStageHost = {
    oneShot: (kind) => log.push(`shot:${kind}`),
    loop: (b) => log.push(`loop:${b}`),
    prop: (id, show) => log.push(`prop:${id}:${show}`),
    conceal: (on) => log.push(`conceal:${on}`),
    gaze: (d) => log.push(`gaze:${d === null ? 'null' : d.toFixed(2)}`),
    scene: (id) => {
      log.push(`scene:${id}`)
      // The hop scenes end with their look; the cinematic ones wait for the test.
      if (id === 'dance' || id === 'spin') return Promise.resolve(true)
      return new Promise<boolean>((resolve) => scenes.push(resolve))
    },
    settle: () => log.push('settle'),
    clear: () => log.push('clear'),
  }
  let ctx: MamPlayContext = {
    routeMode: 'full',
    viewportWidth: 1440,
    reduced: false,
    hidden: false,
    gates: {
      calm: true,
      present: true,
      festive: true,
      touch: true,
      autonomous: true,
    },
    ...overrides,
  }
  const cancels: MamCancelReason[] = []
  const orchestrator = createMamOrchestrator({
    catalogue: options.catalogue ?? MAM_VARIATIONS,
    host,
    context: () => ctx,
    random: seededRandom(7),
    clock,
    asset: options.asset ?? 'v08',
    onCancel: (reason) => cancels.push(reason),
  })
  return {
    orchestrator,
    clock,
    log,
    cancels,
    scenes,
    setContext(patch: Partial<MamPlayContext>) {
      ctx = { ...ctx, ...patch }
      orchestrator.refresh()
    },
  }
}

const variation = (patch: Partial<MamVariation>): MamVariation => ({
  id: 'x',
  intent: 'HAPPY',
  tier: 'micro',
  modes: ['full', 'quiet'],
  minViewport: 0,
  minAsset: 'v07',
  gate: 'touch',
  weight: 1,
  durationMs: 1000,
  steps: [{ at: 0, oneShot: 'giggle' }],
  ...patch,
})

describe('mam orchestrator: selection', () => {
  it('plays one variation of the intent, then settles', () => {
    const t = setup()
    const result = t.orchestrator.play('HAPPY', { source: 'test' })
    expect(result.status).toBe('played')
    expect(t.orchestrator.current()?.intent).toBe('HAPPY')
    t.clock.advance(5000)
    expect(t.orchestrator.current()).toBeNull()
    expect(t.log.at(-1)).toBe('settle')
    expect(t.clock.pending()).toBe(0)
  })

  it('is deterministic for a seed and never repeats a variation back to back while another qualifies', async () => {
    const picks = async (seed: number) => {
      const clock = fakeClock()
      const orchestrator = createMamOrchestrator({
        catalogue: MAM_VARIATIONS,
        host: quietHost,
        context: () => baseContext,
        random: seededRandom(seed),
        clock,
        asset: 'v08',
      })
      const out: string[] = []
      for (let i = 0; i < 12; i++) {
        const r = orchestrator.play('HAPPY', { source: 'test' })
        if (r.status === 'played') out.push(r.variation)
        clock.advance(10_000)
        await flush()
      }
      return out
    }
    expect(await picks(3)).toEqual(await picks(3))
    const run = await picks(5)
    expect(run).toHaveLength(12)
    for (let i = 1; i < run.length; i++) expect(run[i]).not.toBe(run[i - 1])
    expect(new Set(run).size).toBeGreaterThan(1)
  })

  it('may repeat when it is the only variation that qualifies', () => {
    const t = setup({}, { catalogue: [variation({})] })
    t.orchestrator.play('HAPPY', { source: 'test' })
    t.clock.advance(2000)
    expect(t.orchestrator.play('HAPPY', { source: 'test' }).status).toBe(
      'played',
    )
  })

  it('weights the pool: a weight-0 look never plays, a heavy one dominates', () => {
    const t = setup(
      {},
      {
        catalogue: [
          variation({ id: 'never', weight: 0 }),
          variation({ id: 'always', weight: 5 }),
        ],
      },
    )
    for (let i = 0; i < 4; i++) {
      const r = t.orchestrator.play('HAPPY', { source: 'test' })
      expect(r).toEqual({ status: 'played', variation: 'always' })
      t.clock.advance(2000)
    }
  })

  it('QUIET offers only the variations marked for it; cinematic ones are never QUIET', () => {
    const t = setup({ routeMode: 'quiet' })
    const quiet = t.orchestrator.candidates('HAPPY').map((v) => v.id)
    expect(quiet).toEqual(['happy'])
    expect(t.orchestrator.candidates('WELCOME')).toEqual([])
    expect(t.orchestrator.play('WELCOME', { source: 'test' })).toEqual({
      status: 'skipped',
      reason: 'route',
    })
    const full = setup({ routeMode: 'full' })
    expect(full.orchestrator.candidates('HAPPY').map((v) => v.id)).toEqual([
      'happy',
      'spin',
      'tiny_dance',
    ])
  })

  it('filters by viewport width: the parachute needs 360 px, and the cheer sign reads on a narrow screen', () => {
    const narrow = setup({ viewportWidth: 375 })
    expect(
      narrow.orchestrator.candidates('CELEBRATE').map((v) => v.id),
    ).toContain('cheer_sign')
    const tiny = setup({ viewportWidth: 330 })
    expect(
      tiny.orchestrator.candidates('WELCOME').map((v) => v.id),
    ).not.toContain('parachute')
    expect(tiny.orchestrator.candidates('WELCOME').map((v) => v.id)).toContain(
      'airplane',
    )
    expect(
      tiny.orchestrator.play('WELCOME', {
        source: 'test',
        variation: 'parachute',
      }),
    ).toEqual({ status: 'skipped', reason: 'viewport' })
  })

  it('serving the v0.7 asset drops every variation that needs ids 28 and up', () => {
    const t = setup({}, { asset: 'v07' })
    const ids = MAM_VARIATIONS.filter((v) => v.minAsset === 'v08').map(
      (v) => v.id,
    )
    expect(ids.length).toBeGreaterThanOrEqual(8)
    for (const intent of [
      'WELCOME',
      'HAPPY',
      'CELEBRATE',
      'ENCOURAGE',
      'COMFORT',
    ] as const)
      for (const v of t.orchestrator.candidates(intent))
        expect(ids).not.toContain(v.id)
    expect(t.orchestrator.candidates('WELCOME').map((v) => v.id)).toEqual([
      'airplane',
    ])
  })

  it('a grade narrows CELEBRATE to its own looks, and a forced variation to one', () => {
    const t = setup()
    for (let i = 0; i < 6; i++) {
      const r = t.orchestrator.play('CELEBRATE', {
        source: 'test',
        grade: 'soft',
      })
      expect(['celebrate_soft', 'clap']).toContain(
        (r as { variation: string }).variation,
      )
      t.clock.advance(5000)
    }
    expect(
      t.orchestrator.play('ENCOURAGE', { source: 'saved', variation: 'nod' }),
    ).toEqual({ status: 'played', variation: 'nod' })
  })

  it('skips with a reason: hidden, reduced, no variation, gate closed', () => {
    expect(
      setup({ hidden: true }).orchestrator.play('IDLE', { source: 't' }),
    ).toEqual({ status: 'skipped', reason: 'hidden' })
    expect(
      setup({ reduced: true }).orchestrator.play('IDLE', { source: 't' }),
    ).toEqual({ status: 'skipped', reason: 'reduced' })
    expect(
      setup({ routeMode: 'hidden' }).orchestrator.play('IDLE', { source: 't' }),
    ).toEqual({ status: 'skipped', reason: 'route' })
    expect(
      setup().orchestrator.play('IDLE', { source: 't', variation: 'nope' }),
    ).toEqual({ status: 'skipped', reason: 'none' })
    const closed = setup({
      gates: {
        calm: true,
        present: true,
        festive: true,
        touch: true,
        autonomous: false,
      },
    })
    expect(closed.orchestrator.play('IDLE', { source: 't' })).toEqual({
      status: 'skipped',
      reason: 'blocked',
    })
    expect(closed.log).toEqual([])
  })
})

describe('mam orchestrator: priority and queue', () => {
  it('a lower priority never interrupts a higher one', () => {
    const t = setup()
    t.orchestrator.play('CELEBRATE', { source: 'celebration', grade: 'hero' })
    expect(t.orchestrator.play('IDLE', { source: 'idle' })).toEqual({
      status: 'skipped',
      reason: 'busy',
    })
    expect(t.orchestrator.play('WELCOME', { source: 'welcome' })).toEqual({
      status: 'skipped',
      reason: 'busy',
    })
    expect(t.orchestrator.current()?.intent).toBe('CELEBRATE')
  })

  it('a higher priority cancels the lower one cleanly, with no overlap', () => {
    const t = setup()
    t.orchestrator.play('IDLE', { source: 'idle', variation: 'butterfly' })
    expect(t.orchestrator.current()?.variation).toBe('butterfly')
    const r = t.orchestrator.play('CELEBRATE', {
      source: 'celebration',
      grade: 'hero',
    })
    expect(r.status).toBe('played')
    expect(t.cancels).toEqual(['preempted'])
    // The butterfly's props are cleared before the celebration's first command.
    const clear = t.log.indexOf('clear')
    expect(clear).toBeGreaterThan(-1)
    expect(
      t.log.slice(clear + 1).some((entry) => entry.startsWith('shot:')),
    ).toBe(true)
    expect(t.orchestrator.current()?.intent).toBe('CELEBRATE')
    // The old sequence's timers are gone: its prop-off step never fires.
    t.log.length = 0
    t.clock.advance(5000)
    expect(t.log).not.toContain('prop:butterfly:false')
  })

  it('queues at most one at the same priority and starts it when the first ends', () => {
    const t = setup()
    t.orchestrator.play('HAPPY', { source: 'a', variation: 'happy' })
    expect(
      t.orchestrator.play('HAPPY', { source: 'b', variation: 'happy' }),
    ).toEqual({
      status: 'queued',
    })
    expect(
      t.orchestrator.play('HAPPY', { source: 'c', variation: 'happy' }),
    ).toEqual({
      status: 'skipped',
      reason: 'queue_full',
    })
    expect(t.orchestrator.current()?.source).toBe('a')
    t.clock.advance(1700)
    expect(t.orchestrator.current()?.source).toBe('b')
    t.clock.advance(10_000)
    expect(t.orchestrator.current()).toBeNull()
    expect(t.clock.pending()).toBe(0)
  })

  it('claim() stops what ranks lower and leaves what ranks equal or higher', () => {
    const t = setup()
    t.orchestrator.play('IDLE', { source: 'idle' })
    t.orchestrator.claim(MAM_PRIORITY.welcome)
    expect(t.orchestrator.current()).toBeNull()
    t.orchestrator.play('CELEBRATE', { source: 'celebration', grade: 'soft' })
    t.orchestrator.claim(MAM_PRIORITY.activity)
    expect(t.orchestrator.current()?.intent).toBe('CELEBRATE')
    t.orchestrator.claim(MAM_PRIORITY.user)
    expect(t.orchestrator.current()).toBeNull()
  })

  it('REST ranks above idle looks, so the yawn of a nap (a claim at the welcome rank) does not cancel it', () => {
    const t = setup()
    t.orchestrator.play('REST', { source: 'idle', variation: 'blanket_tuck' })
    t.orchestrator.claim(MAM_PRIORITY.welcome)
    expect(t.orchestrator.current()?.variation).toBe('blanket_tuck')
    expect(t.orchestrator.play('IDLE', { source: 'idle' })).toEqual({
      status: 'skipped',
      reason: 'busy',
    })
  })

  it('an explicit priority overrides the intent default', () => {
    const t = setup()
    t.orchestrator.play('CELEBRATE', { source: 'c', grade: 'hero' })
    expect(
      t.orchestrator.play('IDLE', { source: 'x', priority: MAM_PRIORITY.user })
        .status,
    ).toBe('played')
    expect(t.orchestrator.current()?.intent).toBe('IDLE')
  })
})

describe('mam orchestrator: cancellation', () => {
  const cinematic = (t: ReturnType<typeof setup>) =>
    t.orchestrator.play('WELCOME', {
      source: 'welcome',
      variation: 'plant_pot',
    })

  it('input ends a cinematic variation at once and leaves a micro one alone', () => {
    const t = setup()
    cinematic(t)
    t.orchestrator.input()
    expect(t.orchestrator.current()).toBeNull()
    expect(t.cancels).toEqual(['input'])
    t.orchestrator.play('ENCOURAGE', { source: 'saved', variation: 'nod' })
    t.orchestrator.input()
    expect(t.orchestrator.current()?.variation).toBe('nod')
  })

  it('cancels on route change, hide, reduced motion, a closed gate and a route mode it does not allow', () => {
    for (const [patch, reason] of [
      [{ hidden: true }, 'hidden'],
      [{ reduced: true }, 'reduced'],
      [
        {
          gates: {
            calm: false,
            present: true,
            festive: true,
            touch: true,
            autonomous: true,
          },
        },
        'gate',
      ],
      [{ routeMode: 'hidden' }, 'route'],
    ] as const) {
      const t = setup()
      cinematic(t)
      t.setContext(patch as Partial<MamPlayContext>)
      expect(t.orchestrator.current()).toBeNull()
      expect(t.cancels).toEqual([reason])
    }
    const quiet = setup()
    quiet.orchestrator.play('HAPPY', { source: 't', variation: 'spin' })
    quiet.setContext({ routeMode: 'quiet' })
    expect(quiet.cancels).toEqual(['route'])
  })

  it('cancel() leaves no timer, prop, loop or concealment behind', () => {
    const t = setup()
    cinematic(t)
    t.clock.advance(1000)
    expect(t.log).toContain('conceal:true')
    expect(t.log).toContain('prop:plantPot:true')
    expect(t.orchestrator.cancel('account')).toBe(true)
    expect(t.clock.pending()).toBe(0)
    expect(t.log.at(-1)).toBe('clear')
    t.log.length = 0
    t.clock.advance(20_000)
    expect(t.log).toEqual([])
    expect(t.orchestrator.cancel('route')).toBe(false)
  })

  it('a queued play is dropped by cancel and by a lost gate', () => {
    const t = setup()
    t.orchestrator.play('HAPPY', { source: 'a' })
    t.orchestrator.play('HAPPY', { source: 'b' })
    t.orchestrator.cancel('route')
    t.clock.advance(10_000)
    expect(t.orchestrator.current()).toBeNull()
    t.orchestrator.play('HAPPY', { source: 'a' })
    t.orchestrator.play('HAPPY', { source: 'b' })
    t.setContext({ reduced: true })
    t.setContext({ reduced: false })
    t.clock.advance(10_000)
    expect(t.orchestrator.current()).toBeNull()
  })

  it('dispose cancels and refuses further plays', () => {
    const t = setup()
    t.orchestrator.play('HAPPY', { source: 'a' })
    t.orchestrator.dispose()
    expect(t.cancels).toEqual(['unmount'])
    expect(t.orchestrator.play('HAPPY', { source: 'a' })).toEqual({
      status: 'skipped',
      reason: 'disposed',
    })
  })
})

describe('mam orchestrator: scenes', () => {
  it('waits for the scene before it ends, even past the declared length', async () => {
    const t = setup()
    t.orchestrator.play('WELCOME', { source: 'welcome', variation: 'airplane' })
    expect(t.log).toEqual(['scene:airplane'])
    t.clock.advance(20_000)
    expect(t.orchestrator.current()?.variation).toBe('airplane')
    t.scenes[0]!(true)
    await flush()
    expect(t.orchestrator.current()).toBeNull()
    expect(t.log.at(-1)).toBe('settle')
  })

  it('a scene cut short outside the orchestrator cancels the whole sequence', async () => {
    const t = setup()
    t.orchestrator.play('WELCOME', {
      source: 'welcome',
      variation: 'parachute',
    })
    t.clock.advance(1000)
    t.scenes[0]!(false)
    await flush()
    expect(t.cancels).toEqual(['scene'])
    expect(t.orchestrator.current()).toBeNull()
    expect(t.clock.pending()).toBe(0)
  })

  it('runs the plant pot in order: hide, pot in, show, pop up, wave, pot out', () => {
    const t = setup()
    t.orchestrator.play('WELCOME', {
      source: 'welcome',
      variation: 'plant_pot',
    })
    t.clock.advance(6000)
    expect(t.log).toEqual([
      'conceal:true',
      'prop:plantPot:true',
      'conceal:false',
      'shot:pop_up',
      'shot:wave',
      'prop:plantPot:false',
      'settle',
    ])
  })

  it('the butterfly steers her gaze toward where it is drawn, and gives it back', () => {
    const t = setup()
    t.orchestrator.play('IDLE', { source: 'idle', variation: 'butterfly' })
    t.clock.advance(5000)
    const gazes = t.log
      .filter((e) => e.startsWith('gaze:'))
      .map((e) => e.slice(5))
    expect(gazes.at(-1)).toBe('0.00')
    expect(gazes.some((g) => Number(g) < -0.5)).toBe(true)
    expect(gazes.some((g) => Number(g) > 0.5)).toBe(true)
    expect(t.log).toContain('prop:butterfly:true')
    expect(t.log).toContain('prop:butterfly:false')
  })
})

describe('mam orchestrator: a failing scene and a waiting welcome', () => {
  const rejecting = (error: () => unknown) => {
    const t = setup()
    const host: MamStageHost = {
      ...quietHost,
      scene: () => {
        throw error()
      },
    }
    const orchestrator = createMamOrchestrator({
      catalogue: MAM_VARIATIONS,
      host: { ...host, clear: () => t.log.push('clear') },
      context: () => baseContext,
      random: seededRandom(1),
      clock: t.clock,
      asset: 'v08',
      onCancel: (reason) => t.cancels.push(reason),
    })
    return { t, orchestrator }
  }

  it('a scene that throws ends the look, releases the priority and clears the host', async () => {
    const { t, orchestrator } = rejecting(() => new Error('boom'))
    expect(
      orchestrator.play('WELCOME', {
        source: 'welcome',
        variation: 'parachute',
      }).status,
    ).toBe('played')
    await flush()
    expect(orchestrator.current()).toBeNull()
    expect(t.cancels).toEqual(['scene'])
    expect(t.log).toContain('clear')
    expect(t.clock.pending()).toBe(0)
    // Nothing is stuck: a lower rank plays again at once.
    expect(orchestrator.play('IDLE', { source: 'idle' }).status).toBe('played')
  })

  it('a scene whose promise rejects does the same', async () => {
    const t = setup()
    const orchestrator = createMamOrchestrator({
      catalogue: MAM_VARIATIONS,
      host: { ...quietHost, scene: () => Promise.reject(new Error('late')) },
      context: () => baseContext,
      clock: t.clock,
      asset: 'v08',
      onCancel: (reason) => t.cancels.push(reason),
    })
    orchestrator.play('HAPPY', { source: 't', variation: 'tiny_dance' })
    await flush()
    expect(orchestrator.current()).toBeNull()
    expect(t.cancels).toEqual(['scene'])
    expect(
      orchestrator.play('CELEBRATE', { source: 'c', grade: 'soft' }).status,
    ).toBe('played')
  })

  it('dequeue drops a waiting play of that source only', () => {
    const t = setup()
    t.orchestrator.play('REST', { source: 'idle', variation: 'blanket_tuck' })
    expect(t.orchestrator.play('WELCOME', { source: 'welcome' })).toEqual({
      status: 'queued',
    })
    t.orchestrator.dequeue('other')
    t.orchestrator.dequeue('welcome')
    t.clock.advance(10_000)
    expect(t.orchestrator.current()).toBeNull()
    expect(t.log.filter((e) => e.startsWith('scene:'))).toEqual([])
  })

  it('reports whether a look may grow: expressive and not opted out', () => {
    const t = setup()
    t.orchestrator.play('HAPPY', { source: 't', variation: 'spin' })
    expect(t.orchestrator.current()).toMatchObject({
      tier: 'expressive',
      grow: true,
    })
    t.orchestrator.cancel('route')
    t.orchestrator.play('IDLE', { source: 't', variation: 'look_around' })
    expect(t.orchestrator.current()).toMatchObject({
      tier: 'expressive',
      grow: false,
    })
    t.orchestrator.cancel('route')
    t.orchestrator.play('ENCOURAGE', { source: 't', variation: 'nod' })
    expect(t.orchestrator.current()).toMatchObject({
      tier: 'micro',
      grow: false,
    })
  })
})

describe('seededRandom', () => {
  it('repeats for a seed and stays in [0, 1)', () => {
    const a = seededRandom(1)
    const b = seededRandom(1)
    const first = Array.from({ length: 5 }, () => a())
    expect(first).toEqual(Array.from({ length: 5 }, () => b()))
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
    expect(seededRandom(2)()).not.toBe(first[0])
  })
})

describe('mam orchestrator: defaults', () => {
  it('uses real timers and the contract asset when none are given', () => {
    vi.useFakeTimers()
    try {
      const host = { ...quietHost, oneShot: vi.fn(), settle: vi.fn() }
      const orchestrator = createMamOrchestrator({
        catalogue: MAM_VARIATIONS,
        host,
        context: () => baseContext,
      })
      expect(
        orchestrator.play('ENCOURAGE', { source: 't', variation: 'nod' })
          .status,
      ).toBe('played')
      vi.advanceTimersByTime(900)
      expect(host.settle).toHaveBeenCalledTimes(1)
      expect(host.oneShot).toHaveBeenCalledWith('nod')
    } finally {
      vi.useRealTimers()
    }
  })
})
