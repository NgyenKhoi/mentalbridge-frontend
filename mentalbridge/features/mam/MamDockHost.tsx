'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Leaf, MessageCircleQuestion } from 'lucide-react'

import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'

import { MamAirplane, MamFlightFx } from './MamAirplane'
import { MamProp, mamPropLayers, type MamPropLayer } from './MamProps'
import { MamBubble, MamCelebrationBubble, MamNoticeBubble } from './MamBubble'
import { MamCharacter, type MamRenderStatus } from './MamCharacter'
import styles from './MamDock.module.css'
import { useMamAccountId } from './MamDockSlot'
import { MamDizzy } from './MamDizzy'
import { hasMamRendererFailed, markMamRendererFailed } from './mam-failure'
import { MAM_WELCOME_ENABLED, type MamLoopingBehavior } from './mam-contract'
import {
  setMamHidden,
  setMamMotionOff,
  setMamMuted,
  setMamTipSeen,
  useMamPreferences,
} from './mam-preferences'
import {
  createMamTravel,
  type MamPerch,
  type MamTravelMode,
} from './mam-travel'
import { MAM_INPUT_EVENTS, useMamIdle } from './use-mam-idle'
import { useMamIdleActions } from './use-mam-idle-actions'
import { MAM_PRIORITY, type MamPlayContext } from './mam-orchestrator'
import { useMamDevIntent, useMamStage } from './use-mam-stage'
import { isTypingTarget, useMamGaze } from './mam-gaze'
import { NO_POKE, pokeClick } from './mam-poke'
import { useMamShot } from './use-mam-shot'
import { mamRouteMode } from './mam-routes'
import { markWelcomeAttempted, welcomeAttempted } from './mam-welcome-attempts'
import {
  useMamCelebrationNote,
  useMamCelebrations,
} from './use-mam-celebrations'
import { useMamSaved } from './mam-saved'
import { mamHoldMs } from './mam-lines'
import { useMamTrajectory } from './use-mam-trajectory'
import { useMamDropRing } from './use-mam-drop-ring'
import { useMamSummon } from './use-mam-summon'
import {
  useMamAway,
  useMamCompanionDialog,
  useMamSuppressed,
} from './use-mam-suppressed'
import { useHasMamElementTarget, useMamPageTargetValue } from './use-mam-target'

// Matches the shell's off-canvas sidebar breakpoint.
const COMPACT_QUERY = '(max-width: 900px)'
const COARSE_QUERY = '(pointer: coarse)'
// A press that moves less than this is a tap, not a drag (design §C).
const DRAG_SLOP_PX = 6
const TIP_DELAY_MS = 1400
// An expressive look grows her by this much, anchored at her feet (desktop, compact).
const MAM_EMPHASIS = 1.25
const MAM_EMPHASIS_COMPACT = 1.15
// Beside the journal editor she sits this far left of its panel, and the panel needs this much room to the left.
const GAP_PX = 16
const GAP_ROOM_PX = 32
// Her normal bottom edge; beside the editor she never sits lower than this.
const DOCK_BOTTOM_PX = 24
// A panel with no entrance animation is measured anyway after this long.
const PANEL_SETTLE_MS = 350
const DIZZY_TEXT =
  'Mình đang bị choáng một chút nên tạm thời chưa giúp được. Bạn vẫn dùng trang bình thường nha, lát nữa gọi lại mình nè.'
const PAGE_ACTIONS =
  'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'

