// Mầm's living motion (MB-814 design §A, §C, §D): climb to a card, drag and
// throw, hop home, sleep. A framework-free controller: the host feeds it the
// root and layer elements and renders its motion values; it reports what React
// must know through `hooks`. Every sequence carries a token, so snapping home
// or starting another sequence cancels the old one. Nothing runs while idle.
import { motionValue } from 'framer-motion'

import type { MamLoopingBehavior, MamOneShot } from './mam-contract'
import {
  climbRoom,
  ease,
  hopSteps,
  isFastThrow,
  perchClip,
  perchLeft,
  sampleVelocity,
  scrollNeeded,
  stepFlight,
  throwFrom,
  type MamEase,
  type VelocitySample,
} from './mam-motion'

export type MamTravelMode = 'dock' | 'perch' | 'drag' | 'fly' | 'home'

/** Viewport geometry of the perched character, for the bubble. */
export type MamPerch = Readonly<{
  left: number
  top: number
  cardTop: number
  size: number
}>

export type MamTravelHooks = Readonly<{
  mode: (mode: MamTravelMode) => void
  /** A behaviour of the travel itself; null hands it back to the host. */
  behavior: (behavior: MamLoopingBehavior | null) => void
  /** A Rive one-shot of the travel itself (drowsy, wake); null cuts it short. */
  oneShot: (kind: MamOneShot | null) => void
  attention: (direction: number) => void
  perch: (perch: MamPerch | null) => void
  asleep: (asleep: boolean) => void
}>

type Key = 'dockOff' | 'perchOff' | 'dy' | 'rot' | 'sx' | 'sy' | 'hands'

const EDGE_SLACK = 8
// The upright `drowsy` one-shot is 2.5 s long (asset v0.6); the lie-down follows it.
const DROWSY_MS = 2500
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** The bottom of the sticky app header, or 0 without one: nothing draws above it. */
export function mamVisibleTop() {
  return Math.max(
    0,
    document.querySelector('.ref-topbar')?.getBoundingClientRect().bottom ?? 0,
  )
}

/** The element whose top edge Mầm perches on: a marked inner surface, else the target. */
export const perchEdge = (target: Element): Element =>
  target.querySelector('[data-mam-perch]') ?? target

