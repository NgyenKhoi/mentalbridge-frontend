'use client'

import { useEffect, useId, useRef, useState } from 'react'

import type { CompanionFocusGoal } from '@/lib/companion-state/contract'
import { ChipRadioGroup } from './ChipRadioGroup'
import {
  COMPANION_GOALS,
  GOAL_LABEL,
  focusSavedLine,
  localToday,
} from './companion-copy'
import styles from './MamChoice.module.css'
import { useCompanionState } from './use-companion-state'

const OPTIONS = COMPANION_GOALS.map((goal) => ({
  value: goal,
  label: GOAL_LABEL[goal],
}))

/**
 * Mầm asks what the user wants lighter over the next 14 days and saves the answer as the focus goal.
 * "Để sau" leaves nothing saved. After saving, the block is replaced by Mầm's one line, which takes focus.
 */
export function MamFocusPicker({
  accountId,
  initial = null,
  onSaved,
  onSkip,
}: Readonly<{
  accountId: string
  /** The goal already chosen, when the user is changing it. */
  initial?: CompanionFocusGoal | null
  onSaved?: (goal: CompanionFocusGoal) => void
  onSkip: () => void
}>) {
  const titleId = useId()
  const { patch } = useCompanionState(accountId)
  const [goal, setGoal] = useState<CompanionFocusGoal | null>(initial)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [saved, setSaved] = useState<CompanionFocusGoal | null>(null)
  const line = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (saved) line.current?.focus()
  }, [saved])

  const save = async () => {
    if (!goal || saving) return
    setSaving(true)
    setFailed(false)
    const next = await patch({ focus: { goal, chosenOn: localToday() } })
    setSaving(false)
    if (!next) return setFailed(true)
    setSaved(goal)
    onSaved?.(goal)
  }

  if (saved)
    return (
      <div className={styles.block}>
        <div ref={line} className={styles.line} role="status" tabIndex={-1}>
          {focusSavedLine(saved)}
        </div>
      </div>
    )

  return (
    <section className={styles.block} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        14 ngày tới, bạn muốn điều gì nhẹ đi?
      </h3>
      <ChipRadioGroup
        labelledBy={titleId}
        options={OPTIONS}
        value={goal}
        onChange={setGoal}
        disabled={saving}
      />
      {failed && (
        <div className={`${styles.note} ${styles.noteWarn}`} role="alert">
          Chưa lưu được lựa chọn. Bạn thử lại nhé.
        </div>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!goal || saving}
          onClick={() => void save()}
        >
          {saving ? 'Đang lưu…' : 'Chọn điều này'}
        </button>
        <button
          type="button"
          className={styles.quiet}
          disabled={saving}
          onClick={onSkip}
        >
          Để sau
        </button>
      </div>
    </section>
  )
}
