'use client'

import { useEffect, useState } from 'react'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
} from '../api/support-plan-contract'

type Resource = SupportPlan['slots'][number]['allowedAlternatives'][number]

const keyOf = (resource: Resource | null) =>
  resource ? `${resource.resourceId}:${resource.contentVersion}` : ''

function resourcesOf(slot: SupportPlan['slots'][number]) {
  const all = [slot.selectedResource, ...slot.allowedAlternatives].filter(
    (resource): resource is Resource => resource !== null,
  )
  return [...new Map(all.map((resource) => [keyOf(resource), resource]))]
}

/** Resource choices for an older resource-based draft; Care accepts them only before the start. */
export default function AdapterChoices({
  plan,
  busy,
  onSave,
  onDirtyChange,
}: Readonly<{
  plan: SupportPlan
  busy: boolean
  onSave: (request: ReplaceSupportPlanChoicesRequest) => Promise<unknown>
  onDirtyChange: (dirty: boolean) => void
}>) {
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plan.slots.map((slot) => [slot.slotId, keyOf(slot.selectedResource)]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const dirty = plan.slots.some(
    (slot) => choices[slot.slotId] !== keyOf(slot.selectedResource),
  )
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  async function save() {
    if (busy || !dirty) return
    setSaving(true)
    await onSave({
      slotSelections: plan.slots.flatMap((slot) => {
        const selected = resourcesOf(slot).find(
          ([key]) => key === choices[slot.slotId],
        )?.[1]
        return selected
          ? [
              {
                slotId: slot.slotId,
                resourceId: selected.resourceId,
                contentVersion: selected.contentVersion,
              },
            ]
          : []
      }),
    })
    setSaving(false)
  }

  return (
    <form
      className="mbw-choices"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {plan.slots.map((slot) => (
        <fieldset key={slot.slotId} disabled={busy}>
          <legend>
            {slot.kind === 'CORE'
              ? 'Nội dung chính'
              : 'Nội dung thêm (không bắt buộc)'}
          </legend>
          {resourcesOf(slot).map(([key, resource]) => (
            <label key={key}>
              <input
                type="radio"
                name={`mbw-slot-${slot.slotId}`}
                checked={choices[slot.slotId] === key}
                onChange={() =>
                  setChoices((values) => ({ ...values, [slot.slotId]: key }))
                }
              />
              <span>
                <span className="mbw-row-title">{resource.title}</span>
                <span className="mbw-quiet">{resource.summary}</span>
              </span>
            </label>
          ))}
          {slot.kind === 'OPTIONAL' && (
            <label>
              <input
                type="radio"
                name={`mbw-slot-${slot.slotId}`}
                checked={!choices[slot.slotId]}
                onChange={() =>
                  setChoices((values) => ({ ...values, [slot.slotId]: '' }))
                }
              />
              <span className="mbw-row-title">Không dùng nội dung thêm</span>
            </label>
          )}
        </fieldset>
      ))}
      <div className="mbw-actions">
        {/* aria-disabled keeps focus on the button while saving; save() guards the click. */}
        <button
          type="submit"
          className="mbw-secondary"
          aria-disabled={busy || !dirty}
        >
          {saving ? 'Đang lưu…' : 'Lưu lựa chọn'}
        </button>
      </div>
    </form>
  )
}
