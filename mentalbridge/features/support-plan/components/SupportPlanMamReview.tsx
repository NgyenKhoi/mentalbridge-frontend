'use client'

import { useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { MamCardButton } from '@/features/mam/MamCardButton'
import { useMamPreferences } from '@/features/mam/mam-preferences'
import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'

import type { NativeSupportPlanReplacementReview } from '../api/support-plan-contract'
import SupportPlanReviewExplanation from './SupportPlanReviewExplanation'

// The button can disappear (Mầm hidden on a safety path); the reading keeps its name.
const REVIEW_LABEL = 'Mầm xem lại tuần của bạn'

const ease = [0.16, 1, 0.3, 1] as const
const exitEase = [0.4, 0, 0.2, 1] as const

/**
 * Global-Mầm presentation of the replacement review (MB-772): the deterministic
 * explanation opens inline in the review's own card, never as a bubble or a
 * model call. `children` is the card's outcome line (kept mounted so its
 * live region keeps announcing); the button exists once there is a review.
 */
export default function SupportPlanMamReview({
  review,
  children,
}: Readonly<{
  review?: NativeSupportPlanReplacementReview
  children: React.ReactNode
}>) {
  const [open, setOpen] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const generatedId = useId().replace(/:/g, '')
  const buttonId = `mam-review-button-${generatedId}`
  const sectionId = `mam-review-${generatedId}`
  const { motionOff } = useMamPreferences()
  const reduced = useReactiveReducedMotion() || motionOff
  const duration = reduced ? 0 : 0.24

  function collapse() {
    setOpen(false)
    // No button while Mầm is away: keep focus on the card instead of the page body.
    const target = document.getElementById(buttonId) ?? hostRef.current
    target?.focus()
  }

  return (
    <div ref={hostRef} className="mbw-mam-review" data-mam="" tabIndex={-1}>
      <div className="mbw-mam-review-head">
        {children}
        {review && (
          <MamCardButton
            id={buttonId}
            label={REVIEW_LABEL}
            expanded={open}
            controls={open ? sectionId : undefined}
            onToggle={() => setOpen((value) => !value)}
          />
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && review && (
          <motion.section
            key="review"
            id={sectionId}
            aria-label={REVIEW_LABEL}
            className="mbw-mam-review-body"
            initial={{ height: 0, opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{
              height: 0,
              opacity: 0,
              y: reduced ? 0 : 6,
              // The enter ease is so front-loaded that the exit looked instant.
              transition: { duration, ease: exitEase },
            }}
            transition={{ duration, ease }}
          >
            <div className="mbw-mam-review-inner">
              <SupportPlanReviewExplanation review={review} />
              <button
                type="button"
                className="mbw-text-button"
                onClick={collapse}
              >
                Thu gọn
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
