'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import type { MamLoopingBehavior } from './mam-contract'
import {
  createMamOrchestrator,
  isMamIntent,
  type MamCurrent,
  type MamIntent,
  type MamPlayContext,
  type MamPlayOptions,
  type MamStageHost,
} from './mam-orchestrator'
import { MAM_VARIATIONS } from './mam-variations'
import {
  DANCE_MS,
  danceMotion,
  PARACHUTE_MS,
  parachuteDescent,
  SPIN_MS,
  spinHop,
} from './mam-scenes'
import type { MamTravel } from './mam-travel'
import { buildFlightPlan } from './mam-welcome-flight'
import type { MamPropId, MamPropPhase, MamSignSide } from './MamProps'
import { useMamShot } from './use-mam-shot'

export interface MamStageProp {
  id: MamPropId
  phase: MamPropPhase
  /** The cheer sign's side, decided when it appears: right of the dock when it fits, else above her head. */
  side?: MamSignSide
}

/** Room the sign needs to the right of her left edge, as a multiple of the dock size (the board and its margin). */
const SIGN_ROOM = 1.95

/**
 * The React side of the orchestrator (MB-896): what a running variation asks of the character (a one-shot, a
 * loop, concealment, a gaze) and of the dock (props, a travel scene) lands in state the host renders. The stage
 * has its own one-shot channel, so the host's older gates on pokes and drowsing never judge its commands.
 */
export function useMamStage({
  travel,
  dockRef,
  size,
  playLocal,
  getContext,
}: Readonly<{
  travel: MamTravel
  dockRef: RefObject<HTMLButtonElement | null>
  size: number
  /** The host's own one-shot channel (the airplane's closing wave goes there, as before). */
  playLocal: (kind: 'wave') => void
  getContext: () => MamPlayContext
}>) {
  const shot = useMamShot('stage')
  const [loop, setLoop] = useState<MamLoopingBehavior | null>(null)
  const [props, setProps] = useState<readonly MamStageProp[]>([])
  const [concealed, setConcealed] = useState(false)
  const [gaze, setGaze] = useState<number | null>(null)
  const [current, setCurrent] = useState<MamCurrent | null>(null)
  const [lastVariation, setLastVariation] = useState('')
  const latest = useRef({ travel, dockRef, size, playLocal, getContext, shot })
  useEffect(() => {
    latest.current = { travel, dockRef, size, playLocal, getContext, shot }
  })

  // The host callbacks read `latest` only when a variation runs (effects and timers), never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [orchestrator] = useState(() => {
    const host: MamStageHost = {
      oneShot: (kind) =>
        kind ? latest.current.shot.play(kind) : latest.current.shot.cancel(),
      loop: setLoop,
      prop: (id, show) => {
        // Read when the prop appears (an event, never while rendering).
        const rect = latest.current.dockRef.current?.getBoundingClientRect()
        const side: MamSignSide =
          rect &&
          rect.left + latest.current.size * SIGN_ROOM + 8 > window.innerWidth
            ? 'above'
            : 'right'
        setProps((list) =>
          show
            ? [...list.filter((p) => p.id !== id), { id, phase: 'in', side }]
            : list.map((p) => (p.id === id ? { ...p, phase: 'out' } : p)),
        )
      },
      conceal: setConcealed,
      gaze: setGaze,
      async scene(id) {
        const {
          travel: t,
          dockRef: ref,
          size: box,
          playLocal: wave,
        } = latest.current
        const rect = ref.current?.getBoundingClientRect()
        if (id === 'sleep') {
          await t.sleep()
          return true
        }
        // The hops of dance and spin are a pixel at the dock size; the host adds the travel (px scale: size over 96).
        if (id === 'dance')
          return t.scene(DANCE_MS, (ms) => danceMotion(ms, box / 96), 'hop')
        if (id === 'spin')
          return t.scene(SPIN_MS, (ms) => spinHop(ms, box / 96), 'hop')
        if (!rect) return false
        if (id === 'parachute')
          return t.scene(PARACHUTE_MS, (ms) =>
            parachuteDescent(ms, rect.top + box * 1.9),
          )
        const finished = await t.welcome(
          buildFlightPlan({
            vw: window.innerWidth,
            vh: window.innerHeight,
            dockRect: rect,
            size: box,
          }),
        )
        if (finished) wave('wave')
        return finished
      },
      settle() {
        setLoop(null)
        setConcealed(false)
        setGaze(null)
        setProps((list) =>
          list.some((p) => p.phase === 'in')
            ? list.map((p) => ({ ...p, phase: 'out' }))
            : list,
        )
      },
      clear() {
        latest.current.shot.cancel()
        // Only a scene's own motion is snapped; a perch or a drag belongs to someone else.
        const mode = latest.current.travel.mode()
        if (mode === 'welcome' || mode === 'scene' || mode === 'hop')
          latest.current.travel.snap()
        setLoop(null)
        setConcealed(false)
        setGaze(null)
        setProps([])
      },
    }
    return createMamOrchestrator({
      catalogue: MAM_VARIATIONS,
      host,
      context: () => latest.current.getContext(),
      onChange: (next) => {
        setCurrent(next)
        if (next) setLastVariation(next.variation)
      },
    })
  })

  // The gates are read at every play, and re-read after every render so a lost one cancels what it no longer allows.
  useEffect(() => {
    orchestrator.refresh()
  })
  useEffect(() => () => void orchestrator.cancel('unmount'), [orchestrator])

  const removeProp = useCallback(
    (id: MamPropId) => setProps((list) => list.filter((p) => p.id !== id)),
    [],
  )

  return {
    orchestrator,
    /** The stage's one-shot, for the character. */
    shot: shot.shot,
    loop,
    props,
    removeProp,
    concealed,
    gaze,
    current,
    lastVariation,
  }
}

/**
 * `?mamIntent=<INTENT>` (and optionally `&mamVariation=<id>`) plays one intent once, 400 ms after the host is
 * ready: for QA, captures and the demo. Every gate still applies; a skipped play is not retried.
 */
export function useMamDevIntent(
  ready: boolean,
  play: (intent: MamIntent, options: MamPlayOptions) => unknown,
) {
  const done = useRef(false)
  const latest = useRef(play)
  useEffect(() => {
    latest.current = play
  })
  useEffect(() => {
    if (!ready || done.current || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const intent = params.get('mamIntent')?.toUpperCase() ?? null
    if (!isMamIntent(intent)) return
    const timer = setTimeout(() => {
      done.current = true
      latest.current(intent, {
        source: 'dev',
        variation: params.get('mamVariation') ?? undefined,
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [ready])
}
