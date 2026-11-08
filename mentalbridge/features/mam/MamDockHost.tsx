'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Leaf, MessageCircleQuestion } from 'lucide-react'

import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'

import { MamBubble, MamCelebrationBubble, MamNoticeBubble } from './MamBubble'
import { MamCharacter, type MamRenderStatus } from './MamCharacter'
import styles from './MamDock.module.css'
import { useMamAccountId } from './MamDockSlot'
import { MamDizzy } from './MamDizzy'
import { hasMamRendererFailed, markMamRendererFailed } from './mam-failure'
import type { MamLoopingBehavior } from './mam-contract'
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
import { IDLE_ACTIONS, useMamIdleActions } from './use-mam-idle-actions'
import { useMamGaze } from './mam-gaze'
import { NO_POKE, pokeClick } from './mam-poke'
import { useMamShot } from './use-mam-shot'
import { isMamCelebrationRoute, isMamStaticDockRoute } from './mam-routes'
import {
  useMamCelebrationNote,
  useMamCelebrations,
} from './use-mam-celebrations'
import { useMamSaved } from './mam-saved'
import { useMamSummon } from './use-mam-summon'
import { useMamAway, useMamSuppressed } from './use-mam-suppressed'
import { useHasMamElementTarget, useMamPageTargetValue } from './use-mam-target'

// Matches the shell's off-canvas sidebar breakpoint.
const COMPACT_QUERY = '(max-width: 900px)'
const COARSE_QUERY = '(pointer: coarse)'
// A press that moves less than this is a tap, not a drag (design §C).
const DRAG_SLOP_PX = 6
const TIP_DELAY_MS = 1400
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
  const away = useMamAway()
  const osReduced = useReactiveReducedMotion()
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
  const { summon, summonPage, choose, go, close, behavior } = useMamSummon({
    pathname,
    enabled: !hidden && !suppressed,
    reducedMotion: reduced,
    dockRef,
    bubbleRef,
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
  const [status, setStatus] = useState<MamRenderStatus>('loading')
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

  // Travel (MB-814): the controller drives the character; React only learns
  // what it must render. A reduced-motion setting or a still route keeps Mầm put.
  const still = reduced || isMamStaticDockRoute(pathname)
  const canTravel = !hidden && !away && !suppressed && !still && !dizzy
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
  const [perch, setPerch] = useState<MamPerch | null>(null)
  const [asleep, setAsleep] = useState(false)
  // The host's own one-shot channel: drowsy and wake (travel), pokes, idle actions.
  const local = useMamShot()
  const pokes = useRef(NO_POKE)
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

  // MB-773: nothing plays unless every no-interrupt condition holds.
  const celebration = useMamCelebrations({
    accountId,
    pathname,
    allowed:
      isMamCelebrationRoute(pathname) &&
      status === 'ready' &&
      !hidden &&
      !muted &&
      !reduced &&
      !suppressed &&
      !dizzy &&
      !flying &&
      !summon &&
      !notice &&
      !menuOpen,
    blocked: yielding !== 'none',
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
      !summon &&
      !notice &&
      !menuOpen &&
      yielding === 'none',
    pathname,
  )
  const dismissCelebration = useRef(celebration.dismiss)
  useEffect(() => {
    dismissCelebration.current = celebration.dismiss
  })
  const celebrating = celebration.bubbleText !== null
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
  const touchOk =
    calm &&
    travelMode === 'dock' &&
    yielding === 'none' &&
    !dockBubble &&
    !celebrating &&
    !shot
  // Autonomous life (gaze, idle actions): also not while muted, asleep or anything is open.
  const autonomous =
    touchOk && !muted && !asleep && !menuOpen && !summon && !notice
  // Drowsy and wake belong to the travel controller and run wherever it runs them; an idle
  // action stops with the autonomous gates, a poke only with the touch gates.
  const localKind = local.shot?.kind
  const localShot =
    local.shot &&
    (localKind === 'drowsy' || localKind === 'wake'
      ? calm
      : (IDLE_ACTIONS as readonly string[]).includes(localKind ?? '')
        ? autonomous
        : touchOk)
      ? local.shot
      : null
  // Withdrawn eligibility drops the command for good, so it never resurfaces mid-way.
  const dropShot = local.shot !== null && localShot === null
  const cancelLocal = local.cancel
  useEffect(() => {
    if (dropShot) cancelLocal()
  }, [dropShot, cancelLocal])
  const lively = autonomous && !local.shot
  // What the character is told to play now (also read by the E2E specs).
  const playing = (asleep ? null : shot) ?? localShot
  const gaze = useMamGaze(lively, dockRef)
  useMamIdleActions(lively, local.play)
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
      status === 'ready' &&
      !asleep &&
      travelMode === 'dock' &&
      !menuOpen &&
      !summon &&
      !notice &&
      !celebrating,
    () => void travel.sleep(),
  )
  // The one-time tip: a card to ask about, "tự lên tiếng" on, not seen before.
  const hasCards = useHasMamElementTarget()
  const tipDue =
    !hidden &&
    !away &&
    !suppressed &&
    !muted &&
    !tipSeen &&
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
      if (!still) void travel.tipHop()
    }, TIP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [tipDue, still, travel])

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
        travelMode !== 'dock' ||
        (active && root.contains(active))
      ) {
        setYielding('none')
        return
      }
      const dock = root.getBoundingClientRect()
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
  }, [pathname, hidden, menuOpen, dockBubble, celebrating, travelMode])

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
      setOpen(false)
      setNotice(null)
      close(false)
      celebration.dismiss()
    }
    travel.dragMove(event.clientX, event.clientY)
  }
  const onDockPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = dragRef.current
    if (!press || press.id !== event.pointerId) return
    dragRef.current = null
    if (!press.on) return
    travel.dragEnd(event.clientX, event.clientY)
    // The click that ends a drag is not a tap.
    afterDrag.current = true
    setTimeout(() => {
      afterDrag.current = false
    }, 0)
  }
  const onDockClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (afterDrag.current || travelMode !== 'dock') return
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
      if (poke.play) local.play(poke.play)
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
      data-yield={yielding !== 'none'}
      data-focus-yield={yielding === 'focus'}
      data-mam-travel={travelMode}
      data-mam-sleep={asleep}
      data-mam-shot={playing?.kind ?? ''}
      data-mam-gaze={lively}
      data-mam-dizzy={dizzy}
      data-mam-suppressed={suppressed}
      data-front={flying}
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
              tabIndex={travelMode === 'dock' ? undefined : -1}
              onClick={onDockClick}
              onPointerDown={onDockPointerDown}
              onPointerMove={onDockPointerMove}
              onPointerUp={onDockPointerEnd}
              onPointerCancel={onDockPointerEnd}
            >
              <span className={styles.flight} data-flight={celebration.flight}>
                <motion.span
                  className={styles.mover}
                  style={{ x: travel.values.x, y: travel.values.y }}
                >
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
                              behavior ??
                              (celebrating
                                ? 'happy'
                                : menuOpen
                                  ? 'curious'
                                  : 'idle'))
                        }
                        attention={attention}
                        gaze={lively ? gaze : undefined}
                        reducedMotion={
                          motionOff ||
                          suppressed ||
                          isMamStaticDockRoute(pathname)
                        }
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
        {celebration.bubbleText ? (
          <MamCelebrationBubble
            key="celebration"
            text={celebration.bubbleText}
            showLink={pathname !== '/achievements'}
            reduced={reduced}
            bubbleRef={celebrationRef}
            returnFocusRef={dockRef}
            onClose={celebration.dismiss}
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
