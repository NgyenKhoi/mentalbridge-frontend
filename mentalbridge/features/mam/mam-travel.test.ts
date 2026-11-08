import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMamTravel } from './mam-travel'

const SIZE = 96
const DOCK = new DOMRect(24, 700, SIZE, SIZE)

function box(rect: DOMRect) {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => rect
  document.body.appendChild(element)
  return element
}

function setup() {
  const calls: string[] = []
  const hooks = {
    mode: vi.fn((mode: string) => calls.push(`mode:${mode}`)),
    behavior: vi.fn((behavior: string | null) =>
      calls.push(`behavior:${behavior}`),
    ),
    oneShot: vi.fn((kind: string | null) => calls.push(`shot:${kind}`)),
    attention: vi.fn(),
    perch: vi.fn(),
    asleep: vi.fn((asleep: boolean) => calls.push(`asleep:${asleep}`)),
  }
  const travel = createMamTravel(hooks)
  const root = box(DOCK)
  const layer = box(DOCK)
  travel.attach({ root, size: SIZE })
  travel.setLayer(layer)
  const header = box(new DOMRect(0, 0, 1024, 76))
  header.className = 'ref-topbar'
  return { travel, hooks, calls, layer, root }
}

const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)

describe('Mầm travel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('dives out of the dock, then climbs in two steps and reports the perch', async () => {
    const { travel, hooks, calls, layer } = setup()
    const card = box(new DOMRect(300, 400, 600, 120))
    void travel.climb(card)

    await run(240)
    // Still diving (in-back): below the dock, not behind the card yet.
    expect(travel.mode()).toBe('dock')
    expect(travel.values.y.get()).toBeGreaterThan(0)
    expect(calls[0]).toBe('behavior:curious')

    await run(660) // 900 ms in: the climb is not over (it takes about 1.2 s)
    expect(travel.mode()).toBe('perch')
    expect(hooks.perch).toHaveBeenLastCalledWith(null)
    expect(layer.style.clipPath).toContain('inset(')

    await run(600)
    // Perched: 0.64·S above the card edge, at its right side, bubble may open.
    expect(travel.values.y.get()).toBeCloseTo(400 - 0.64 * SIZE - 700, 0)
    expect(travel.values.x.get()).toBeCloseTo(900 - SIZE - 28 - 24, 0)
    expect(hooks.perch).toHaveBeenLastCalledWith({
      left: 900 - SIZE - 28,
      top: 400 - 0.64 * SIZE,
      cardTop: 400,
      size: SIZE,
    })
    expect(hooks.attention).toHaveBeenCalledWith(-0.6)
    expect(calls.at(-1)).toBe('behavior:null')
  })

  it('perches on a marked inner surface, not the target top edge', async () => {
    const { travel, hooks } = setup()
    // A section whose heading row (top 300) sits above its first card (top 400).
    const section = box(new DOMRect(300, 300, 600, 400))
    const card = box(new DOMRect(300, 400, 600, 120))
    card.setAttribute('data-mam-perch', '')
    section.appendChild(card)
    void travel.climb(section)
    await run(1800)
    expect(travel.values.y.get()).toBeCloseTo(400 - 0.64 * SIZE - 700, 0)
    expect(hooks.perch).toHaveBeenLastCalledWith(
      expect.objectContaining({ cardTop: 400 }),
    )
  })

  it('goes home with a thanks beat, or without one', async () => {
    const thanked = setup()
    const card = box(new DOMRect(300, 400, 600, 120))
    void thanked.travel.climb(card)
    await run(1800)
    thanked.calls.length = 0
    void thanked.travel.home(true)
    await run(2000)
    expect(thanked.calls).toEqual([
      'behavior:happy',
      'behavior:gentle',
      'mode:dock',
      'behavior:null',
    ])
    expect(thanked.travel.values.y.get()).toBeCloseTo(0)
    expect(thanked.layer.style.clipPath).toBe('')

    const plain = setup()
    void plain.travel.climb(card)
    await run(1800)
    plain.calls.length = 0
    void plain.travel.home(false)
    await run(2000)
    expect(plain.calls).not.toContain('behavior:happy')
    expect(plain.calls.at(-1)).toBe('behavior:null')
  })

  it('snaps home at once, cancelling the climb', async () => {
    const { travel, layer } = setup()
    const card = box(new DOMRect(300, 400, 600, 120))
    void travel.climb(card)
    await run(500)
    travel.snap()
    expect(travel.mode()).toBe('dock')
    expect(travel.values.x.get()).toBe(0)
    expect(travel.values.y.get()).toBe(0)
    expect(layer.style.clipPath).toBe('')
    await run(3000)
    // The cancelled sequence never resumes.
    expect(travel.mode()).toBe('dock')
    expect(travel.values.y.get()).toBe(0)
  })

  it('retreats before climbing a second card', async () => {
    const { travel, calls, hooks } = setup()
    const first = box(new DOMRect(300, 400, 600, 120))
    const second = box(new DOMRect(300, 600, 600, 120))
    void travel.climb(first)
    await run(1800)
    calls.length = 0
    void travel.climb(second)
    await run(150)
    expect(calls).toContain('behavior:gentle')
    expect(hooks.perch).toHaveBeenLastCalledWith(null)
    await run(1800)
    expect(travel.values.y.get()).toBeCloseTo(600 - 0.64 * SIZE - 700, 0)
    expect(hooks.perch).toHaveBeenLastCalledWith(
      expect.objectContaining({ cardTop: 600 }),
    )
  })

  it('follows the card on scroll and reports once when it scrolls out of reach', async () => {
    const { travel, hooks } = setup()
    let rect = new DOMRect(300, 400, 600, 120)
    const card = box(rect)
    card.getBoundingClientRect = () => rect
    const lost = vi.fn()
    travel.onLost(lost)
    void travel.climb(card)
    await run(1800)

    rect = new DOMRect(300, 300, 600, 120)
    window.dispatchEvent(new Event('scroll'))
    await run(40)
    expect(travel.values.y.get()).toBeCloseTo(300 - 0.64 * SIZE - 700, 0)
    expect(hooks.perch).toHaveBeenLastCalledWith(
      expect.objectContaining({ cardTop: 300 }),
    )
    expect(lost).not.toHaveBeenCalled()

    // A few px under the line (smooth-scroll rounding) is still perched.
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
    rect = new DOMRect(300, 76 + 0.64 * SIZE + 16 - 3, 600, 120)
    window.dispatchEvent(new Event('scroll'))
    await run(40)
    expect(lost).not.toHaveBeenCalled()

    // The top edge goes under the header: the page is scrolled, so it closes.
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
    rect = new DOMRect(300, 100, 600, 120)
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    await run(40)
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it('reports an unmounted card', async () => {
    const { travel } = setup()
    const card = box(new DOMRect(300, 400, 600, 120))
    const lost = vi.fn()
    travel.onLost(lost)
    void travel.climb(card)
    await run(1800)
    card.remove()
    window.dispatchEvent(new Event('resize'))
    await run(40)
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it('yawns upright for 2.5 s, then lies down asleep, and wakes with a happy beat', async () => {
    const { travel, calls } = setup()
    void travel.sleep()
    await run(100)
    // Drowsy plays upright: not asleep, not lying down.
    expect(calls).toEqual(['shot:drowsy'])
    await run(2300)
    expect(calls).toEqual(['shot:drowsy'])
    expect(travel.values.rotate.get()).toBe(0)
    // Then the lie-down, with the asset already on its sleep face.
    await run(200)
    expect(calls).toEqual([
      'shot:drowsy',
      'asleep:true',
      'behavior:sleep',
      'shot:null',
    ])
    await run(900)
    expect(travel.values.rotate.get()).toBeCloseTo(-78, 0)

    calls.length = 0
    void travel.wake()
    await run(3000)
    // The Rive wake replaces the old curious step; hop, squash and happy stay.
    expect(calls).toEqual([
      'behavior:null',
      'shot:wake',
      'asleep:false',
      'behavior:happy',
      'behavior:null',
    ])
    expect(travel.values.rotate.get()).toBeCloseTo(0)
  })

  it('input during the yawn stands Mầm back up instead of lying down', async () => {
    const { travel, calls } = setup()
    void travel.sleep()
    await run(1000)
    travel.stir()
    expect(calls).toEqual(['shot:drowsy', 'shot:null'])
    await run(4000)
    expect(travel.isAsleep()).toBe(false)
    expect(travel.values.rotate.get()).toBe(0)
    expect(calls).toEqual(['shot:drowsy', 'shot:null'])
    // Nothing to stir once it is not yawning.
    travel.stir()
    expect(calls).toHaveLength(2)
  })

  it.each([
    ['a snap', (t: ReturnType<typeof setup>['travel']) => t.snap()],
    ['a drag', (t: ReturnType<typeof setup>['travel']) => t.dragStart(70, 750)],
  ])('%s during the yawn cuts it and never lies down', async (_name, cut) => {
    const { travel, calls } = setup()
    void travel.sleep()
    await run(1000)
    cut(travel)
    expect(calls).toContain('shot:null')
    await run(4000)
    expect(travel.isAsleep()).toBe(false)
    expect(calls).not.toContain('asleep:true')
  })

  it('a wake cut short by a snap clears its Rive one-shot too', async () => {
    const { travel, calls } = setup()
    void travel.sleep()
    await run(3400)
    calls.length = 0
    void travel.wake()
    await run(300)
    travel.snap()
    expect(calls.at(-1)).toBe('behavior:null')
    expect(calls).toContain('shot:null')
  })

  it('a quick wake skips the happy beat, and a quiet wake is instant', async () => {
    const quick = setup()
    void quick.travel.sleep()
    await run(3500)
    quick.calls.length = 0
    void quick.travel.wake(true)
    await run(2000)
    expect(quick.calls).not.toContain('behavior:happy')

    const quiet = setup()
    void quiet.travel.sleep()
    await run(3500)
    quiet.travel.wakeQuiet()
    expect(quiet.travel.isAsleep()).toBe(false)
    expect(quiet.travel.values.rotate.get()).toBe(0)
  })

  it('a drag follows the pointer, a throw flies, and Mầm hops home to the dock', async () => {
    const { travel, calls } = setup()
    expect(travel.dragStart(70, 750)).toBe(true)
    expect(travel.mode()).toBe('drag')
    // Held by the pointer: the looping dangle, for the whole drag.
    expect(calls.at(-1)).toBe('behavior:dangle')
    travel.dragMove(400, 300)
    expect(travel.values.x.get()).toBeCloseTo(400 - 70)
    expect(travel.values.y.get()).toBeCloseTo(300 - 750 + 0, 0)
    // Dragged left while moving right: tilts against the motion.
    expect(travel.values.rotate.get()).toBeLessThan(0)

    travel.dragEnd()
    expect(travel.mode()).toBe('fly')
    expect(calls).toContain('behavior:happy')
    await run(20_000)
    expect(travel.mode()).toBe('dock')
    expect(travel.values.x.get()).toBeCloseTo(0, 0)
    expect(travel.values.y.get()).toBeCloseTo(0, 0)
    expect(calls.at(-1)).toBe('behavior:null')
  })

  it('a fast throw lands harder and shakes off, a slow one does not', async () => {
    const fast = setup()
    fast.travel.dragStart(70, 750, performance.now())
    await run(16)
    fast.travel.dragMove(500, 300)
    fast.travel.dragEnd(500, 300)
    let minSy = 1
    fast.travel.values.scaleY.on('change', (v) => (minSy = Math.min(minSy, v)))
    let swings = 0
    fast.travel.values.rotate.on('change', (v) => v > 4 && (swings += 1))
    await run(20_000)
    expect(minSy).toBeLessThanOrEqual(0.7)
    expect(swings).toBeGreaterThan(0)
    // Dizzy is only the failed renderer: the host never asks for it.
    expect(fast.calls.every((c) => !c.includes('dizzy'))).toBe(true)
    expect(fast.travel.mode()).toBe('dock')

    const slow = setup()
    slow.travel.dragStart(70, 750, performance.now())
    await run(300)
    slow.travel.dragMove(80, 740)
    await run(300)
    slow.travel.dragEnd(80, 740)
    let slowSy = 1
    slow.travel.values.scaleY.on(
      'change',
      (v) => (slowSy = Math.min(slowSy, v)),
    )
    await run(20_000)
    expect(slowSy).toBeGreaterThan(0.75)
  })

  it('cannot start a drag away from the dock', async () => {
    const { travel } = setup()
    void travel.climb(box(new DOMRect(300, 400, 600, 120)))
    await run(1800)
    expect(travel.dragStart(10, 10)).toBe(false)
  })
  // ---- Round 1 review: cancellation, dismissal, drag bookkeeping ----------

  // Counts every motion-value write, so "no later writes" is checkable.
  const writes = (travel: ReturnType<typeof setup>['travel']) => {
    let count = 0
    for (const key of ['x', 'y', 'rotate', 'scaleX', 'scaleY'] as const)
      travel.values[key].on('change', () => {
        count += 1
      })
    return () => count
  }

  it('a tip hop interrupted by a climb does not overwrite the dive', async () => {
    const { travel } = setup()
    const card = box(new DOMRect(300, 400, 600, 120))
    void travel.tipHop()
    await run(80)
    void travel.climb(card)
    await run(200)
    // The stale hop would have started its own tween and reached the card by now.
    expect(travel.mode()).toBe('dock')
    expect(travel.values.y.get()).toBeGreaterThan(0)
    await run(1800)
    expect(travel.mode()).toBe('perch')
    expect(travel.values.y.get()).toBeCloseTo(400 - 0.64 * SIZE - 700, 0)
  })

  it('disposing during a tip hop stops every later write', async () => {
    const { travel } = setup()
    void travel.tipHop()
    await run(80)
    travel.dispose()
    const count = writes(travel)
    await run(2000)
    expect(count()).toBe(0)
  })

  it.each([
    ['rotation', 400],
    ['squash', 900],
  ])(
    'a wake interrupted during its %s stops at the snap',
    async (_part, at) => {
      const { travel, hooks } = setup()
      void travel.sleep()
      await run(3400)
      void travel.wake(false)
      await run(at)
      travel.snap()
      const count = writes(travel)
      const calls = hooks.behavior.mock.calls.length
      await run(3000)
      expect(count()).toBe(0)
      expect(hooks.behavior.mock.calls.length).toBe(calls)
      expect(travel.values.rotate.get()).toBe(0)
    },
  )

  it('disposing during a wake stops every later write', async () => {
    const { travel } = setup()
    void travel.sleep()
    await run(3400)
    void travel.wake(false)
    await run(400)
    travel.dispose()
    const count = writes(travel)
    await run(3000)
    expect(count()).toBe(0)
  })

  it('a snap during the sleep transform lands in the settled sleep pose', async () => {
    const { travel, hooks } = setup()
    void travel.sleep()
    await run(2800)
    travel.snap()
    expect(travel.isAsleep()).toBe(true)
    expect(travel.values.rotate.get()).toBe(-78)
    expect(travel.values.y.get()).toBeCloseTo(SIZE * 0.2)
    expect(hooks.behavior).toHaveBeenLastCalledWith('sleep')
    const count = writes(travel)
    await run(2000)
    expect(count()).toBe(0)
  })

  it('dismissal during the dive cancels the climb and Mầm returns to y = 0', async () => {
    const { travel, hooks } = setup()
    const card = box(new DOMRect(300, 400, 600, 120))
    void travel.climb(card)
    await run(100)
    void travel.home(false)
    await run(2500)
    expect(travel.mode()).toBe('dock')
    expect(travel.values.y.get()).toBeCloseTo(0)
    expect(hooks.perch.mock.calls.some(([perch]) => perch !== null)).toBe(false)
  })

  it('dismissal during the preparatory scroll cancels the climb', async () => {
    const { travel, hooks } = setup()
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true })
    window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
    const card = box(new DOMRect(300, 100, 600, 120))
    // Under the header and still moving for a while: makeRoom keeps waiting.
    const t0 = performance.now()
    card.getBoundingClientRect = () =>
      new DOMRect(
        300,
        100 + Math.min(53, (performance.now() - t0) * 0.05),
        600,
        120,
      )
    void travel.climb(card)
    await run(500) // past the dive, inside makeRoom
    expect(travel.mode()).toBe('dock')
    void travel.home(false)
    await run(2500)
    expect(travel.mode()).toBe('dock')
    expect(travel.values.y.get()).toBeCloseTo(0)
    expect(hooks.perch.mock.calls.some(([perch]) => perch !== null)).toBe(false)
  })

  it('a drag starts at the press point, so the first fast move already carries Mầm', () => {
    const { travel } = setup()
    // Pressed at (50, 750) on the dock at (24, 700); one move to (300, 500).
    expect(travel.dragStart(50, 750)).toBe(true)
    travel.dragMove(300, 500)
    expect(travel.values.x.get()).toBeCloseTo(250)
    expect(travel.values.y.get()).toBeCloseTo(-250)
  })

  it('a fast first move releases into a throw that carries the movement', async () => {
    const { travel } = setup()
    travel.dragStart(50, 750, performance.now())
    await run(16)
    travel.dragMove(300, 500)
    const dragged = travel.values.x.get()
    travel.dragEnd(300, 500)
    expect(travel.mode()).toBe('fly')
    await run(100)
    expect(travel.values.x.get()).toBeGreaterThan(dragged + 20)
  })

  it('holding still past 90 ms before the release is a plain drop', async () => {
    const { travel } = setup()
    travel.dragStart(70, 750, performance.now())
    await run(16)
    travel.dragMove(400, 300)
    await run(500)
    const held = travel.values.x.get()
    travel.dragEnd(400, 300)
    await run(100)
    // No sideways speed left over from the old flick.
    expect(Math.abs(travel.values.x.get() - held)).toBeLessThan(1)
  })
})
