'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { CommitmentPicker } from '@/features/mam/CommitmentPicker'
import {
  commitmentSavedLine,
  localToday,
  type CommitmentWhen,
} from '@/features/mam/companion-copy'
import {
  mamDailyKey,
  readMamDaily,
  writeMamDaily,
} from '@/features/mam/mam-daily'
import styles from '@/features/mam/MamChoice.module.css'
import type { CompanionCommitmentKind } from '@/lib/companion-state/contract'

type Phase =
  | { step: 'chip' }
  | { step: 'picker' }
  | { step: 'done'; kind: CompanionCommitmentKind; when: CommitmentWhen }
  | { step: 'gone' }

/**
 * Under Mầm's latest reply, once the conversation has some depth: a quiet way to turn the talk into one small
 * promise (lời hẹn). Offered once per conversation per day; never while a reply streams (the parent decides).
 */
export default function ChatCommitmentOffer({
  accountId,
  conversationId,
  onCompose,
  onClose,
}: Readonly<{
  accountId: string
  conversationId: string
  /** CONNECT_PERSON: the composer gets Mầm's draft starter. */
  onCompose: () => void
  /** The offer ended without a draft: focus goes back to the composer. */
  onClose: () => void
}>) {
  const key = mamDailyKey(
    'chat-commit',
    accountId,
    `${conversationId}:${localToday()}`,
  )
  const [phase, setPhase] = useState<Phase>(() =>
    readMamDaily(key) === null ? { step: 'chip' } : { step: 'gone' },
  )
  const line = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)

  // Shown once: remembered the moment it first appears, not when it is used.
  useEffect(() => {
    if (readMamDaily(key) === null) writeMamDaily(key, '1')
  }, [key])
  useEffect(() => {
    if (phase.step === 'done') line.current?.focus()
    if (phase.step === 'picker')
      area.current
        ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
        ?.focus()
  }, [phase.step])

  if (phase.step === 'gone') return null
  return (
    <motion.div
      ref={area}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {phase.step === 'chip' && (
        <button
          type="button"
          className={styles.offer}
          onClick={() => setPhase({ step: 'picker' })}
        >
          Hẹn Mầm 1 việc nhỏ
        </button>
      )}
      {phase.step === 'picker' && (
        <CommitmentPicker
          accountId={accountId}
          source="CHAT"
          onCreated={(created, when) =>
            setPhase({ step: 'done', kind: created.kind, when })
          }
          onCancel={() => {
            setPhase({ step: 'gone' })
            onClose()
          }}
        />
      )}
      {phase.step === 'done' && (
        <div className={styles.goalLine}>
          <div ref={line} className={styles.line} role="status" tabIndex={-1}>
            {commitmentSavedLine(phase.kind, phase.when)}
          </div>
          {phase.kind === 'CONNECT_PERSON' && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setPhase({ step: 'gone' })
                onCompose()
              }}
            >
              Soạn tin cùng Mầm
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
