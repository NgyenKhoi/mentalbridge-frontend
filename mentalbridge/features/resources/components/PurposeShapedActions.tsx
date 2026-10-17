'use client'

import { useState } from 'react'

import type { PublicResourceDetail } from '../api/browser-resources'
import type { ResourceAction } from '../model/resource-interactions'
import styles from './resource-detail.module.css'

const NOTE_GUIDED_TYPES = new Set<PublicResourceDetail['interactionType']>([
  'PROBLEM_SOLVING_WORKSHEET',
  'BEHAVIORAL_ACTIVATION_PLANNER',
  'PREPARE_FOR_SPECIALIST_CHECKLIST',
  'SELF_COMPASSION_PROMPTS',
  'UNHOOKING_PROMPTS',
  'REFLECTION',
])

const promptByType: Partial<
  Record<PublicResourceDetail['interactionType'], string>
> = {
  PROBLEM_SOLVING_WORKSHEET:
    'Viết thật ngắn để biến điều đang rối thành một bước bạn có thể thử.',
  BEHAVIORAL_ACTIVATION_PLANNER:
    'Chọn hoạt động nhỏ, thời điểm cụ thể và mức năng lượng vừa sức.',
  PREPARE_FOR_SPECIALIST_CHECKLIST:
    'Ghi vài ý bạn muốn nhớ khi trao đổi; không cần kể mọi chi tiết.',
  SELF_COMPASSION_PROMPTS:
    'Đi chậm qua từng lời nhắc và chọn cách nói vừa tử tế vừa thực tế.',
  UNHOOKING_PROMPTS:
    'Nhận biết suy nghĩ, rồi đưa sự chú ý về một hành động đang nằm trong tầm tay.',
  GROUNDING_GUIDE:
    'Lần lượt chú ý tới môi trường xung quanh; bạn có thể bỏ qua bất kỳ bước nào.',
  REFLECTION:
    'Không cần tìm câu trả lời hoàn hảo; chỉ ghi nhận điều bạn đang nhận thấy.',
}

type Props = Readonly<{
  interactionType: PublicResourceDetail['interactionType']
  actions: readonly ResourceAction[]
  selectedActionIds: readonly string[]
  disabled: boolean
  onToggle: (actionId: string) => void
}>

export function PurposeShapedActions({
  interactionType,
  actions,
  selectedActionIds,
  disabled,
  onToggle,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [activityEffort, setActivityEffort] = useState('Vừa sức')
  const [activityTime, setActivityTime] = useState('')
  const [activityResult, setActivityResult] = useState('planned')
  const collectsNotes = NOTE_GUIDED_TYPES.has(interactionType)
  const activationPlanner = interactionType === 'BEHAVIORAL_ACTIVATION_PLANNER'

  return (
    <div className={styles.purposeActions}>
      {promptByType[interactionType] && (
        <p className={styles.purposeIntro}>{promptByType[interactionType]}</p>
      )}
      {collectsNotes && (
        <p className={styles.privateDraftNotice}>
          Nội dung bạn nhập chỉ giúp suy nghĩ ngay trên trang này và không được
          lưu.
        </p>
      )}
      {activationPlanner && (
        <fieldset className={styles.activationDraft}>
          <legend>Bản nháp hoạt động</legend>
          <label>
            Mức năng lượng phù hợp
            <select
              value={activityEffort}
              onChange={(event) => setActivityEffort(event.target.value)}
            >
              <option>Rất nhẹ</option>
              <option>Vừa sức</option>
              <option>Thử thách nhẹ</option>
            </select>
          </label>
          <label>
            Thời điểm dự kiến
            <input
              type="datetime-local"
              value={activityTime}
              onChange={(event) => setActivityTime(event.target.value)}
            />
          </label>
          <div className={styles.activationResult}>
            <span>Kết quả hiện tại</span>
            {[
              ['planned', 'Đã lên lịch'],
              ['done', 'Đã làm'],
              ['smaller', 'Cần thu nhỏ hơn'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="activation-result"
                  value={value}
                  checked={activityResult === value}
                  onChange={() => setActivityResult(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <ol>
        {actions.map((action, index) => {
          const selected = selectedActionIds.includes(action.id)
          const inputId = `resource-action-note-${action.id}`
          return (
            <li
              key={action.id}
              className={selected ? styles.purposeActionDone : ''}
            >
              <div className={styles.purposeActionHeader}>
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <strong>{action.label}</strong>
                <label className={styles.purposeActionToggle}>
                  <input
                    type="checkbox"
                    aria-label={action.label}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onToggle(action.id)}
                  />
                  <span>{selected ? '✓ Đã xong' : 'Đánh dấu xong'}</span>
                </label>
              </div>
              {collectsNotes && (
                <textarea
                  id={inputId}
                  value={drafts[action.id] ?? ''}
                  rows={2}
                  maxLength={500}
                  placeholder="Ghi một vài từ cho riêng bạn…"
                  aria-label={`Ghi chú cho: ${action.label}`}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [action.id]: event.target.value,
                    }))
                  }
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