function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function subscribeCoarse(onChange: () => void) {
  const query = window.matchMedia(COARSE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const ease = [0.16, 1, 0.3, 1] as const

// MB-894: the welcome airplane (docs/ADR_MAM_RIVE_V2_CONTRACT.md). Once per account and session,
// on the first FULL route reached (MB-895).
const WELCOME_DELAY_MS = 700
const WELCOME_READY_MS = 4000
const WELCOME_CANCEL_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
] as const
const welcomeKey = (accountId: string) =>
  `mentalbridge_mam_welcome:${accountId}`
const isFullRoute = (pathname: string) => mamRouteMode(pathname) === 'full'
// A text field, or any control inside a form: Mầm keeps still while the user works there.
const formControlOf = (target: EventTarget | null) =>
  target instanceof Element &&
  (isTypingTarget(target) || target.closest('form') !== null)
    ? target
    : null
const markWelcome = (accountId: string | null) => {
  try {
    if (accountId) sessionStorage.setItem(welcomeKey(accountId), '1')
  } catch {
    // Storage may be blocked: the scene then replays on the next load, which is harmless.
  }
}
/** `?mamWelcome=1` replays for QA and demos; an automated browser only plays it that way. */
function welcomeDue(
  pathname: string,
  accountId: string | null,
  allowReplay: boolean,
) {
  if (
    !MAM_WELCOME_ENABLED ||
    typeof window === 'undefined' ||
    !accountId ||
    !isFullRoute(pathname)
  )
    return false
  const replay =
    allowReplay &&
    new URLSearchParams(window.location.search).get('mamWelcome') === '1'
  if (navigator.webdriver && !replay) return false
  if (replay) return true
  // Already waited, was cancelled or failed its start check on this page load.
  if (welcomeAttempted(accountId)) return false
  try {
    return sessionStorage.getItem(welcomeKey(accountId)) === null
  } catch {
    return true
  }
}

/** The one Mầm per tab, loaded by `MamDock` only where it shows (MB-781). */
export function MamDockHost({ pathname }: Readonly<{ pathname: string }>) {
  const menuId = useId()
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLButtonElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const celebrationRef = useRef<HTMLDivElement | null>(null)
  const noticeRef = useRef<HTMLDivElement | null>(null)
  const focusAfterToggle = useRef(false)
  const { hidden, muted, motionOff, tipSeen } = useMamPreferences()
  const suppressed = useMamSuppressed()
  const awayByRule = useMamAway()
  const osReduced = useReactiveReducedMotion()
  const mode = mamRouteMode(pathname)
  const quiet = mode === 'quiet'
  // QUIET (MB-895): while a form has focus Mầm stays visible and still, instead of hiding.
  const [focusedControl, setFocusedControl] = useState<Element | null>(null)
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) =>
      setFocusedControl(formControlOf(event.target))
    const onFocusOut = (event: FocusEvent) =>
      setFocusedControl(formControlOf(event.relatedTarget))
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  // MB-895: beside the journal editor (a desktop modal that opts in) she sits in the gap left of its panel,
  // drawn above its backdrop, and keeps her slow idle life: no form-focus stillness, no gaze, no bubbles.
  // With no room for her there (panel.left < size + 32) she is away.
  const companion = useMamCompanionDialog()
  const above = quiet && companion !== null
  const [panelHit, setPanelHit] = useState(false)
  const [gap, setGap] = useState<{ left: number; bottom: number } | null>(null)
  // The opt-in is honoured on QUIET routes only; on any other route the dialog hides her like every modal.
  const away =
    awayByRule || (companion !== null && !quiet) || (above && panelHit)
  // A focused field that left the DOM (a form that unmounted, a route change) no longer counts.
  const formFocused = focusedControl !== null && focusedControl.isConnected
  const quietBusy = quiet && formFocused && !above
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  )
  const coarse = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE_QUERY).matches,
    () => false,
  )
  const [open, setOpen] = useState(false)
  // MB-897: a trajectory or event bubble is open; an achievement's celebration waits for it (derived below).
  const [trajectoryOpen, setTrajectoryOpen] = useState(false)
  // Each time the dizzy message opens, the swirl and the stars play again.
  const [dizzyPlay, setDizzyPlay] = useState(0)
  // The one-time tip and the dizzy message: a short bubble at the dock.
  const [notice, setNotice] = useState<{
    kind: 'tip' | 'dizzy'
    returnFocus: HTMLElement | null
  } | null>(null)

  // A modal, a hidden tab or a route change closes the menu (ADR `mam.dismiss`).
  const [closedFor, setClosedFor] = useState({ suppressed, pathname })
  if (closedFor.suppressed !== suppressed || closedFor.pathname !== pathname) {
    setClosedFor({ suppressed, pathname })
    if (suppressed || closedFor.pathname !== pathname) {
      setOpen(false)
      setNotice(null)
    }
  }

  const menuOpen = open && !hidden

  // Reduced motion keeps the fades and drops the travel; exits are quicker.
  const reduced = motionOff || osReduced
  // A renderer failure (not an unsupported device) leaves Mầm dizzy until reload.
  const [dizzy, setDizzy] = useState(hasMamRendererFailed)
  const pageTarget = useMamPageTargetValue()
  const [status, setStatus] = useState<MamRenderStatus>('loading')
  // Travel (MB-814): a reduced-motion setting keeps Mầm put. QUIET routes still allow summon and drag.
  const still = reduced
  const canTravel = !hidden && !away && !suppressed && !still && !dizzy
  const { summon, summonPage, summonOn, choose, go, close, behavior } =
    useMamSummon({
      pathname,
      enabled: !hidden && !suppressed,
      reducedMotion: reduced,
      dockRef,
      bubbleRef,
      canPoint: canTravel && status === 'ready',
      onBlocked: dizzy
        ? (returnFocus) => {
            setNotice({
              kind: 'dizzy',
              returnFocus: returnFocus ?? dockRef.current,
            })
            setDizzyPlay((value) => value + 1)
          }
        : undefined,
    })
  const dockBubble = summon?.anchor.kind === 'dock'
  const accountId = useMamAccountId()
  if (notice && (summon || menuOpen)) setNotice(null)
  // A renderer failure retires what is open: the menu, the summon and its request.
  if (dizzy && open) setOpen(false)
  useEffect(() => {
    if (!dizzy || !summon) return
    // Focus that sat in the retired bubble goes back to what asked (else the
    // dock), never to <body>.
    const active = document.activeElement
    const lost =
      !active ||
      active === document.body ||
      Boolean(bubbleRef.current?.contains(active)) ||
      Boolean(rootRef.current?.contains(active))
    close(lost)
    if (!lost) return
    // What asked may not take focus (a plain card); the exiting bubble must not keep it.
    const now = document.activeElement
    if (!now || now === document.body || bubbleRef.current?.contains(now))
      dockRef.current?.focus({ preventScroll: true })
  }, [dizzy, summon, close])

  // The controller drives the character; React only learns what it must render.
  const size = compact ? 72 : 96
  const thanksRef = useRef(false)
  const dragRef = useRef<{
    id: number
    x: number
    y: number
    t: number
    on: boolean
  } | null>(null)
  const afterDrag = useRef(false)
  const [travelMode, setTravelMode] = useState<MamTravelMode>('dock')
  const [travelBehavior, setTravelBehavior] =
    useState<MamLoopingBehavior | null>(null)
  const [attention, setAttention] = useState(0)
  // Welcome: waiting (the dock character is held back) until it starts, is skipped or is cancelled.
  // `?mamWelcome=1` replays once per page load.
  const [replayUsed, setReplayUsed] = useState(false)
  const welcomeAllowed = !hidden && !reduced && !dizzy
  const [welcome, setWelcome] = useState<'waiting' | 'done'>(() =>
    welcomeAllowed && welcomeDue(pathname, accountId, true)
      ? 'waiting'
      : 'done',
  )
  // Reaching a FULL route later in the session makes the scene due if it has not played (derived state, guarded by the path change).
  const [arrivedAt, setArrivedAt] = useState(pathname)
  if (arrivedAt !== pathname) {
    setArrivedAt(pathname)
    if (
      welcome === 'done' &&
      welcomeAllowed &&
      welcomeDue(pathname, accountId, !replayUsed)
    )
      setWelcome('waiting')
  }
  // A hidden Mầm, a stilled one, another page, a fallback or a broken renderer ends the wait (a derived-state reset, guarded so it runs once).
  if (
    welcome === 'waiting' &&
    (!welcomeAllowed || !isFullRoute(pathname) || status === 'fallback')
  )
    setWelcome('done')
  const [perch, setPerch] = useState<MamPerch | null>(null)
  const [asleep, setAsleep] = useState(false)
  // The host's own one-shot channel: drowsy and wake (travel), pokes, idle actions.
  const local = useMamShot()
  const pokes = useRef(NO_POKE)
  const flightFx = useRef<MamFlightFx>(null)
  const [travel] = useState(() =>
    createMamTravel({
      mode: setTravelMode,
      behavior: setTravelBehavior,
      oneShot: (kind) => (kind ? local.play(kind) : local.cancel()),
      attention: setAttention,
      perch: setPerch,
      asleep: setAsleep,
    }),
  )
  useEffect(() => {
    travel.onPuff((x, y, scale) => flightFx.current?.emit(x, y, scale))
  }, [travel])
  // MB-896: the orchestrator's host adapter. Created here, before every gate that reads `stage.current`; the gates it
  // asks about are written into `contextRef` once they are known (below).
  const contextRef = useRef<Omit<MamPlayContext, 'viewportWidth'>>({
    routeMode: 'hidden',
    reduced: true,
    hidden: true,
    gates: {
      calm: false,
      present: false,
      festive: false,
      touch: false,
      autonomous: false,
    },
  })
  const getContext = useCallback(
    (): MamPlayContext => ({
      ...contextRef.current,
      viewportWidth: window.innerWidth,
    }),
    [],
  )
  const stage = useMamStage({
    travel,
    dockRef,
    size,
    playLocal: local.play,
    getContext,
  })
  const orchestrator = stage.orchestrator
  const layerRef = useCallback(
    (node: HTMLElement | null) => travel.setLayer(node),
    [travel],
  )
  // The card left or scrolled out of reach: close the summon, Mầm goes home.
  useEffect(() => {
    travel.onLost(() => close(false))
  })
  useEffect(() => {
    travel.attach({ root: rootRef.current, size })
  }, [travel, size])
  useEffect(() => () => travel.dispose(), [travel])
  // A route change, a modal, suppression or reduced motion snaps Mầm home at
  // once, and a stilled Mầm wakes without ceremony.
  useEffect(() => {
    travel.snap()
  }, [travel, pathname])
  useEffect(() => {
    if (!canTravel) travel.snap()
    if (still || dizzy) travel.wakeQuiet()
  }, [travel, canTravel, still, dizzy])
  // The summoned card: climb to it; a closed summon sends Mầm home.
  const element = summon?.element ?? null
  useEffect(() => {
    const thanks = thanksRef.current
    thanksRef.current = false
    if (element && canTravel) void travel.climb(element)
    else void travel.home(thanks)
  }, [travel, element, canTravel])
  // Escape snaps a flying or hopping Mầm home (a perched one retreats instead).
  useEffect(() => {
    if (travelMode === 'dock' || travelMode === 'perch') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') travel.snap()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [travel, travelMode])
  const climbing = canTravel && element !== null
  const perched = travelMode === 'perch'
  const flying =
    travelMode === 'drag' || travelMode === 'fly' || travelMode === 'home'
  const welcoming = travelMode === 'welcome'
  // A cinematic variation (the airplane, the parachute, the plant pot) holds the page's front, is click-through and
  // ends on any input. An expressive hop (`hop` mode) is none of that: she stays clickable in the dock layer.
  const staged =
    welcoming || travelMode === 'scene' || stage.current?.tier === 'cinematic'
  // A drag or a throw must not select the page text it sweeps over.
  const carried = travelMode === 'drag' || travelMode === 'fly'
  useEffect(() => {
    if (!carried) return
    const style = document.documentElement.style
    const { userSelect, webkitUserSelect } = style
    style.userSelect = 'none'
    style.webkitUserSelect = 'none'
    return () => {
      style.userSelect = userSelect
      style.webkitUserSelect = webkitUserSelect
    }
  }, [carried])

  // ADR layering: page actions stay clickable; focused elements stay clear.
  const [yielding, setYielding] = useState<'none' | 'overlap' | 'focus'>('none')

  // The top layer sits above the modal backdrop; the root is a manual popover only while she is beside it.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!above || !root) return
    try {
      root.showPopover()
    } catch {
      // No Popover API: `useMamCompanionDialog` never reports a dialog then.
    }
    return () => {
      try {
        root.hidePopover()
      } catch {
        // The attribute is already gone: the browser hid her.
      }
    }
  }, [above])
  // The page under the modal is inert, so she takes the gap left of the panel (over the sidebar), her
  // bottom edge on the panel's (never below her dock). She stays hidden until the panel's entrance has
  // settled, since it scales the panel and she would slide sideways. It follows a resize and the panel.
  useEffect(() => {
    const panel = companion?.querySelector<HTMLElement>('[data-mam-panel]')
    if (!above || !panel) return
    let frame: number | null = null
    const measure = (settled: boolean) => {
      frame = null
      if (
        !settled &&
        (panel.getAnimations?.() ?? []).some(
          (animation) => animation.playState === 'running',
        )
      )
        return
      const box = panel.getBoundingClientRect()
      setPanelHit(box.left < size + GAP_ROOM_PX)
      setGap({
        left: box.left - size - GAP_PX,
        bottom: Math.max(DOCK_BOTTOM_PX, window.innerHeight - box.bottom),
      })
    }
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(() => measure(false))
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(panel)
    window.addEventListener('resize', schedule)
    panel.addEventListener('animationend', schedule)
    schedule()
    const fallback = setTimeout(() => measure(true), PANEL_SETTLE_MS)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      clearTimeout(fallback)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      panel.removeEventListener('animationend', schedule)
      setPanelHit(false)
      setGap(null)
    }
  }, [above, companion, size])

  // MB-773: nothing plays unless every no-interrupt condition holds.
  const celebration = useMamCelebrations({
    accountId,
    pathname,
    allowed:
      mode === 'full' &&
      status === 'ready' &&
      !hidden &&
      !muted &&
      !reduced &&
      !suppressed &&
      !dizzy &&
      !flying &&
      !staged &&
      !summon &&
      !notice &&
      !menuOpen,
    blocked: yielding !== 'none' || trajectoryOpen,
  })
  // A save Care confirmed (MB-772): one light_success under the same conditions.
  const saved = useMamSaved(
    status === 'ready' &&
      !hidden &&
      !muted &&
      !reduced &&
      !suppressed &&
      !dizzy &&
      !flying &&
      !staged &&
      !summon &&
      !notice &&
      !menuOpen &&
      yielding === 'none',
    pathname,
  )
  // MB-897: Mầm's daily trajectory and verified events. Hidden, away (a modal, a safety hide zone), muted and a
  // failed renderer drop them; anything else only waits: a form being edited or just saved (the check-in keeps focus
  // for a moment after its own save), a menu, a summon, a look that runs, the welcome, a page action under her.
  const trajectory = useMamTrajectory({
    accountId,
    mode,
    hard: hidden || muted || away || dizzy,
    ready:
      status === 'ready' &&
      !suppressed &&
      !flying &&
      !staged &&
      !summon &&
      !notice &&
      !menuOpen &&
      welcome === 'done' &&
      stage.current === null &&
      yielding === 'none' &&
      celebration.bubbleText === null &&
      celebration.oneShot === null &&
      saved === null,
  })
  const trajectoryText = trajectory.reaction?.text ?? null
  if (trajectoryOpen !== (trajectoryText !== null))
    setTrajectoryOpen(trajectoryText !== null)
  const dismissTrajectory = trajectory.dismiss
  const dismissCelebration = useRef(celebration.dismiss)
  useEffect(() => {
    dismissCelebration.current = () => {
      celebration.dismiss()
      dismissTrajectory()
    }
  })
  // Stable: the bubble restarts its auto-hide timer whenever `onClose` changes.
  const closeBubble = useCallback(() => dismissCelebration.current(), [])
  const celebrating = celebration.bubbleText !== null || trajectoryOpen
  const note = useMamCelebrationNote({
    accountId,
    open: menuOpen && (muted || reduced),
  })
  // A celebration wakes a sleeping Mầm, quietly: its one-shot takes over.
  const shot = celebration.oneShot ?? saved
  useEffect(() => {
    if (asleep && (shot || celebrating)) travel.wakeQuiet()
  }, [travel, asleep, shot, celebrating])
  // MB-818: touch and idle motion share the celebrations' gates (`canTravel` is false for
  // reduced motion, no-interrupt zones, hidden and a failed renderer) and never overlap a
  // celebration, a save nod or the answer bubble. The menu and the tip may stay open.
  const calm = canTravel && status === 'ready'
  // MB-819: a page answer's card is on screen and Mầm is perched there with the bubble open.
  const lead = summon?.lead
  const pointReady =
    calm &&
    lead !== undefined &&
    summon?.phase === 'answer' &&
    perched &&
    perch !== null
  const touchOk =
    calm &&
    travelMode === 'dock' &&
    yielding === 'none' &&
    !dockBubble &&
    !celebrating &&
    !shot
  // Autonomous life (gaze, idle actions): also not while muted, asleep or anything is open.
  const autonomous =
    touchOk &&
    !quietBusy &&
    !muted &&
    !asleep &&
    !menuOpen &&
    !summon &&
    !notice
  // Drowsy and wake belong to the travel controller and run wherever it runs them; an idle
  // action stops with the autonomous gates, a poke only with the touch gates.
  const localKind = local.shot?.kind
  const localShot =
    local.shot &&
    (localKind === 'drowsy' ||
    localKind === 'wake' ||
    localKind === 'hop_down' ||
    localKind === 'wave'
      ? calm
      : localKind === 'point'
        ? pointReady
        : touchOk)
      ? local.shot
      : null
  // Withdrawn eligibility drops the command for good, so it never resurfaces mid-way.
  const dropShot = local.shot !== null && localShot === null
  const cancelLocal = local.cancel
  useEffect(() => {
    if (dropShot) cancelLocal()
  }, [dropShot, cancelLocal])
  // `point` plays once per answer: a later answer is another lead.
  const pointedAt = useRef<typeof lead>(undefined)
  const playLocal = local.play
  useEffect(() => {
    if (!pointReady || pointedAt.current === lead) return
    pointedAt.current = lead
    playLocal('point')
  }, [pointReady, lead, playLocal])
  // The dock bubble that asked leaves for the card's: until Mầm is perched and the card's
  // bubble takes focus, it waits on the dock, never on <body> (the asking button is gone).
  useEffect(() => {
    if (!lead || perch) return
    const active = document.activeElement
    if (
      !active ||
      active === document.body ||
      bubbleRef.current?.contains(active)
    )
      dockRef.current?.focus({ preventScroll: true })
  }, [lead, perch])
  const lively = autonomous && !local.shot && stage.current === null

  // ---- MB-896 orchestrator ----
  // The old gates of an achievement's celebration and of a save's nod, kept as they were: the first lets the page
  // yield to an action while it plays, the second stops there.
  const festive =
    calm && !muted && !flying && !staged && !summon && !notice && !menuOpen
  const present = festive && yielding === 'none'
  // `touchOk` also asks for the dock mode; a dance or a spin (`hop` mode) still counts as docked.
  const touchStage =
    calm &&
    (travelMode === 'dock' || travelMode === 'hop') &&
    yielding === 'none' &&
    !dockBubble &&
    celebration.bubbleText === null &&
    !shot
  // What the orchestrator may start, and keep running, is read from here: the same gates as before, one place. A layout
  // effect, so the stage's own re-check (a passive effect) always sees this render's gates.
  useLayoutEffect(() => {
    contextRef.current = {
      routeMode: mode,
      reduced,
      hidden: hidden || away || suppressed || dizzy,
      gates: { calm, present, festive, touch: touchStage, autonomous },
    }
  })
  // A route change, another account, a failed renderer or a higher-ranked actor ends what runs.
  // Layout effects: the old route's props never paint on the new one.
  useLayoutEffect(() => {
    orchestrator.cancel('route')
  }, [orchestrator, pathname])
  useLayoutEffect(() => {
    orchestrator.cancel('account')
  }, [orchestrator, accountId])
  // The journal editor opening beside her ends what she was doing (other modals take her away: `hidden`).
  useLayoutEffect(() => {
    if (companion !== null) orchestrator.cancel('modal')
  }, [orchestrator, companion])
  useEffect(() => {
    if (dizzy) orchestrator.cancel('renderer')
  }, [orchestrator, dizzy])
  useEffect(() => {
    if (summon || menuOpen || notice) orchestrator.claim(MAM_PRIORITY.summon)
  }, [orchestrator, summon, menuOpen, notice])
  // The yawn, the wake and a poke take the stage from an idle look (the airplane's own hop and wave do not).
  useEffect(() => {
    if (local.shot && localKind !== 'hop_down' && localKind !== 'wave')
      orchestrator.claim(MAM_PRIORITY.welcome)
  }, [orchestrator, local.shot, localKind])
  // An achievement's celebration and a confirmed save pick their look here; their own windows (gates, the bubble) are unchanged.
  const celebrationKey = celebration.oneShot?.key ?? null
  const celebrationKind = celebration.oneShot?.kind
  useEffect(() => {
    if (celebrationKey === null) return
    orchestrator.play('CELEBRATE', {
      source: 'celebration',
      grade:
        celebrationKind === 'celebrate_hero'
          ? 'hero'
          : celebrationKind === 'celebrate_soft'
            ? 'soft'
            : 'light',
    })
  }, [orchestrator, celebrationKey, celebrationKind])
  const savedKey = saved?.key ?? null
  useEffect(() => {
    if (savedKey === null) return
    orchestrator.play('ENCOURAGE', { source: 'saved', variation: 'nod' })
  }, [orchestrator, savedKey])
  // MB-897: the look that goes with a trajectory or event line (the bubble shows even where the look is skipped:
  // reduced motion, a busy stage, a gate that closed).
  const reactionKey = trajectory.reaction?.key ?? null
  const reactionIntent = trajectory.reaction?.intent
  const reactionGrade = trajectory.reaction?.grade
  useEffect(() => {
    if (reactionKey === null || !reactionIntent) return
    orchestrator.play(reactionIntent, {
      source: 'trajectory',
      grade: reactionGrade,
    })
  }, [orchestrator, reactionKey, reactionIntent, reactionGrade])

  // An EXPRESSIVE look grows her a little while it plays, so it reads at the dock size (the scale is CSS on the
  // flight box, anchored at her feet). Micro looks, cinematic scenes, looks that opt out (`grow: false`: the idle
  // glance and the rest looks) and reduced motion never scale.
  const emphasized =
    !reduced &&
    stage.current?.grow === true &&
    (travelMode === 'dock' || travelMode === 'hop')
  const emphasisScale = compact ? MAM_EMPHASIS_COMPACT : MAM_EMPHASIS
  const emphasisRef = useRef(1)
  useEffect(() => {
    emphasisRef.current = emphasized ? emphasisScale : 1
  })

  // ---- MB-894 welcome airplane ----
  const welcomeGate = useRef(false)
  useEffect(() => {
    welcomeGate.current =
      calm &&
      travelMode === 'dock' &&
      !asleep &&
      !menuOpen &&
      !summon &&
      !notice &&
      !celebrating &&
      !shot &&
      !local.shot &&
      // A page action under the dock only dims the docked Mầm; the plane is click-through. Focus under it
      // means the user is already working there, so the scene does not start.
      yielding !== 'focus' &&
      document.visibilityState === 'visible' &&
      window.innerWidth >= 320 &&
      window.innerHeight >= 480
  })
  // The whole wait is capped: whatever holds the start (a slow asset, a no-interrupt zone, focus), after 4 s Mầm
  // shows in the dock and the scene is off. The session is not marked as played.
  useEffect(() => {
    if (welcome !== 'waiting') return
    const timer = setTimeout(() => {
      setWelcome('done')
      markWelcomeAttempted(accountId)
    }, WELCOME_READY_MS)
    return () => clearTimeout(timer)
  }, [welcome, accountId])
  // The user has started to use the page: no surprise entrance after that.
  useEffect(() => {
    if (welcome !== 'waiting') return
    // The user has started to use the page: this session's entrance is over, here and on later FULL routes.
    const stop = () => {
      setWelcome('done')
      markWelcome(accountId)
      markWelcomeAttempted(accountId)
    }
    for (const type of WELCOME_CANCEL_EVENTS)
      window.addEventListener(type, stop, { capture: true, passive: true })
    return () => {
      for (const type of WELCOME_CANCEL_EVENTS)
        window.removeEventListener(type, stop, { capture: true })
    }
  }, [welcome, accountId])
  // 700 ms after ready the page's entrance has landed; every gate is checked once, then it flies.
  useEffect(() => {
    if (welcome !== 'waiting' || !calm) return
    const timer = setTimeout(() => {
      setWelcome('done')
      const rect = dockRef.current?.getBoundingClientRect()
      if (!welcomeGate.current || !rect) {
        markWelcomeAttempted(accountId)
        return
      }
      // The orchestrator picks the look (airplane, parachute, plant pot); a play it refuses is an attempt, not a show.
      // `?mamVariation=<id>` picks the look for a demo or a capture (QA only; every gate still applies).
      const result = orchestrator.play('WELCOME', {
        source: 'welcome',
        variation:
          new URLSearchParams(window.location.search).get('mamVariation') ??
          undefined,
      })
      if (result.status !== 'played') {
        // A queued welcome would start later without the session flag: drop it, this page load has tried.
        orchestrator.dequeue('welcome')
        markWelcomeAttempted(accountId)
        return
      }
      markWelcome(accountId)
      setReplayUsed(true)
    }, WELCOME_DELAY_MS)
    return () => clearTimeout(timer)
  }, [welcome, calm, accountId, orchestrator])
  // Any input ends a cinematic look at once (the input still reaches its target); a hidden tab or a resize ends any
  // look, since a plan made for the old viewport is stale. Listening while any look runs covers the plant pot and
  // the parachute's closing wave, which have no travel mode.
  const lookRunning = stage.current !== null
  useEffect(() => {
    if (!staged && !lookRunning) return
    // Only the orchestrator's own travel modes are snapped: a perch or a drag belongs to someone else.
    const snapOwn = () => {
      const mode = travel.mode()
      if (mode === 'welcome' || mode === 'scene' || mode === 'hop')
        travel.snap()
    }
    const skip = () => {
      orchestrator.input()
      // A scene the orchestrator no longer knows (it was disposed) is snapped home directly.
      if (!orchestrator.current()) snapOwn()
    }
    const leave = () => {
      if (!orchestrator.cancel('host')) snapOwn()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') leave()
    }
    // Mobile URL-bar collapse fires height-only resizes while scrolling: they end a cinematic (its path uses the
    // viewport height) but not an expressive look at the dock, which only a width change ends.
    let width = window.innerWidth
    const onResize = () => {
      if (!staged && window.innerWidth === width) return
      width = window.innerWidth
      leave()
    }
    for (const type of WELCOME_CANCEL_EVENTS)
      window.addEventListener(type, skip, { capture: true, passive: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      for (const type of WELCOME_CANCEL_EVENTS)
        window.removeEventListener(type, skip, { capture: true })
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [staged, lookRunning, travel, orchestrator])
  // What the character is told to play now (also read by the E2E specs): the stage's command (a celebration, a save,
  // an idle action, a variation), held while she sleeps, else the host's own.
  const playing = (asleep ? null : stage.shot) ?? localShot
  const gaze = useMamGaze(lively && !above, dockRef)
  useMamIdleActions(
    lively,
    () => orchestrator.play('IDLE', { source: 'idle' }),
    undefined,
    quiet,
    above,
  )
  // `?mamIntent=<INTENT>` plays one intent once the host is ready (QA, captures, the demo).
  useMamDevIntent(
    status === 'ready' && welcome === 'done' && calm,
    orchestrator.play,
  )
  // Input during the yawn: Mầm perks up instead of falling asleep.
  const drowsing = localKind === 'drowsy'
  useEffect(() => {
    if (!drowsing) return
    const stir = () => travel.stir()
    for (const type of MAM_INPUT_EVENTS)
      window.addEventListener(type, stir, { capture: true, passive: true })
    return () => {
      for (const type of MAM_INPUT_EVENTS)
        window.removeEventListener(type, stir, { capture: true })
    }
  }, [drowsing, travel])
  // Sleep (design §D): 60 s without input, docked, quiet and nothing open.
  useMamIdle(
    canTravel &&
      !quietBusy &&
      status === 'ready' &&
      !asleep &&
      travelMode === 'dock' &&
      !menuOpen &&
      !summon &&
      !notice &&
      !celebrating,
    // REST/drowsy_sleep: the catalogue's yawn and lie-down, which the travel controller still performs.
    () =>
      void orchestrator.play('REST', {
        source: 'idle',
        variation: 'drowsy_sleep',
      }),
  )
  // The one-time tip: a card to ask about, "tự lên tiếng" on, not seen before.
  const hasCards = useHasMamElementTarget()
  const tipDue =
    !hidden &&
    !away &&
    !suppressed &&
    !muted &&
    !tipSeen &&
    !quietBusy &&
    !above &&
    hasCards &&
    !dizzy &&
    !asleep &&
    travelMode === 'dock' &&
    !menuOpen &&
    !summon &&
    !notice &&
    !celebrating &&
    !shot &&
    yielding === 'none'
  useEffect(() => {
    if (!tipDue) return
    const timer = setTimeout(() => {
      setMamTipSeen()
      setNotice({ kind: 'tip', returnFocus: null })
      if (!still && !quiet) void travel.tipHop()
    }, TIP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [tipDue, still, quiet, travel])

  useEffect(() => {
    let frame: number | null = null
    const content = document.querySelector('.ref-content')
    const check = () => {
      frame = null
      const root = rootRef.current
      const active = document.activeElement
      if (
        !root ||
        menuOpen ||
        dockBubble ||
        (travelMode !== 'dock' && travelMode !== 'hop') ||
        (active && root.contains(active))
      ) {
        setYielding('none')
        return
      }
      // Beside a modal the page under it is inert: its actions never meet her.
      if (above) {
        setYielding('none')
        return
      }
      const unscaled = root.getBoundingClientRect()
      // The flight box grows up and sideways from her feet while an expressive look plays.
      const grow = emphasisRef.current
      const dock =
        grow === 1
          ? unscaled
          : new DOMRect(
              unscaled.left - (unscaled.width * (grow - 1)) / 2,
              unscaled.top - unscaled.height * (grow - 1),
              unscaled.width * grow,
              unscaled.height * grow,
            )
      const bubble = celebrationRef.current?.getBoundingClientRect()
      const covered = bubble
        ? new DOMRect(
            Math.min(dock.left, bubble.left),
            Math.min(dock.top, bubble.top),
            Math.max(dock.right, bubble.right) -
              Math.min(dock.left, bubble.left),
            Math.max(dock.bottom, bubble.bottom) -
              Math.min(dock.top, bubble.top),
          )
        : dock
      const overlaps = (element: Element, visibleOnly = false) => {
        if (root.contains(element)) return false
        const rect = element.getBoundingClientRect()
        const intersects =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.top < window.innerHeight &&
          covered.left < rect.right &&
          rect.left < covered.right &&
          covered.top < rect.bottom &&
          rect.top < covered.bottom
        if (!intersects || !visibleOnly) return intersects
        const style = getComputedStyle(element)
        return (
          style.visibility !== 'hidden' &&
          style.visibility !== 'collapse' &&
          style.opacity !== '0' &&
          style.clipPath !== 'inset(50%)'
        )
      }
      if (active && active !== document.body && overlaps(active)) {
        // The yielded dock is transparent; an unseen bubble must not stay.
        if (bubble) dismissCelebration.current()
        setYielding('focus')
        return
      }
      const overlapping = Array.from(
        content?.querySelectorAll(PAGE_ACTIONS) ?? [],
      ).some((element) => overlaps(element, true))
      // An automatic bubble never covers a page action: it steps aside.
      if (overlapping && bubble) {
        dismissCelebration.current()
        return
      }
      setYielding(overlapping ? 'overlap' : 'none')
    }
    const scheduleCheck = () => {
      if (frame === null) frame = requestAnimationFrame(check)
    }
    const onFocusIn = (event: FocusEvent) => {
      const root = rootRef.current
      const target = event.target
      // Focus leaving the dock closes the menu, which could cover the target.
      if (root && target instanceof Element && !root.contains(target))
        setOpen(false)
      scheduleCheck()
    }
    const observer = new ResizeObserver(scheduleCheck)
    // Loading placeholders can become actions without changing content size.
    const mutations = new MutationObserver(scheduleCheck)
    if (content) {
      observer.observe(content)
      mutations.observe(content, { childList: true, subtree: true })
    }
    scheduleCheck()
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', scheduleCheck)
    window.addEventListener('scroll', scheduleCheck, {
      passive: true,
      capture: true,
    })
    window.addEventListener('resize', scheduleCheck, { passive: true })
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', scheduleCheck)
      window.removeEventListener('scroll', scheduleCheck, true)
      window.removeEventListener('resize', scheduleCheck)
    }
  }, [
    pathname,
    hidden,
    menuOpen,
    dockBubble,
    celebrating,
    travelMode,
    above,
    emphasized,
  ])

  // Leaving (a safety zone, a modal) while the dock owns focus would drop it on
  // the body; hand it to the page content. Focus a dialog already took is not in the
  // dock, so it stays.
  useEffect(() => {
    const active = document.activeElement
    if (!away || !active || !rootRef.current?.contains(active)) return
    document
      .querySelector<HTMLElement>('.ref-content')
      ?.focus({ preventScroll: true })
  }, [away])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      setOpen(false)
      if (rootRef.current?.contains(document.activeElement))
        dockRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuOpen])

  // Hide and show swap the focused control; the one that mounts takes focus.
  const focusOnMount = (node: HTMLButtonElement | null) => {
    if (!node || !focusAfterToggle.current) return
    focusAfterToggle.current = false
    node.focus()
  }

  // A drag is play: only where Mầm is ready and free to travel, never from an open bubble.
  const dragOk = canTravel && status === 'ready' && !dockBubble
  // The card under the pointer wears a ring while Mầm is carried over it (MB-819).
  const ring = useMamDropRing(travelMode === 'drag' && dragOk, rootRef)
  // A tap (under 6 px of travel) keeps the button's job; a drag is play.
  const onDockPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return
    if (!dragOk || travelMode !== 'dock') return
    // Capture at the press, not at the first move: a fast flick can jump off the
    // button before the first pointermove, and the drag would never start.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      on: false,
    }
  }
  const onDockPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = dragRef.current
    if (!press || press.id !== event.pointerId) return
    if (!press.on) {
      if (
        Math.hypot(event.clientX - press.x, event.clientY - press.y) <
        DRAG_SLOP_PX
      )
        return
      // The press may have become ineligible since it began: then it never drags.
      // From where the press began, so the crossing move itself is a move.
      if (!dragOk || !travel.dragStart(press.x, press.y, press.t)) {
        dragRef.current = null
        return
      }
      press.on = true
      orchestrator.claim(MAM_PRIORITY.user)
      setOpen(false)
      setNotice(null)
      close(false)
      dismissCelebration.current()
    }
    travel.dragMove(event.clientX, event.clientY)
    // Escape or a fallen gate ended the drag while the pointer is still held.
    if (dragOk && travelMode === 'drag')
      ring.track(event.clientX, event.clientY)
  }
  const onDockPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = dragRef.current
    if (!press || press.id !== event.pointerId) return
    dragRef.current = null
    if (!press.on) return
    ring.clear()
    // Let go over a card: ask about it as a right-click would. A cancel, or any other
    // spot, ends as a throw.
    if (
      event.type === 'pointerup' &&
      dragOk &&
      travelMode === 'drag' &&
      summonOn(event.clientX, event.clientY, rootRef.current)
    )
      travel.dragDrop()
    else travel.dragEnd(event.clientX, event.clientY)
    // The click that ends a drag is not a tap.
    afterDrag.current = true
    setTimeout(() => {
      afterDrag.current = false
    }, 0)
  }
  const onDockClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (afterDrag.current || (travelMode !== 'dock' && travelMode !== 'hop'))
      return
    // A click (a screen reader sends no pointer events) during the yawn stirs Mầm.
    if (drowsing) travel.stir()
    if (dizzy) {
      setNotice(notice ? null : { kind: 'dizzy', returnFocus: dockRef.current })
      if (!notice) setDizzyPlay((value) => value + 1)
      return
    }
    if (asleep) {
      void travel.wake()
      return
    }
    // Poke (MB-818): an open menu or bubble always closes on a click and never pokes.
    // While the menu is closed, only the first click of a 1.5 s window opens it; the
    // reactions follow `pokeClick`. Where Mầm cannot react, and for a keyboard or
    // screen-reader activation (no pointer: `detail` is 0), every click toggles.
    let toggle = true
    if (touchOk && event.detail > 0 && !menuOpen && !dockBubble) {
      const poke = pokeClick(pokes.current, performance.now())
      pokes.current = poke.state
      toggle = poke.toggleMenu
      if (poke.play) {
        orchestrator.claim(MAM_PRIORITY.user)
        local.play(poke.play)
      }
    }
    setNotice(null)
    if (dockBubble) close(false)
    else if (toggle) setOpen((value) => !value)
  }

  const toggleHidden = (next: boolean) => {
    focusAfterToggle.current = true
    setOpen(false)
    setMamHidden(next)
  }

  // The props a running variation asked for, per drawing layer (behind her, over her, or riding with her).
  const propLayer = (layer: MamPropLayer) =>
    stage.props
      .filter((prop) => mamPropLayers(prop.id).includes(layer))
      .map((prop) => (
        <MamProp
          key={`${prop.id}:${layer}`}
          id={prop.id}
          phase={prop.phase}
          layer={layer}
          size={size}
          side={prop.side}
          onGone={stage.removeProp}
        />
      ))

  const rise = reduced ? 0 : 8
  const shrink = reduced ? 1 : 0.98
  const transition = { duration: 0.22, ease }
  // Leaving for a modal or a safety zone is instant under reduced motion.
  const exitTransition = { duration: reduced ? 0 : 0.14, ease }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-mam-dock={away ? 'away' : hidden ? 'hidden' : 'shown'}
      data-mam-mode={mode}
      data-mam-above={above}
      popover={above ? 'manual' : undefined}
      style={
        above
          ? ({
              left: gap?.left,
              bottom: gap?.bottom,
              '--mam-dock-offset': '0px',
              // Hidden until placed, so she never shows at her dock spot first.
              visibility: gap === null ? 'hidden' : undefined,
            } as CSSProperties)
          : undefined
      }
      data-yield={yielding !== 'none'}
      data-focus-yield={yielding === 'focus'}
      data-mam-travel={travelMode}
      data-mam-sleep={asleep}
      data-mam-shot={playing?.kind ?? ''}
      data-mam-emphasis={emphasized}
      data-mam-intent={stage.current?.intent ?? ''}
      data-mam-variation={stage.current?.variation ?? ''}
      data-mam-last={stage.lastVariation}
      data-mam-gaze={lively && !above}
      data-mam-dizzy={dizzy}
      data-mam-suppressed={suppressed}
      data-front={flying || staged}
    >
      <AnimatePresence initial={false} mode="wait">
        {away ? null : hidden ? (
          <motion.button
            key="handle"
            ref={focusOnMount}
            type="button"
            className={styles.handle}
            aria-label="Hiện Mầm"
            title="Hiện Mầm"
            onClick={() => toggleHidden(false)}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: reduced ? 1 : 0.9,
              transition: exitTransition,
            }}
            transition={transition}
          >
            <Leaf size={18} strokeWidth={1.8} aria-hidden="true" />
          </motion.button>
        ) : (
          <motion.div
            key="dock"
            ref={layerRef}
            className={styles.dockWrap}
            initial={{ opacity: 0, y: rise }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: rise, transition: exitTransition }}
            transition={transition}
          >
            <button
              ref={(node) => {
                dockRef.current = node
                focusOnMount(node)
              }}
              type="button"
              className={styles.dock}
              aria-label={
                dizzy
                  ? 'Mầm đang gặp sự cố'
                  : asleep
                    ? 'Mầm đang ngủ, bấm để đánh thức'
                    : 'Mầm'
              }
              aria-expanded={menuOpen || dockBubble || notice?.kind === 'dizzy'}
              aria-controls={menuOpen ? menuId : undefined}
              data-open={menuOpen || dockBubble}
              // Away from the dock (perched, thrown) the button is an empty spot:
              // out of the tab order, but not inert (a drag needs its pointer capture).
              tabIndex={
                travelMode === 'dock' || travelMode === 'hop' ? undefined : -1
              }
              onClick={onDockClick}
              onPointerDown={onDockPointerDown}
              onPointerMove={onDockPointerMove}
              onPointerUp={onDockPointerEnd}
              onPointerCancel={onDockPointerEnd}
            >
              <span
                className={styles.flight}
                data-flight={celebration.flight}
                style={{ '--mam-emphasis': emphasisScale } as CSSProperties}
              >
                {welcoming ? (
                  <MamFlightFx
                    ref={flightFx}
                    size={size}
                    values={travel.values}
                  />
                ) : null}
                <AnimatePresence>
                  {welcoming ? (
                    <MamAirplane
                      key="back"
                      layer="back"
                      size={size}
                      values={travel.values}
                    />
                  ) : null}
                </AnimatePresence>
                {propLayer('back')}
                <motion.span
                  className={styles.mover}
                  style={{
                    x: travel.values.x,
                    y: travel.values.y,
                    zIndex: travel.values.moverZ,
                  }}
                >
                  {propLayer('mover')}
                  <motion.span
                    className={styles.body}
                    style={{
                      rotate: travel.values.rotate,
                      scaleX: travel.values.scaleX,
                      scaleY: travel.values.scaleY,
                      originX: 0.5,
                      originY: 0.62,
                    }}
                  >
                    <span className={styles.breath} data-asleep={asleep}>
                      <MamCharacter
                        size={size}
                        behavior={
                          dizzy
                            ? 'gentle'
                            : (travelBehavior ??
                              stage.loop ??
                              behavior ??
                              (celebration.bubbleText !== null
                                ? 'happy'
                                : menuOpen
                                  ? 'curious'
                                  : 'idle'))
                        }
                        // A variation that follows something with her eyes (the butterfly) owns the gaze until it ends.
                        attention={stage.gaze ?? attention}
                        gaze={lively && !above ? gaze : undefined}
                        // Held back only while the scene is about to start (loading, or the 700 ms before it), or
                        // while a variation hides her (she is in the pot until it lands).
                        visible={
                          !stage.concealed &&
                          !(
                            welcome === 'waiting' &&
                            (status === 'loading' || calm)
                          )
                        }
                        oversample={staged || emphasized}
                        reducedMotion={motionOff || suppressed || quietBusy}
                        // Held while asleep: the quiet wake must clear the sleep state
                        // first, or the renderer would cancel the command that woke Mầm.
                        oneShot={playing}
                        onStatusChange={setStatus}
                        onFallback={(reason) => {
                          if (reason !== 'error') return
                          markMamRendererFailed()
                          setDizzy(true)
                        }}
                      />
                      {dizzy ? (
                        <MamDizzy
                          key={dizzyPlay}
                          size={size}
                          still={still || suppressed}
                        />
                      ) : null}
                    </span>
                  </motion.span>
                  {asleep ? (
                    <span className={styles.letters} aria-hidden="true">
                      <span>z</span>
                      <span>z</span>
                      <span>Z</span>
                    </span>
                  ) : null}
                </motion.span>
                {propLayer('front')}
                <AnimatePresence>
                  {welcoming ? (
                    <MamAirplane
                      key="front"
                      layer="front"
                      size={size}
                      values={travel.values}
                    />
                  ) : null}
                </AnimatePresence>
              </span>
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  key="menu"
                  id={menuId}
                  className={styles.menu}
                  role="group"
                  aria-labelledby={titleId}
                  initial={{ opacity: 0, y: rise, scale: shrink }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: rise / 2,
                    scale: shrink,
                    transition: exitTransition,
                  }}
                  transition={transition}
                >
                  <div id={titleId} className={styles.title}>
                    Mầm
                  </div>
                  <div className={styles.lead}>
                    Mầm ngồi ở góc này và chỉ lên tiếng khi bạn cần.{' '}
                    {coarse
                      ? 'Nhấn giữ vào một thẻ để hỏi Mầm về thẻ đó.'
                      : 'Chuột phải vào một thẻ để hỏi Mầm về thẻ đó.'}
                  </div>
                  {note ? <p className={styles.note}>{note}</p> : null}

                  {pageTarget ? (
                    <button
                      type="button"
                      className={styles.ask}
                      onClick={() => {
                        setOpen(false)
                        summonPage()
                      }}
                    >
                      <MessageCircleQuestion
                        size={18}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      Hỏi Mầm về trang này
                    </button>
                  ) : null}

                  <MamSwitch
                    label="Mầm tự lên tiếng"
                    hint="Tắt thì Mầm chỉ đáp khi bạn gọi, đến khi bạn đóng thẻ này."
                    checked={!muted}
                    onChange={() => setMamMuted(!muted)}
                  />
                  <MamSwitch
                    label="Chuyển động"
                    hint={
                      osReduced
                        ? 'Thiết bị của bạn đang bật giảm chuyển động.'
                        : 'Tắt thì Mầm đứng yên.'
                    }
                    checked={!reduced}
                    disabled={osReduced}
                    onChange={() => setMamMotionOff(!motionOff)}
                  />

                  <button
                    type="button"
                    className={styles.hide}
                    onClick={() => toggleHidden(true)}
                  >
                    <EyeOff size={16} strokeWidth={1.8} aria-hidden="true" />
                    Ẩn Mầm
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebration.bubbleText || trajectoryText ? (
          <MamCelebrationBubble
            key="celebration"
            text={celebration.bubbleText ?? trajectoryText ?? ''}
            showLink={
              celebration.bubbleText !== null && pathname !== '/achievements'
            }
            holdMs={
              celebration.bubbleText === null && trajectoryText
                ? mamHoldMs(trajectoryText)
                : undefined
            }
            reduced={reduced}
            bubbleRef={celebrationRef}
            returnFocusRef={dockRef}
            onClose={closeBubble}
          />
        ) : null}
      </AnimatePresence>

      {perched ? (
        <>
          <motion.span
            className={styles.paw}
            data-mam-paw=""
            aria-hidden="true"
            style={{
              x: travel.values.pawLeft,
              y: travel.values.pawY,
              scale: travel.values.pawScale,
            }}
          />
          <motion.span
            className={styles.paw}
            data-mam-paw=""
            aria-hidden="true"
            style={{
              x: travel.values.pawRight,
              y: travel.values.pawY,
              scale: travel.values.pawScale,
            }}
          />
        </>
      ) : null}

      <AnimatePresence>
        {notice ? (
          <MamNoticeBubble
            key="notice"
            text={
              notice.kind === 'dizzy'
                ? DIZZY_TEXT
                : coarse
                  ? 'Mẹo nè: nhấn giữ vào thẻ bất kỳ, mình sẽ trèo lên giải thích cho bạn.'
                  : 'Mẹo nè: chuột phải vào thẻ bất kỳ, mình sẽ trèo lên giải thích cho bạn.'
            }
            confirmLabel={notice.kind === 'dizzy' ? 'Đã hiểu' : 'Cảm ơn Mầm'}
            modal={notice.kind === 'dizzy'}
            reduced={reduced}
            bubbleRef={noticeRef}
            dockRef={dockRef}
            returnFocus={notice.returnFocus}
            onClose={() => setNotice(null)}
            onHide={
              notice.kind === 'dizzy'
                ? () => {
                    setNotice(null)
                    toggleHidden(true)
                  }
                : undefined
            }
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {summon && (!climbing || perch) ? (
          <MamBubble
            key={summon.anchor.kind === 'dock' ? 'dock' : 'point'}
            summon={summon}
            reduced={reduced}
            bubbleRef={bubbleRef}
            perch={climbing ? perch : null}
            onChoose={choose}
            onGo={go}
            onClose={() => close(true)}
            onThanks={() => {
              thanksRef.current = true
              close(true)
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MamSwitch({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: Readonly<{
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}>) {
  const labelId = useId()
  const hintId = useId()
  // The whole row is the switch, so the target is full width. A locked switch
  // stays focusable so its hint is still read.
  return (
    <button
      type="button"
      role="switch"
      className={styles.row}
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hintId}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onChange}
    >
      <span className={styles.rowText}>
        <span id={labelId} className={styles.rowLabel}>
          {label}
        </span>
        <span id={hintId} className={styles.rowHint}>
          {hint}
        </span>
      </span>
      <span className={styles.switch} aria-hidden="true">
        <span />
      </span>
    </button>
  )
}
