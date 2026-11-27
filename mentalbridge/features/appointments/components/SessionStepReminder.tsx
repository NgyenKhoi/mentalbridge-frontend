'use client'

import { useEffect, useRef, useState } from 'react'

import { useMamAccountId } from '@/features/mam/MamDockSlot'
import {
  COMMITMENT_FAILED_LINE,
  COMMITMENT_LIMIT_LINE,
  localToday,
  shiftLocalDate,
} from '@/features/mam/companion-copy'
import styles from '@/features/mam/MamChoice.module.css'
import { useCompanionState } from '@/features/mam/use-companion-state'

/**
 * Under the agreed next steps of a session summary: "Hẹn Mầm nhắc mình làm 1 bước" makes one lời hẹn for
 * tomorrow, which Mầm asks about on Home. Without Mầm's slot (no signed-in layout) it renders nothing.
 */
export function SessionStepReminder() {
  const accountId = useMamAccountId()
  const { createCommitment } = useCompanionState(accountId)
  const [outcome, setOutcome] = useState<'saved' | 'limit' | 'failed' | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const line = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outcome === 'saved') line.current?.focus()
  }, [outcome])

  if (!accountId) return null

  const remind = async () => {
    if (busy) return
    setBusy(true)
    const result = await createCommitment({
      kind: 'SPECIALIST_STEP',
      minutes: null,
      dueOn: shiftLocalDate(localToday(), 1),
      source: 'SESSION',
    })
    setBusy(false)
    setOutcome(
      result === 'COMMITMENT_LIMIT' ? 'limit' : result ? 'saved' : 'failed',
    )
  }

  if (outcome === 'saved')
    return (
      <div ref={line} className={styles.line} role="status" tabIndex={-1}>
        Mai Mầm hỏi lại nhé.
      </div>
    )
  return (
    <div className={styles.goalLine}>
      <button
        type="button"
        className={styles.secondary}
        disabled={busy}
        onClick={() => void remind()}
      >
        Hẹn Mầm nhắc mình làm 1 bước
      </button>
      {outcome && (
        <div className={`${styles.note} ${styles.noteWarn}`} role="alert">
          {outcome === 'limit' ? COMMITMENT_LIMIT_LINE : COMMITMENT_FAILED_LINE}
        </div>
      )}
    </div>
  )
}
