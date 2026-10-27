'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Leaf, MessageCircleQuestion } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'

import { MamBubble } from './MamBubble'
import { MamCharacter } from './MamCharacter'
import styles from './MamDock.module.css'
import { useMamDockSlotted } from './MamDockSlot'
import {
  setMamHidden,
  setMamMotionOff,
  setMamMuted,
  useMamPreferences,
} from './mam-preferences'
import { isMamDockRoute, isMamStaticDockRoute } from './mam-routes'
import { useMamSummon } from './use-mam-summon'
import { useMamSuppressed } from './use-mam-suppressed'
import { useMamPageTargetValue } from './use-mam-target'

// Matches the shell's off-canvas sidebar breakpoint.
const COMPACT_QUERY = '(max-width: 900px)'
const PAGE_ACTIONS =
  'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'

function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const ease = [0.16, 1, 0.3, 1] as const

/** The one Mầm per tab. Mounted once in the root providers. */
export function MamDock() {
  const pathname = usePathname()
  const slotted = useMamDockSlotted()
  if (!slotted || !isMamDockRoute(pathname)) return null
  return <MamDockHost pathname={pathname} />
}

function MamDockHost({ pathname }: Readonly<{ pathname: string }>) {
  const menuId = useId()
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLButtonElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const focusAfterToggle = useRef(false)
  const { hidden, muted, motionOff } = useMamPreferences()
  const suppressed = useMamSuppressed()
  const osReduced = useReactiveReducedMotion()
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  )
  const [open, setOpen] = useState(false)

  // A modal, a hidden tab or a route change closes the menu (ADR `mam.dismiss`).
  const [closedFor, setClosedFor] = useState({ suppressed, pathname })
  if (closedFor.suppressed !== suppressed || closedFor.pathname !== pathname) {
    setClosedFor({ suppressed, pathname })
    if (suppressed || closedFor.pathname !== pathname) setOpen(false)
  }

  const menuOpen = open && !hidden

  // Reduced motion keeps the fades and drops the travel; exits are quicker.
  const reduced = motionOff || osReduced
  const pageTarget = useMamPageTargetValue()
  const { summon, summonPage, choose, go, close, behavior } = useMamSummon({
    pathname,
    enabled: !hidden && !suppressed,
    reducedMotion: reduced,
    dockRef,
    bubbleRef,
  })
  const dockBubble = summon?.anchor.kind === 'dock'

  // ADR layering: page actions stay clickable; focused elements stay clear.
  const [yielding, setYielding] = useState<'none' | 'overlap' | 'focus'>('none')
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
        (active && root.contains(active))
      ) {
        setYielding('none')
        return
      }
      const dock = root.getBoundingClientRect()
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
          dock.left < rect.right &&
          rect.left < dock.right &&
          dock.top < rect.bottom &&
          rect.top < dock.bottom
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
        setYielding('focus')
        return
      }
      setYielding(
        Array.from(content?.querySelectorAll(PAGE_ACTIONS) ?? []).some(
          (element) => overlaps(element, true),
        )
          ? 'overlap'
          : 'none',
      )
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
  }, [pathname, hidden, menuOpen, dockBubble])

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

  const toggleHidden = (next: boolean) => {
    focusAfterToggle.current = true
    setOpen(false)
    setMamHidden(next)
  }

  const travel = reduced ? 0 : 8
  const shrink = reduced ? 1 : 0.98
  const transition = { duration: 0.22, ease }
  const exitTransition = { duration: 0.14, ease }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-mam-dock={hidden ? 'hidden' : 'shown'}
      data-yield={yielding !== 'none'}
      data-focus-yield={yielding === 'focus'}
    >
      <AnimatePresence initial={false} mode="wait">
        {hidden ? (
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
            className={styles.dockWrap}
            initial={{ opacity: 0, y: travel }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: travel, transition: exitTransition }}
            transition={transition}
          >
            <button
              ref={(node) => {
                dockRef.current = node
                focusOnMount(node)
              }}
              type="button"
              className={styles.dock}
              aria-label="Mầm"
              aria-expanded={menuOpen || dockBubble}
              aria-controls={menuOpen ? menuId : undefined}
              data-open={menuOpen || dockBubble}
              onClick={() => {
                if (dockBubble) close(false)
                else setOpen((value) => !value)
              }}
            >
              <MamCharacter
                size={compact ? 72 : 96}
                behavior={behavior ?? (menuOpen ? 'curious' : 'idle')}
                reducedMotion={
                  motionOff || suppressed || isMamStaticDockRoute(pathname)
                }
              />
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  key="menu"
                  id={menuId}
                  className={styles.menu}
                  role="group"
                  aria-labelledby={titleId}
                  initial={{ opacity: 0, y: travel, scale: shrink }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: travel / 2,
                    scale: shrink,
                    transition: exitTransition,
                  }}
                  transition={transition}
                >
                  <div id={titleId} className={styles.title}>
                    Mầm
                  </div>
                  <div className={styles.lead}>
                    Mầm ngồi ở góc này và chỉ lên tiếng khi bạn cần.
                  </div>

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
        {summon ? (
          <MamBubble
            key={summon.anchor.kind === 'dock' ? 'dock' : 'point'}
            summon={summon}
            reduced={reduced}
            bubbleRef={bubbleRef}
            onChoose={choose}
            onGo={go}
            onClose={() => close(true)}
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
