'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'

import { GOAL_LABEL } from '@/features/mam/companion-copy'
import { MamFocusPicker } from '@/features/mam/MamFocusPicker'
import styles from '@/features/mam/MamChoice.module.css'
import { useCompanionState } from '@/features/mam/use-companion-state'

/**
 * The 14-day focus goal on the Home card: the goal as a quiet chip with "Đổi", or, once a screening exists and
 * no goal is chosen yet, the quiet link "Chọn điều bạn muốn nhẹ đi". Both open the picker inline.
 */
export function HomeFocus({
  accountId,
  hasScreening,
}: Readonly<{ accountId: string; hasScreening: boolean }>) {
  const { state } = useCompanionState(accountId)
  const reduced = useReducedMotion()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const area = useRef<HTMLDivElement>(null)

  // Opening moves focus to the chosen chip (or the first), the one tab stop of the radio group.
  useEffect(() => {
    if (open)
      area.current
        ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
        ?.focus()
  }, [open])

  const focus = state?.focus ?? null
  if (!state || (!focus && !hasScreening)) return null

  const close = () => {
    setOpen(false)
    toggle.current?.focus()
  }

  return (
    <>
      <div className={styles.goalLine}>
        {focus && (
          <div className={styles.goalChip}>
            Mục tiêu 14 ngày: {GOAL_LABEL[focus.goal]}
          </div>
        )}
        <button
          ref={toggle}
          type="button"
          className={styles.quiet}
          aria-expanded={open}
          aria-label={focus ? 'Đổi mục tiêu 14 ngày' : undefined}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {focus ? 'Đổi' : 'Chọn điều bạn muốn nhẹ đi'}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="picker"
            id={panelId}
            ref={area}
            className={styles.askClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduced ? 0 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <MamFocusPicker
              accountId={accountId}
              initial={focus?.goal ?? null}
              onSkip={close}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
