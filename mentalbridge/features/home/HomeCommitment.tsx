'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import type {
  CompanionCommitment,
  CompanionCommitmentKind,
} from '@/lib/companion-state/contract'
import { CommitmentPicker } from '@/features/mam/CommitmentPicker'
import {
  COMMITMENT_FAILED_LINE,
  COMMITMENT_LIMIT_LINE,
  COMMITMENT_PHRASE,
  commitmentSavedLine,
  dueCommitment,
  localToday,
  shiftLocalDate,
} from '@/features/mam/companion-copy'
import { dispatchMamEvent } from '@/features/mam/mam-events'
import styles from '@/features/mam/MamChoice.module.css'
import { useCompanionState } from '@/features/mam/use-companion-state'

// What the card says after the user answered; the answered lời hẹn leaves the state, so it is kept here.
type Follow =
  | { step: 'done' }
  | { step: 'not-yet'; kind: CompanionCommitmentKind }
  | { step: 'swap' }
  | { step: 'saved'; kind: CompanionCommitmentKind; tomorrow: boolean }
  | { step: 'closed' }

const SWAP_LINE = 'Ok, mình chọn việc nhẹ hơn nhé.'

/**
 * "Hôm qua bạn hẹn Mầm: … Xong chưa?" on the Home card, from the newest open lời hẹn due yesterday or today.
 * Three quiet answers; none is a primary. Done, not yet and swap each end in one line from Mầm.
 */
export function HomeCommitment({ accountId }: Readonly<{ accountId: string }>) {
  const { state, resolveCommitment, createCommitment } =
    useCompanionState(accountId)
  const reduced = useReducedMotion()
  const [follow, setFollow] = useState<Follow | null>(null)
  const [busy, setBusy] = useState(false)
  // The lời hẹn being answered: it leaves the state at once, but the block must not flicker out first.
  const [held, setHeld] = useState<CompanionCommitment | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const line = useRef<HTMLDivElement>(null)
  const today = localToday()
  const due = dueCommitment(state, today) ?? held

  // The block that replaces the buttons takes focus, so a keyboard user is not dropped on the page.
  useEffect(() => {
    if (follow) line.current?.focus()
  }, [follow])

  const answer = async (
    commitment: CompanionCommitment,
    status: 'DONE' | 'NOT_YET' | 'SWAPPED',
  ) => {
    if (busy) return
    setBusy(true)
    setHeld(commitment)
    setProblem(null)
    const result = await resolveCommitment(commitment.id, status)
    setBusy(false)
    if (!result) {
      setHeld(null)
      return setProblem(COMMITMENT_FAILED_LINE)
    }
    // The answer as the server holds it: another tab or device may have answered first, differently.
    if (result.status === 'DONE') {
      dispatchMamEvent({ type: 'commitment-done' })
      setFollow({ step: 'done' })
    } else if (result.status === 'NOT_YET')
      setFollow({ step: 'not-yet', kind: commitment.kind })
    else if (result.status === 'SWAPPED') setFollow({ step: 'swap' })
    else {
      setHeld(null)
      setProblem(COMMITMENT_FAILED_LINE)
    }
  }

  const rebook = async (kind: CompanionCommitmentKind) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    const result = await createCommitment({
      kind,
      minutes: 5,
      dueOn: shiftLocalDate(today, 1),
      source: 'HOME',
    })
    setBusy(false)
    if (result === 'COMMITMENT_LIMIT') return setProblem(COMMITMENT_LIMIT_LINE)
    if (!result) return setProblem(COMMITMENT_FAILED_LINE)
    setFollow({ step: 'saved', kind, tomorrow: true })
  }

  const visible = follow ? follow.step !== 'closed' : due !== null
  const fade = reduced ? 0 : 0.22

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="ask"
          className={styles.askClip}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: fade, ease: [0.16, 1, 0.3, 1] }}
        >
          <section className={styles.ask} aria-label="Lời hẹn với Mầm">
            {!follow && due && (
              <>
                <div className={styles.line}>
                  {due.dueOn === today ? 'Hôm nay' : 'Hôm qua'} bạn hẹn Mầm:{' '}
                  {COMMITMENT_PHRASE[due.kind]}
                  {due.minutes ? ` (${due.minutes} phút)` : ''}. Xong chưa?
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void answer(due, 'DONE')}
                  >
                    Xong rồi
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void answer(due, 'NOT_YET')}
                  >
                    Chưa
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void answer(due, 'SWAPPED')}
                  >
                    Đổi việc nhẹ hơn
                  </button>
                </div>
              </>
            )}
            {follow?.step === 'done' && (
              <div
                ref={line}
                className={styles.line}
                role="status"
                tabIndex={-1}
              >
                Giỏi lắm nè, Mầm ghi lại rồi.
              </div>
            )}
            {follow?.step === 'not-yet' && (
              <>
                <div
                  ref={line}
                  className={styles.line}
                  role="status"
                  tabIndex={-1}
                >
                  Không sao hết. Mai 5 phút thôi cũng được.
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void rebook(follow.kind)}
                  >
                    Hẹn lại mai 5 phút
                  </button>
                </div>
              </>
            )}
            {follow?.step === 'swap' && (
              <>
                <div
                  ref={line}
                  className={styles.line}
                  role="status"
                  tabIndex={-1}
                >
                  {SWAP_LINE}
                </div>
                <CommitmentPicker
                  accountId={accountId}
                  source="HOME"
                  defaultMinutes={5}
                  defaultWhen="today"
                  onCreated={(created, when) =>
                    setFollow({
                      step: 'saved',
                      kind: created.kind,
                      tomorrow: when === 'tomorrow',
                    })
                  }
                  onCancel={() => setFollow({ step: 'closed' })}
                />
              </>
            )}
            {follow?.step === 'saved' && (
              <div
                ref={line}
                className={styles.line}
                role="status"
                tabIndex={-1}
              >
                {commitmentSavedLine(
                  follow.kind,
                  follow.tomorrow ? 'tomorrow' : 'today',
                )}
              </div>
            )}
            {problem && (
              <div className={`${styles.note} ${styles.noteWarn}`} role="alert">
                {problem}
              </div>
            )}
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
