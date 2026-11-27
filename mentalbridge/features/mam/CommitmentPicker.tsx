'use client'

import { useId, useState } from 'react'

import type {
  CompanionCommitment,
  CompanionCommitmentKind,
  CompanionCommitmentMinutes,
  CompanionCommitmentSource,
} from '@/lib/companion-state/contract'
import { ChipRadioGroup } from './ChipRadioGroup'
import {
  COMMITMENT_CHIP,
  COMMITMENT_CHIP_KINDS,
  COMMITMENT_FAILED_LINE,
  COMMITMENT_LIMIT_LINE,
  COMMITMENT_MINUTES,
  COMMITMENT_WHEN_LABEL,
  localToday,
  shiftLocalDate,
  type CommitmentWhen,
} from './companion-copy'
import styles from './MamChoice.module.css'
import { useCompanionState } from './use-companion-state'

const KIND_OPTIONS = COMMITMENT_CHIP_KINDS.map((kind) => ({
  value: kind,
  label: COMMITMENT_CHIP[kind] ?? kind,
}))
const MINUTE_OPTIONS = COMMITMENT_MINUTES.map((minutes) => ({
  value: minutes as number,
  label: `${minutes} phút`,
}))
const WHEN_OPTIONS = (['today', 'tomorrow'] as const).map((when) => ({
  value: when,
  label: COMMITMENT_WHEN_LABEL[when],
}))

/**
 * Makes a lời hẹn: what, how long, when. Used by the chat chip and the Home card (after "Đổi việc nhẹ hơn").
 * The caller shows the confirmation and moves focus.
 */
export function CommitmentPicker({
  accountId,
  source,
  defaultMinutes = 5,
  defaultWhen = 'tomorrow',
  onCreated,
  onCancel,
}: Readonly<{
  accountId: string
  source: CompanionCommitmentSource
  defaultMinutes?: CompanionCommitmentMinutes
  defaultWhen?: CommitmentWhen
  onCreated: (commitment: CompanionCommitment, when: CommitmentWhen) => void
  onCancel: () => void
}>) {
  const id = useId()
  const { createCommitment } = useCompanionState(accountId)
  const [kind, setKind] = useState<CompanionCommitmentKind | null>(null)
  const [minutes, setMinutes] = useState<number>(defaultMinutes ?? 5)
  const [when, setWhen] = useState<CommitmentWhen>(defaultWhen)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<'limit' | 'failed' | null>(null)

  const save = async () => {
    if (!kind || saving) return
    setSaving(true)
    setProblem(null)
    const today = localToday()
    const result = await createCommitment({
      kind,
      minutes: minutes as CompanionCommitmentMinutes,
      dueOn: when === 'today' ? today : shiftLocalDate(today, 1),
      source,
    })
    setSaving(false)
    if (result === 'COMMITMENT_LIMIT') return setProblem('limit')
    if (!result) return setProblem('failed')
    onCreated(result, when)
  }

  return (
    <div
      className={styles.block}
      role="group"
      aria-label="Hẹn Mầm một việc nhỏ"
    >
      <div className={styles.group}>
        <div id={`${id}-kind`} className={styles.groupLabel}>
          Việc nhỏ nào?
        </div>
        <ChipRadioGroup
          labelledBy={`${id}-kind`}
          options={KIND_OPTIONS}
          value={kind}
          onChange={setKind}
          disabled={saving}
        />
      </div>
      <div className={styles.group}>
        <div id={`${id}-minutes`} className={styles.groupLabel}>
          Trong bao lâu?
        </div>
        <ChipRadioGroup
          labelledBy={`${id}-minutes`}
          options={MINUTE_OPTIONS}
          value={minutes}
          onChange={setMinutes}
          disabled={saving}
        />
      </div>
      <div className={styles.group}>
        <div id={`${id}-when`} className={styles.groupLabel}>
          Khi nào?
        </div>
        <ChipRadioGroup
          labelledBy={`${id}-when`}
          options={WHEN_OPTIONS}
          value={when}
          onChange={setWhen}
          disabled={saving}
        />
      </div>
      {problem && (
        <div className={`${styles.note} ${styles.noteWarn}`} role="alert">
          {problem === 'limit' ? COMMITMENT_LIMIT_LINE : COMMITMENT_FAILED_LINE}
        </div>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!kind || saving}
          onClick={() => void save()}
        >
          {saving ? 'Đang lưu…' : 'Hẹn Mầm'}
        </button>
        <button
          type="button"
          className={styles.quiet}
          disabled={saving}
          onClick={onCancel}
        >
          Thôi
        </button>
      </div>
    </div>
  )
}