export function createMamTravel(hooks: MamTravelHooks) {
  const values = {
    x: motionValue(0),
    y: motionValue(0),
    rotate: motionValue(0),
    scaleX: motionValue(1),
    scaleY: motionValue(1),
    pawLeft: motionValue(0),
    pawRight: motionValue(0),
    pawY: motionValue(0),
    pawScale: motionValue(0),
  }
  const st = {
    mode: 'dock' as MamTravelMode,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spin: 0,
    dockOff: 0,
    perchOff: 0,
    dy: 0,
    rot: 0,
    sx: 1,
    sy: 1,
    hands: 0,
  }
  const ids: Partial<Record<Key, number>> = {}
  // Pending frame and timer handles, so `dispose` can release them.
  const frames = new Set<number>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const raf = (callback: () => void) => {
    const id = requestAnimationFrame(() => {
      frames.delete(id)
      callback()
    })
    frames.add(id)
    return id
  }
  const frame = () => new Promise<void>((resolve) => raf(resolve))
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id)
        resolve()
      }, ms)
      timers.add(id)
    })
  let size = 96
  let root: HTMLElement | null = null
  let layer: HTMLElement | null = null
  let origin = { left: 0, top: 0 }
  let token = 0
  let target: Element | null = null
  let lastRect: DOMRect | null = null
  let ready = false
  let lostSent = false
  let asleep = false
  // The upright yawn before the lie-down is playing.
  let drowsing = false
  // The throw that just ended was fast: land harder and shake off.
  let thrownFast = false
  let drag: { ox: number; oy: number; samples: VelocitySample[] } | null = null
  let following = 0
  // A summon is diving or scrolling toward its card (not yet perched).
  let climbing = false
  // The card left, or scrolled too high, while Mầm was perched.
  let onLost = () => {}

  const alive = (t: number) => t === token
  const measure = () => {
    const rect = root?.getBoundingClientRect()
    if (rect) origin = { left: rect.left, top: rect.top }
  }
  const visibleTop = mamVisibleTop
  // The card's top edge may be a marked inner surface (`data-mam-perch`) when the
  // target itself has no visible top (a section whose heading row sits above its cards).
  let edge: Element | null = null
  const targetRect = () => {
    if (target?.isConnected) {
      if (!edge?.isConnected || !target.contains(edge)) edge = perchEdge(target)
      lastRect = edge.getBoundingClientRect()
    }
    return lastRect
  }
  const setMode = (mode: MamTravelMode) => {
    st.mode = mode
    hooks.mode(mode)
  }

  function render() {
    let cx: number
    let cy: number
    const rect = st.mode === 'perch' ? targetRect() : null
    if (st.mode === 'dock') {
      cx = origin.left
      cy = origin.top + st.dockOff
    } else if (rect) {
      cx = perchLeft(rect.right, size, window.innerWidth)
      cy = rect.top + st.perchOff
      values.pawLeft.set(cx + size / 2 - 30 - origin.left)
      values.pawRight.set(cx + size / 2 + 12 - origin.left)
      values.pawY.set(rect.top - 9 - origin.top)
      values.pawScale.set(st.hands)
    } else {
      cx = st.x
      cy = st.y
    }
    if (layer)
      layer.style.clipPath = rect
        ? perchClip(origin.top, size, rect.top, visibleTop())
        : ''
    st.x = cx
    st.y = cy
    values.x.set(cx - origin.left)
    values.y.set(cy - origin.top + st.dy)
    values.rotate.set(st.rot)
    values.scaleX.set(st.sx)
    values.scaleY.set(st.sy)
  }

  // `owner` is the sequence's own token: a cancelled continuation must never
  // pick up the token of whatever replaced it.
  function tween(
    key: Key,
    to: number,
    ms: number,
    curve: MamEase = ease.out,
    owner = token,
  ) {
    if (owner !== token) return Promise.resolve()
    const id = (ids[key] = (ids[key] ?? 0) + 1)
    const from = st[key]
    const start = performance.now()
    if (ms <= 0) {
      st[key] = to
      render()
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      const step = () => {
        if (ids[key] !== id || owner !== token) return resolve()
        const p = Math.min(1, (performance.now() - start) / ms)
        st[key] = from + (to - from) * curve(p)
        render()
        if (p < 1) raf(step)
        else resolve()
      }
      raf(step)
    })
  }

  const squash = (k: number, owner = token) => {
    if (owner !== token) return Promise.resolve()
    st.sy = k
    st.sx = 2 - k
    void tween('sy', 1, 320, ease.back, owner)
    return tween('sx', 1, 320, ease.back, owner)
  }

  // ---- Perch: follow the card, close when it cannot be followed ----------

  function check() {
    const rect = targetRect()
    if (!ready || !rect) return
    const top = visibleTop()
    const gone =
      !target?.isConnected ||
      rect.bottom <= top ||
      rect.top >= window.innerHeight
    // The page cannot scroll further up: the card stays, clipped at the header.
    // A few px of slack: the preparatory scroll lands the edge on the line, and
    // smooth-scroll rounding must not read as "scrolled out of reach".
    const tooHigh =
      rect.top < top + climbRoom(size) - EDGE_SLACK && window.scrollY > 0
    if (gone || tooHigh) {
      if (!lostSent) onLost()
      lostSent = true
    } else hooks.perch({ left: st.x, top: st.y, cardTop: rect.top, size })
  }

  function follow() {
    if (following) return
    following = raf(() => {
      following = 0
      if (st.mode !== 'perch' || !target) return
      measure()
      render()
      check()
    })
  }

  const listen = (on: boolean) => {
    const method = on ? 'addEventListener' : 'removeEventListener'
    window[method]('scroll', follow, { capture: true, passive: true })
    window[method]('resize', follow)
  }

  async function makeRoom(el: Element, t: number) {
    const surface = perchEdge(el)
    const need = scrollNeeded(
      surface.getBoundingClientRect().top,
      visibleTop(),
      size,
      window.innerHeight,
    )
    // Up is capped by how far the page can scroll; down is clamped by the browser.
    const top = need < 0 ? -Math.min(-need, window.scrollY) : need
    if (top === 0 || typeof window.scrollBy !== 'function') return
    window.scrollBy({ top, behavior: 'smooth' })
    // Wait for the page to stop moving; focus is never touched.
    const start = performance.now()
    let last = Number.NaN
    let still = 0
    while (alive(t) && still < 3 && performance.now() - start < 900) {
      await frame()
      const top = surface.getBoundingClientRect().top
      still = top === last ? still + 1 : 0
      last = top
    }
  }

  const retreatDown = async (t: number) => {
    hooks.behavior('gentle')
    void tween('hands', 0, 200, ease.in, t)
    await tween('perchOff', 12, 230, ease.inBack, t)
    return alive(t)
  }

  function leavePerch() {
    ready = false
    listen(false)
    target = null
    st.perchOff = 0
    st.hands = 0
    st.dockOff = size + 60
    values.pawScale.set(0)
    setMode('dock')
    render()
  }

  async function wakeSteps(t: number, quick: boolean) {
    // Leaving `sleep` takes the blanket off; the one-shot rubs the eyes and stretches (1.2 s).
    hooks.behavior(null)
    hooks.oneShot('wake')
    await wait(180)
    if (!alive(t)) return
    asleep = false
    hooks.asleep(false)
    void tween('dy', -28, 220, ease.out, t)
    await tween('rot', 10, 300, ease.back, t)
    if (!alive(t)) return
    void tween('rot', 0, 260, ease.back, t)
    await tween('dy', 0, 260, ease.in, t)
    if (!alive(t) || quick) return
    await squash(0.84, t)
    if (!alive(t)) return
    hooks.behavior('happy')
    await wait(900)
  }

  // ---- Public sequences ---------------------------------------------------

  /** Instantly home: route change, modal, suppression, reduced motion. */
  function snap() {
    // Always invalidate: sleep, wake and the tip hop all run in dock mode with
    // zero displacement, and must be cancellable too.
    token += 1
    drag = null
    drowsing = false
    thrownFast = false
    hooks.oneShot(null)
    climbing = false
    ready = false
    lostSent = false
    listen(false)
    target = null
    Object.assign(st, {
      dockOff: 0,
      perchOff: 0,
      hands: 0,
      sx: 1,
      sy: 1,
      vx: 0,
      vy: 0,
      spin: 0,
    })
    // A sleeping Mầm stays asleep, in the settled pose, not mid-transform.
    Object.assign(st, asleep ? { dy: size * 0.2, rot: -78 } : { dy: 0, rot: 0 })
    values.pawScale.set(0)
    setMode('dock')
    hooks.perch(null)
    hooks.attention(0)
    hooks.behavior(asleep ? 'sleep' : null)
    render()
  }

  async function climb(el: Element) {
    if (st.mode !== 'dock' && st.mode !== 'perch') snap()
    const t = (token += 1)
    ready = false
    lostSent = false
    climbing = true
    hooks.perch(null)
    measure()
    if (asleep && st.mode === 'dock') await wakeSteps(t, true)
    if (!alive(t)) return
    hooks.behavior('curious')
    if (st.mode === 'perch') {
      if (!(await retreatDown(t))) return
      hooks.behavior('curious')
    } else await tween('dockOff', size + 60, 260, ease.inBack, t)
    if (!alive(t)) return
    await makeRoom(el, t)
    if (!alive(t)) return
    if (!el.isConnected) {
      climbing = false
      return
    }
    // Place Mầm behind the card (the clip hides it), then climb in two steps.
    target = el
    edge = null
    lastRect = null
    st.perchOff = 10
    st.hands = 0
    Object.assign(st, { dockOff: 0, dy: 0, rot: 0, sx: 1, sy: 1 })
    if (st.mode !== 'perch') {
      setMode('perch')
      listen(true)
    }
    hooks.attention(-0.6)
    measure()
    render()
    await tween('hands', 1, 200, ease.back, t)
    await wait(110)
    if (!alive(t)) return
    st.rot = -5
    void tween('rot', 0, 360, ease.back, t)
    await tween('perchOff', -size * 0.3, 190, ease.out, t)
    await wait(90)
    if (!alive(t)) return
    await tween('perchOff', -size * 0.64, 330, ease.back, t)
    if (!alive(t)) return
    climbing = false
    ready = true
    hooks.behavior(null)
    check()
  }

  /** Back to the dock; `thanks` first plays the happy squash. */
  async function home(thanks: boolean) {
    if (st.mode !== 'perch') {
      if (!climbing) return
      // Dismissed during the dive or the preparatory scroll: cancel the climb
      // and bring Mầm back up from where it is.
      const t = (token += 1)
      climbing = false
      hooks.perch(null)
      hooks.attention(0)
      const below = st.dockOff > 0
      await tween(
        'dockOff',
        0,
        below ? 460 : 200,
        below ? ease.back : ease.out,
        t,
      )
      if (alive(t)) hooks.behavior(null)
      return
    }
    const t = (token += 1)
    climbing = false
    ready = false
    hooks.perch(null)
    if (thanks) {
      hooks.behavior('happy')
      await squash(0.9, t)
      await wait(260)
      if (!alive(t)) return
    }
    if (!(await retreatDown(t))) return
    leavePerch()
    hooks.attention(0)
    await tween('dockOff', 0, 460, ease.back, t)
    if (alive(t)) hooks.behavior(null)
  }

  async function sleep() {
    if (asleep || drowsing || st.mode !== 'dock' || st.dockOff !== 0) return
    const t = (token += 1)
    drowsing = true
    hooks.oneShot('drowsy')
    await wait(DROWSY_MS)
    if (!alive(t)) return
    drowsing = false
    asleep = true
    hooks.asleep(true)
    // `drowsy` ends on the sleep face; `sleep` (and its blanket) takes over as Mầm lies down.
    hooks.behavior('sleep')
    hooks.oneShot(null)
    void tween('dy', size * 0.2, 700, ease.inOut, t)
    await tween('rot', -78, 800, ease.inOut, t)
  }

  /** Input during the yawn: Mầm perks up instead of falling asleep. */
  function stir() {
    if (!drowsing) return
    token += 1
    drowsing = false
    hooks.oneShot(null)
  }

  async function wake(quick = false) {
    if (!asleep) return
    const t = (token += 1)
    await wakeSteps(t, quick)
    if (alive(t)) hooks.behavior(null)
  }

  function wakeQuiet() {
    if (!asleep) return
    token += 1
    asleep = false
    hooks.oneShot(null)
    hooks.asleep(false)
    hooks.behavior(null)
    Object.assign(st, { dy: 0, rot: 0 })
    render()
  }

  async function tipHop() {
    if (st.mode !== 'dock' || asleep) return
    const t = (token += 1)
    await tween('dockOff', -26, 200, ease.out, t)
    if (!alive(t)) return
    await tween('dockOff', 0, 300, ease.back, t)
  }

  // ---- Drag, throw, hop home (design §C) ----------------------------------

  /** `x`, `y` and `at` are where and when the press began. */
  function dragStart(x: number, y: number, at = performance.now()) {
    if (st.mode !== 'dock') return false
    token += 1
    drowsing = false
    hooks.oneShot(null)
    measure()
    wakeQuiet()
    st.x = origin.left
    st.y = origin.top + st.dockOff
    st.dockOff = 0
    drag = { ox: x - st.x, oy: y - st.y, samples: [{ t: at, x, y }] }
    setMode('drag')
    hooks.behavior('dangle') // held by the pointer: legs kick, arms up
    render()
    return true
  }

  function dragMove(x: number, y: number) {
    if (!drag) return
    const now = performance.now()
    drag.samples = [...drag.samples, { t: now, x, y }].filter(
      (sample) => now - sample.t < 90,
    )
    const left = x - drag.ox
    const pull = left - st.x
    st.x = left
    st.y = Math.min(y - drag.oy, origin.top)
    st.rot += (clamp(-pull * 1.6, -28, 28) - st.rot) * 0.25
    render()
  }

  function dragEnd(x?: number, y?: number) {
    if (!drag) return
    // Age the samples against the release, and add the release point: a hold
    // longer than 90 ms leaves nothing to throw with.
    const now = performance.now()
    const samples = [
      ...drag.samples,
      ...(x === undefined || y === undefined ? [] : [{ t: now, x, y }]),
    ].filter((sample) => now - sample.t < 90)
    const { vx, vy } = sampleVelocity(samples)
    drag = null
    thrownFast = isFastThrow(vx, vy)
    Object.assign(st, throwFrom(vx, vy))
    setMode('fly')
    hooks.behavior('happy')
    const owner = token
    let last = performance.now()
    const loop = () => {
      if (st.mode !== 'fly' || owner !== token) return
      const now = performance.now()
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const { flight, event } = stepFlight(st, dt, {
        minX: 4,
        maxX: window.innerWidth - size - 4,
        floor: origin.top,
      })
      Object.assign(st, flight)
      hooks.behavior(st.vy > 0 ? 'curious' : 'happy')
      if (event === 'bounce') void squash(thrownFast ? 0.7 : 0.82, owner)
      render()
      if (event === 'land') void land()
      else raf(loop)
    }
    raf(loop)
  }

  async function land() {
    const t = (token += 1)
    setMode('home')
    Object.assign(st, { vx: 0, vy: 0, spin: 0 })
    hooks.behavior('gentle')
    if (thrownFast) {
      // A hard landing: bigger squash, then a quick shake-off (transform only, never dizzy).
      void squash(0.62, t)
      for (const [deg, ms] of [
        [9, 70],
        [-8, 100],
        [5, 90],
        [0, 90],
      ] as const)
        await tween('rot', deg, ms, ease.out, t)
      thrownFast = false
      await wait(150)
    } else {
      void squash(0.74, t)
      void tween('rot', 0, 380, ease.back, t)
      await wait(520)
    }
    if (!alive(t)) return
    hooks.behavior('happy')
    for (const step of hopSteps(st.x, origin.left)) {
      if (!alive(t)) return
      const direction = Math.sign(step)
      hooks.attention(direction * 0.8)
      const from = st.x
      const start = performance.now()
      await new Promise<void>((resolve) => {
        const hop = () => {
          if (!alive(t)) return resolve()
          const p = Math.min(1, (performance.now() - start) / 250)
          st.x = from + step * p
          st.dy = -22 * Math.sin(Math.PI * p)
          st.rot = direction * 6 * Math.sin(Math.PI * p)
          render()
          if (p < 1) raf(hop)
          else resolve()
        }
        raf(hop)
      })
      if (!alive(t)) return
      Object.assign(st, { dy: 0, rot: 0 })
      void squash(0.9, t)
      await wait(40)
    }
    if (!alive(t)) return
    hooks.attention(0)
    Object.assign(st, { dockOff: 0, dy: 0, rot: 0 })
    setMode('dock')
    hooks.behavior(null)
    render()
  }

  return {
    values,
    attach(next: { root: HTMLElement | null; size: number }) {
      root = next.root
      size = next.size
      measure()
    },
    /** The clipped layer; it remounts with the dock, so it has its own setter. */
    setLayer(next: HTMLElement | null) {
      layer = next
    },
    climb,
    home,
    snap,
    sleep,
    wake,
    wakeQuiet,
    stir,
    tipHop,
    dragStart,
    dragMove,
    dragEnd,
    onLost(handler: () => void) {
      onLost = handler
    },
    isAsleep: () => asleep,
    mode: () => st.mode,
    dispose() {
      token += 1
      drag = null
      listen(false)
      frames.forEach((id) => cancelAnimationFrame(id))
      timers.forEach((id) => clearTimeout(id))
      frames.clear()
      timers.clear()
      following = 0
    },
  }
}

export type MamTravel = ReturnType<typeof createMamTravel>
